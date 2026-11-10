/**
 * Umpan balik permainan (docs/03 bagian 6 + docs/11 "game feel"): setiap kejadian mendapat
 * partikel, bunyi (variasi pitch), guncangan kamera, getaran, dan reaksi Piko.
 */
import { Vector3 } from 'three';
import { PALETTE } from '../config/palette';
import { bus, type Vec3Like } from '../core/EventBus';
import { haptic } from '../core/Input';
import { tr } from '../i18n';
import type { AudioManager } from '../audio/AudioManager';
import type { CameraRig } from '../camera/CameraRig';
import type { SurfaceMaterial } from '../physics/PhysicsWorld';
import type { Particles } from '../world/Particles';
import type { Plane } from './Plane';
import { pushToast } from '../ui/toasts';

const DUST: Record<SurfaceMaterial, readonly string[]> = {
  grass: ['#8BD45A', '#C9B27A', '#E9DDB5'],
  sand: ['#F6D99A', '#EFC97F', '#FFF0C9'],
  snow: ['#FFFFFF', '#E3F1FF'],
  rock: ['#9C8F86', '#C9C0B8'],
  wood: ['#C98B55', '#E8C9A0'],
  metal: ['#FFE08A', '#FFFFFF', '#FFB347'],
  fabric: ['#FFFFFF', '#FFD6A5'],
  rubber: ['#FFFFFF', '#CCCCCC'],
  water: ['#F4FFFF', '#BDE8FF', '#3FD0E0'],
  asphalt: ['#C9CED6', '#FFFFFF'],
};
const SPARKS = ['#FFE08A', '#FFFFFF', '#FFB347'] as const;
const SMOKE = ['#E8E8EE', '#C9CBD6', '#FFFFFF'] as const;
const CONFETTI = [PALETTE.sun, PALETTE.berry, PALETTE.sky, PALETTE.leaf, '#B58CFF'] as const;
const LEAVES = ['#5CCB5F', '#3DCB7A', '#8BD45A'] as const;

const _up = new Vector3();
const _p = new Vector3();
const _v = new Vector3();

export class Feedback {
  private readonly unsubs: (() => void)[] = [];
  private stallToastTime = -Infinity;
  private dustTimer = 0;
  private smokeTimer = 0;
  private time = 0;
  private readonly emitOpts = { life: 0.8, size: 0.35, sizeEnd: 0, drag: 2, gravity: 0, spread: 0.6 };

  constructor(
    private readonly plane: Plane,
    private readonly particles: Particles,
    private readonly camera: CameraRig,
    private readonly audio: AudioManager,
  ) {
    const on = <K extends Parameters<typeof bus.on>[0]>(type: K, fn: Parameters<typeof bus.on<K>>[1]) =>
      this.unsubs.push(bus.on(type, fn));

    on('plane:crash', (e) => this.crash(e.tier, e.speed, e.point, e.material));
    on('plane:landed', (e) => {
      const p = this.planePoint();
      if (e.smooth) {
        pushToast(tr('toast.smoothLanding'), 'success', '🛬');
        this.audio.sfx?.tire(0.7);
        this.particles.burst(p, 10, SMOKE, { speed: 1.6, up: this.upAt(p), upSpeed: 1.2, life: 1.1, size: 0.45 });
        haptic(0.3, 30);
      } else {
        pushToast(tr('toast.hardLanding'), 'warn', '💥');
        this.audio.sfx?.impact('grass', 0.8);
        this.audio.sfx?.tire(1);
        this.camera.addTrauma(0.35);
        this.plane.piko.bonk(1);
        haptic(0.6, 90);
      }
    });
    on('plane:takeoff', () => {
      this.audio.sfx?.whoosh();
    });
    on('plane:stall', (e) => {
      // Abaikan "stall" sesaat saat melompat/memantul dekat tanah.
      if (!e.active || this.plane.env.heightAboveGround < 3) return;
      this.audio.sfx?.stallWarn();
      if (this.time - this.stallToastTime > 8) {
        this.stallToastTime = this.time;
        pushToast(tr('toast.stall'), 'warn', '⚠️');
      }
    });
    on('plane:barrelRoll', () => {
      this.audio.sfx?.whoosh();
      haptic(0.2, 25);
    });
    on('plane:jump', () => {
      this.audio.sfx?.spring();
      const p = this.planePoint();
      this.particles.burst(p, 8, DUST[this.plane.ground.wheels[0]?.material ?? 'grass'], {
        speed: 2,
        up: this.upAt(p),
        upSpeed: 1.5,
        life: 0.7,
        size: 0.4,
      });
      haptic(0.25, 25);
    });
    on('plane:horn', () => this.audio.sfx?.horn());
    on('plane:splash', (e) => {
      const s = Math.min(1, e.speed / 15);
      this.audio.sfx?.splash(s);
      this.particles.burst(e.point, 18 + Math.round(s * 20), DUST.water, {
        speed: 3 + s * 4,
        up: this.upAt(e.point),
        upSpeed: 5 + s * 6,
        life: 1.2,
        size: 0.45,
        gravity: 12,
        drag: 1,
      });
      this.camera.addTrauma(0.2 + s * 0.3);
      if (s > 0.4) pushToast(tr('toast.splash'), 'info', '💦');
    });
    on('plane:respawn', () => pushToast(tr('toast.respawn'), 'info', '🛫'));
    on('ring:passed', (e) => {
      this.audio.sfx?.ding(e.index);
      const p = this.planePoint();
      this.particles.burst(p, 24, CONFETTI, { speed: 6, life: 1.4, size: 0.3, drag: 1.4, gravity: 4 });
      haptic(0.3, 35);
      if (e.index === e.total - 1) pushToast(tr('toast.ringsDone'), 'success', '🏅');
      else pushToast(tr('toast.ring', { n: e.index + 1, total: e.total }), 'success', '⭐');
    });
    on('prop:hit', (e) => {
      const s = Math.min(1, e.speed / 10);
      this.audio.sfx?.impact(e.material, s);
      if (s > 0.25) this.particles.burst(e.point, 3 + Math.round(s * 5), DUST[e.material], { speed: 1.5 + s * 2, life: 0.6, size: 0.25 });
    });
    on('letters:restored', () => {
      this.audio.sfx?.plop();
    });
    on('tree:brush', (e) => {
      this.audio.sfx?.rustle(Math.min(1, e.speed / 30));
      this.particles.burst(e.point, 10, LEAVES, { speed: 3, life: 1.3, size: 0.28, drag: 1.5, gravity: 3 });
      this.camera.addTrauma(0.12);
      haptic(0.2, 20);
    });
  }

  private planePoint(): Vector3 {
    return _p.copy(this.plane.position);
  }

  private upAt(p: Vec3Like): Vector3 {
    return _up.set(p.x, p.y, p.z).normalize();
  }

  private crash(tier: 0 | 1 | 2 | 3, speed: number, point: Vec3Like, material: SurfaceMaterial): void {
    const strength = Math.min(1, speed / 25);
    this.audio.sfx?.impact(material, 0.25 + strength * 0.75);
    const dust = DUST[material] ?? DUST.grass;
    const up = this.upAt(point);
    this.particles.burst(point, 4 + tier * 5, dust, { speed: 2 + tier * 1.5, up, upSpeed: 1 + tier, life: 0.8 + tier * 0.2, size: 0.3 + tier * 0.08 });
    if (tier >= 1) {
      this.particles.burst(point, 6 + tier * 4, SPARKS, { speed: 4 + tier * 2, life: 0.45, size: 0.14, drag: 3 });
      haptic(0.4 + tier * 0.15, 40 + tier * 30);
    }
    if (tier >= 2) {
      this.particles.burst(point, 8 + tier * 4, SMOKE, { speed: 1.5, up, upSpeed: 2, life: 1.8, size: 0.7, drag: 1.2 });
    }
    if (tier >= 3) {
      pushToast(tr('toast.bigCrash'), 'warn', '😵');
      this.audio.sfx?.impact('metal', 1);
    }
    this.camera.addTrauma([0.12, 0.35, 0.6, 0.9][tier]!);
  }

  /** Efek berkelanjutan: debu roda, asap knalpot, buffet stall. */
  update(dt: number): void {
    this.time += dt;
    const s = this.plane.flight.state;
    const g = this.plane.ground;
    // Debu/rumput beterbangan saat melaju cepat di tanah.
    if (g.grounded && s.speed > 6) {
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = 0.05;
        for (const w of g.wheels) {
          if (!w.contact || w.isTail) continue;
          const colors = DUST[w.material] ?? DUST.grass;
          const o = this.emitOpts;
          o.life = 0.7;
          o.size = 0.22 + Math.min(0.3, s.speed / 100);
          o.drag = 2.5;
          o.gravity = 0;
          o.spread = 0.6;
          _v.copy(w.hitNormal).multiplyScalar(0.8);
          this.particles.emit(w.hitPoint, _v, colors[Math.floor(Math.random() * colors.length)]!, o);
        }
      }
    }
    // Asap knalpot (lebih tebal saat boost).
    if (this.plane.engineRunning && !this.plane.frozen) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = s.boosting ? 0.03 : 0.12;
        this.plane.model.exhaust.getWorldPosition(_p);
        const o = this.emitOpts;
        o.life = s.boosting ? 0.9 : 0.6;
        o.size = s.boosting ? 0.3 : 0.18;
        o.drag = 3;
        o.gravity = 0;
        o.spread = 0.2;
        this.plane.velocity(_v).multiplyScalar(0.3);
        this.particles.emit(_p, _v, s.boosting ? '#FFFFFF' : '#D9DCE6', o);
      }
    }
    // Buffet stall: guncangan kecil + getaran.
    if (s.stalled) this.camera.addTrauma(s.buffet * dt * 1.5);
  }

  dispose(): void {
    for (const u of this.unsubs) u();
  }
}
