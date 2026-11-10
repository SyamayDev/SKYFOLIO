/**
 * Input terpadu (docs/03 bagian 11). Keyboard, gamepad, sentuh, dan giroskop dipetakan ke aksi yang sama.
 * Sumbu: pitch (+ = hidung naik), roll (+ = miring kanan), yaw (+ = kanan).
 */
import { FLIGHT } from '../config/flight';
import { applyDeadzone, clamp, damp } from '../utils/math';
import { bus, type InputDevice } from './EventBus';
import { inputDevice } from './AppState';
import { settings } from './Settings';

export type ButtonAction =
  | 'boost'
  | 'brake'
  | 'jump'
  | 'interact'
  | 'map'
  | 'respawn'
  | 'horn'
  | 'lantern'
  | 'camera'
  | 'photo'
  | 'talk'
  | 'mute'
  | 'pause'
  | 'smoke1'
  | 'smoke2'
  | 'smoke3'
  | 'smoke4'
  | 'smoke5';

const KEYMAP: Record<string, ButtonAction> = {
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
  ControlLeft: 'brake',
  ControlRight: 'brake',
  KeyB: 'brake',
  Space: 'jump',
  Enter: 'interact',
  KeyE: 'interact',
  KeyM: 'map',
  KeyR: 'respawn',
  KeyH: 'horn',
  KeyT: 'lantern',
  KeyC: 'camera',
  KeyP: 'photo',
  KeyV: 'talk',
  KeyL: 'mute',
  Escape: 'pause',
  Digit1: 'smoke1',
  Digit2: 'smoke2',
  Digit3: 'smoke3',
  Digit4: 'smoke4',
  Digit5: 'smoke5',
};

const AXIS_KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

/** Tombol gamepad (standard mapping) → aksi. */
const GAMEPAD_MAP: readonly (readonly [number, ButtonAction])[] = [
  [0, 'jump'],
  [1, 'horn'],
  [2, 'interact'],
  [3, 'respawn'],
  [4, 'talk'],
  [5, 'camera'],
  [8, 'map'],
  [9, 'pause'],
  [12, 'smoke1'],
  [13, 'smoke2'],
  [14, 'smoke3'],
  [15, 'smoke4'],
];

/** Ditulis oleh komponen TouchControls.svelte. */
export const touchState = {
  active: false,
  stickX: 0,
  stickY: 0,
  boost: false,
  brake: false,
  /** Ketuk ganda di sisi kanan (lompat / barrel roll). */
  jumpQueued: false,
  actionQueued: false,
  hornQueued: false,
  cameraQueued: false,
  pauseQueued: false,
};

export class Input {
  /** Sumbu yang sudah dihaluskan. */
  pitch = 0;
  roll = 0;
  yaw = 0;
  /** Sumbu mentah (−1..1) sebelum penghalusan. */
  private rawPitch = 0;
  private rawRoll = 0;
  private rawYaw = 0;
  private tau: number = FLIGHT.INPUT_TAU_KEYBOARD;

  private readonly held = new Set<ButtonAction>();
  private readonly pressedThisFrame = new Set<ButtonAction>();
  private readonly keysDown = new Set<string>();
  private readonly gamepadPrev: boolean[] = [];
  private gamepadIndex: number | null = null;
  private analogBrake = 0;
  private analogBoost = 0;

  /** Geser kamera (piksel) sejak frame lalu dan waktu input geser terakhir. */
  look = { dx: 0, dy: 0, lastTime: -Infinity, source: 'mouse' as 'mouse' | 'touch' | 'stick' };
  private pointerDragging = false;
  private lastPointer = { x: 0, y: 0 };

  // Giroskop
  private gyro = { enabled: false, available: false, neutralLR: 0, neutralFB: 0, lr: 0, fb: 0, calibrated: false };

  private readonly unsubs: (() => void)[] = [];
  private device: InputDevice = 'keyboard';
  /** Saat true (misalnya kolom teks fokus), keyboard diabaikan. */
  enabled = true;

  constructor(private readonly target: HTMLElement) {
    const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      window.addEventListener(type, fn, opts);
      this.unsubs.push(() => window.removeEventListener(type, fn, opts));
    };
    on('keydown', (e) => this.onKey(e, true));
    on('keyup', (e) => this.onKey(e, false));
    on('blur', () => this.releaseAll());
    on('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
      this.setDevice('gamepad');
    });
    on('gamepaddisconnected', (e) => {
      if (this.gamepadIndex === e.gamepad.index) this.gamepadIndex = null;
      this.setDevice(matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard');
    });
    on('deviceorientation', (e) => this.onOrientation(e));

    const pd = (e: PointerEvent) => this.onPointerDown(e);
    const pm = (e: PointerEvent) => this.onPointerMove(e);
    const pu = () => {
      this.pointerDragging = false;
    };
    target.addEventListener('pointerdown', pd);
    window.addEventListener('pointermove', pm);
    window.addEventListener('pointerup', pu);
    this.unsubs.push(() => {
      target.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointermove', pm);
      window.removeEventListener('pointerup', pu);
    });

    // Perangkat awal
    try {
      if (matchMedia('(pointer: coarse)').matches) this.setDevice('touch');
    } catch {
      // abaikan
    }
    this.unsubs.push(
      settings.subscribe((s) => {
        if (s.controls.gyroSteering !== this.gyro.enabled) {
          this.gyro.enabled = s.controls.gyroSteering;
          this.gyro.calibrated = false;
        }
      }),
    );
  }

  private setDevice(d: InputDevice): void {
    if (d === this.device) return;
    this.device = d;
    inputDevice.set(d);
    bus.emit('input:device', { device: d });
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (!this.enabled) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const code = e.code;
    const isAxis = Object.values(AXIS_KEYS).some((k) => k.includes(code));
    const action = KEYMAP[code];
    if (!isAxis && !action) return;
    if (code === 'Space' || code.startsWith('Arrow')) e.preventDefault();
    if (down) {
      this.setDevice('keyboard');
      this.tau = FLIGHT.INPUT_TAU_KEYBOARD;
      if (!this.keysDown.has(code) && action) this.pressedThisFrame.add(action);
      this.keysDown.add(code);
    } else {
      this.keysDown.delete(code);
    }
    this.held.clear();
    for (const k of this.keysDown) {
      const a = KEYMAP[k];
      if (a) this.held.add(a);
    }
  }

  private releaseAll(): void {
    this.keysDown.clear();
    this.held.clear();
    touchState.boost = false;
    touchState.brake = false;
    touchState.stickX = 0;
    touchState.stickY = 0;
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.pointerType === 'touch') {
      this.setDevice('touch');
      return; // geser kamera sentuh ditangani TouchControls
    }
    if (e.button !== 0) return;
    this.pointerDragging = true;
    this.lastPointer.x = e.clientX;
    this.lastPointer.y = e.clientY;
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.pointerDragging || e.pointerType === 'touch') return;
    this.addLook(e.clientX - this.lastPointer.x, e.clientY - this.lastPointer.y, 'mouse');
    this.lastPointer.x = e.clientX;
    this.lastPointer.y = e.clientY;
  }

  /** Dipanggil TouchControls saat jari menggeser area kosong sisi kanan. */
  addLook(dx: number, dy: number, source: 'mouse' | 'touch' | 'stick'): void {
    this.look.dx += dx;
    this.look.dy += dy;
    this.look.lastTime = performance.now() / 1000;
    this.look.source = source;
  }

  /** Ambil geser kamera sejak frame lalu (objek dipakai ulang — jangan disimpan). */
  consumeLook(): { dx: number; dy: number } {
    this.lookOut.dx = this.look.dx;
    this.lookOut.dy = this.look.dy;
    this.look.dx = 0;
    this.look.dy = 0;
    return this.lookOut;
  }
  private readonly lookOut = { dx: 0, dy: 0 };

  private anyDown(codes: readonly string[]): boolean {
    for (const c of codes) if (this.keysDown.has(c)) return true;
    return false;
  }

  // --- Giroskop ---------------------------------------------------------------------------------

  /** Harus dipanggil dari ketukan pengguna (aturan iOS). */
  static async requestGyroPermission(): Promise<'granted' | 'denied' | 'unavailable'> {
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } })
      .DeviceOrientationEvent;
    if (!DOE) return 'unavailable';
    if (typeof DOE.requestPermission === 'function') {
      try {
        return (await DOE.requestPermission()) === 'granted' ? 'granted' : 'denied';
      } catch {
        return 'denied';
      }
    }
    return 'granted';
  }

  private onOrientation(e: DeviceOrientationEvent): void {
    if (e.beta === null || e.gamma === null) return;
    this.gyro.available = true;
    const angle = (screen.orientation?.angle ?? 0) % 360;
    let lr: number;
    let fb: number;
    if (angle === 90) {
      lr = e.beta;
      fb = -e.gamma;
    } else if (angle === 270 || angle === -90) {
      lr = -e.beta;
      fb = e.gamma;
    } else {
      lr = e.gamma;
      fb = e.beta;
    }
    this.gyro.lr = lr;
    this.gyro.fb = fb;
    if (this.gyro.enabled && !this.gyro.calibrated) {
      this.gyro.neutralLR = lr;
      this.gyro.neutralFB = fb;
      this.gyro.calibrated = true;
    }
  }

  recalibrateGyro(): void {
    this.gyro.calibrated = false;
  }

  // --- Per frame ------------------------------------------------------------------------------

  /** Panggil sekali per frame sebelum dunia membaca input. */
  update(dt: number): void {
    const s = settings.get().controls;
    let pitch = 0;
    let roll = 0;
    const yaw = 0;

    if (this.enabled) {
      const up = this.anyDown(AXIS_KEYS.up);
      const down = this.anyDown(AXIS_KEYS.down);
      const left = this.anyDown(AXIS_KEYS.left);
      const right = this.anyDown(AXIS_KEYS.right);
      pitch += (up ? 1 : 0) - (down ? 1 : 0);
      roll += (right ? 1 : 0) - (left ? 1 : 0);
    }

    // Gamepad
    this.pollGamepad();
    if (this.gamepadIndex !== null) {
      const gp = navigator.getGamepads?.()[this.gamepadIndex];
      if (gp) {
        const lx = applyDeadzone(gp.axes[0] ?? 0, 0.15, 2);
        const ly = applyDeadzone(gp.axes[1] ?? 0, 0.15, 2);
        const rx = applyDeadzone(gp.axes[2] ?? 0, 0.15, 2);
        const ry = applyDeadzone(gp.axes[3] ?? 0, 0.15, 2);
        if (Math.abs(lx) + Math.abs(ly) > 0) {
          roll += lx;
          pitch += -ly;
          this.tau = FLIGHT.INPUT_TAU_STICK;
        }
        if (Math.abs(rx) + Math.abs(ry) > 0) this.addLook(rx * 14, ry * 10, 'stick');
      }
    }

    // Sentuh
    if (touchState.active || touchState.stickX !== 0 || touchState.stickY !== 0) {
      roll += touchState.stickX;
      pitch += touchState.stickY;
      if (touchState.stickX !== 0 || touchState.stickY !== 0) this.tau = FLIGHT.INPUT_TAU_STICK;
    }
    if (touchState.jumpQueued) this.pressedThisFrame.add('jump');
    if (touchState.actionQueued) this.pressedThisFrame.add('interact');
    if (touchState.hornQueued) this.pressedThisFrame.add('horn');
    if (touchState.cameraQueued) this.pressedThisFrame.add('camera');
    if (touchState.pauseQueued) this.pressedThisFrame.add('pause');
    touchState.jumpQueued = touchState.actionQueued = touchState.hornQueued = false;
    touchState.cameraQueued = touchState.pauseQueued = false;

    // Giroskop (opsional)
    if (this.gyro.enabled && this.gyro.calibrated) {
      const sens = s.gyroSensitivity;
      roll += clamp(((this.gyro.lr - this.gyro.neutralLR) / 28) * sens, -1, 1);
      pitch += clamp((-(this.gyro.fb - this.gyro.neutralFB) / 24) * sens, -1, 1);
    }

    if (s.invertPitch) pitch = -pitch;
    this.rawPitch = clamp(pitch, -1, 1);
    this.rawRoll = clamp(roll, -1, 1);
    this.rawYaw = clamp(yaw, -1, 1);

    // Penghalusan eksponensial (τ berbeda untuk keyboard dan stik)
    const rate = 1 / this.tau;
    this.pitch = damp(this.pitch, this.rawPitch, rate, dt);
    this.roll = damp(this.roll, this.rawRoll, rate, dt);
    this.yaw = damp(this.yaw, this.rawYaw, rate, dt);
    if (Math.abs(this.pitch) < 1e-4) this.pitch = 0;
    if (Math.abs(this.roll) < 1e-4) this.roll = 0;
  }

  private pollGamepad(): void {
    const pads = navigator.getGamepads?.();
    if (!pads) return;
    if (this.gamepadIndex === null) {
      for (const p of pads) if (p?.connected) this.gamepadIndex = p.index;
      if (this.gamepadIndex === null) return;
    }
    const gp = pads[this.gamepadIndex];
    if (!gp) return;
    let any = false;
    for (const [i, action] of GAMEPAD_MAP) {
      const pressed = !!gp.buttons[i]?.pressed;
      if (pressed && !this.gamepadPrev[i]) this.pressedThisFrame.add(action);
      this.gamepadPrev[i] = pressed;
      any ||= pressed;
    }
    this.analogBrake = gp.buttons[6]?.value ?? 0;
    this.analogBoost = gp.buttons[7]?.value ?? 0;
    const axesActive = gp.axes.some((a) => Math.abs(a) > 0.3);
    if (any || axesActive || this.analogBoost > 0.2 || this.analogBrake > 0.2) this.setDevice('gamepad');
  }

  /** Aksi sedang ditahan. */
  isDown(a: ButtonAction): boolean {
    if (this.held.has(a)) return true;
    if (a === 'boost') return touchState.boost || this.analogBoost > 0.35;
    if (a === 'brake') return touchState.brake || this.analogBrake > 0.35;
    return false;
  }

  /** Aksi baru ditekan di frame ini. */
  wasPressed(a: ButtonAction): boolean {
    return this.pressedThisFrame.has(a);
  }

  /** Sumbu mentah pitch (untuk "gas" di darat). */
  get forwardPush(): number {
    return Math.max(0, this.rawPitch * (settings.get().controls.invertPitch ? -1 : 1));
  }

  /** Ada input kemudi berarti (dipakai autopilot/kamera). */
  get hasSteering(): boolean {
    return Math.abs(this.rawPitch) > 0.15 || Math.abs(this.rawRoll) > 0.15;
  }

  /** Bersihkan aksi "baru ditekan" — panggil di akhir frame. */
  endFrame(): void {
    this.pressedThisFrame.clear();
  }

  get currentDevice(): InputDevice {
    return this.device;
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
  }
}

/** Getaran perangkat (Android) dan rumble gamepad. iOS tidak mendukung navigator.vibrate. */
export function haptic(strength: number, ms: number): void {
  if (!settings.get().controls.vibration) return;
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(Math.round(ms));
  } catch {
    // abaikan
  }
  try {
    for (const gp of navigator.getGamepads?.() ?? []) {
      const act = (gp as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, p: object) => Promise<unknown> } }) | null)
        ?.vibrationActuator;
      act
        ?.playEffect?.('dual-rumble', {
          duration: ms,
          strongMagnitude: clamp(strength, 0, 1),
          weakMagnitude: clamp(strength * 0.6, 0, 1),
        })
        .catch(() => undefined);
    }
  } catch {
    // abaikan
  }
}
