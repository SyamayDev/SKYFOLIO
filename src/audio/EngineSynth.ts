/**
 * Suara pesawat adaptif (docs/05 bagian 2), disintesis:
 * - denyut mesin radial (gigi gergaji di frekuensi penyalaan, lowpass mengikuti throttle),
 * - gemuruh noise,
 * - "whup" baling-baling (modulasi amplitudo di frekuensi lewat bilah),
 * - angin (noise band-pass, cutoff naik seiring kecepatan) + siulan saat sangat cepat,
 * - gulir roda di darat.
 */
import { AUDIO } from '../config/audio';
import { clamp } from '../utils/math';

export interface EngineState {
  throttle: number;
  airspeed: number;
  boosting: boolean;
  grounded: boolean;
  wheelSpeed: number;
  inWater: boolean;
  buffet: number;
  running: boolean;
}

export class EngineSynth {
  private readonly osc: OscillatorNode;
  private readonly sub: OscillatorNode;
  private readonly lp: BiquadFilterNode;
  private readonly engineGain: GainNode;
  private readonly am: GainNode;
  private readonly lfo: OscillatorNode;
  private readonly lfoDepth: GainNode;
  private readonly rumble: AudioBufferSourceNode;
  private readonly rumbleGain: GainNode;
  private readonly wind: AudioBufferSourceNode;
  private readonly windBp: BiquadFilterNode;
  private readonly windGain: GainNode;
  private readonly whistle: OscillatorNode;
  private readonly whistleGain: GainNode;
  private readonly roll: AudioBufferSourceNode;
  private readonly rollLp: BiquadFilterNode;
  private readonly rollGain: GainNode;
  private rpm: number = AUDIO.ENGINE_RPM_IDLE;
  private readonly nodes: AudioScheduledSourceNode[] = [];

  constructor(
    private readonly ctx: AudioContext,
    engineBus: AudioNode,
    windBus: AudioNode,
    sfxBus: AudioNode,
    noise: AudioBuffer,
  ) {
    const c = ctx;
    this.engineGain = c.createGain();
    this.engineGain.gain.value = 0;
    this.am = c.createGain();
    this.am.gain.value = 1;
    this.lp = c.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 500;
    this.lp.Q.value = 1.2;
    this.osc = c.createOscillator();
    this.osc.type = 'sawtooth';
    this.sub = c.createOscillator();
    this.sub.type = 'square';
    const subGain = c.createGain();
    subGain.gain.value = 0.35;
    this.osc.connect(this.lp);
    this.sub.connect(subGain).connect(this.lp);
    this.lp.connect(this.am).connect(this.engineGain).connect(engineBus);

    // Modulasi "whup" baling-baling.
    this.lfo = c.createOscillator();
    this.lfo.type = 'sine';
    this.lfoDepth = c.createGain();
    this.lfoDepth.gain.value = 0.2;
    this.lfo.connect(this.lfoDepth).connect(this.am.gain);

    // Gemuruh
    this.rumble = loop(c, noise);
    const rlp = c.createBiquadFilter();
    rlp.type = 'lowpass';
    rlp.frequency.value = 160;
    this.rumbleGain = c.createGain();
    this.rumbleGain.gain.value = 0;
    this.rumble.connect(rlp).connect(this.rumbleGain).connect(engineBus);

    // Angin
    this.wind = loop(c, noise, 0.37);
    this.windBp = c.createBiquadFilter();
    this.windBp.type = 'bandpass';
    this.windBp.Q.value = 0.7;
    this.windGain = c.createGain();
    this.windGain.gain.value = 0;
    this.wind.connect(this.windBp).connect(this.windGain).connect(windBus);
    this.whistle = c.createOscillator();
    this.whistle.type = 'sine';
    this.whistle.frequency.value = 1300;
    this.whistleGain = c.createGain();
    this.whistleGain.gain.value = 0;
    this.whistle.connect(this.whistleGain).connect(windBus);

    // Gulir roda
    this.roll = loop(c, noise, 0.71);
    this.rollLp = c.createBiquadFilter();
    this.rollLp.type = 'lowpass';
    this.rollLp.frequency.value = 260;
    this.rollGain = c.createGain();
    this.rollGain.gain.value = 0;
    this.roll.connect(this.rollLp).connect(this.rollGain).connect(sfxBus);

    for (const n of [this.osc, this.sub, this.lfo, this.rumble, this.wind, this.whistle, this.roll]) {
      n.start();
      this.nodes.push(n);
    }
  }

  update(s: EngineState, dt: number): void {
    const t = this.ctx.currentTime;
    const thr = s.running ? clamp(s.throttle, 0, 1) : 0;
    const targetRpm = s.running
      ? AUDIO.ENGINE_RPM_IDLE + (AUDIO.ENGINE_RPM_MAX - AUDIO.ENGINE_RPM_IDLE) * (thr * 0.8 + clamp(s.airspeed / 70, 0, 1) * 0.2)
      : 0;
    this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 3);
    const boost = s.boosting ? 1.12 : 1;
    const fire = (this.rpm / 60) * (AUDIO.ENGINE_CYLINDERS / 2) * boost;
    const buffetWobble = s.buffet > 0 ? Math.sin(t * 37) * 0.08 * s.buffet : 0;
    this.osc.frequency.setTargetAtTime(Math.max(20, fire * (1 + buffetWobble)), t, 0.05);
    this.sub.frequency.setTargetAtTime(Math.max(10, fire / 2), t, 0.05);
    this.lp.frequency.setTargetAtTime(300 + thr * 1100 + (s.boosting ? 600 : 0), t, 0.08);
    this.lfo.frequency.setTargetAtTime(Math.max(1, (this.rpm / 60) * 2), t, 0.05);
    this.lfoDepth.gain.setTargetAtTime(0.12 + clamp(s.airspeed / 60, 0, 1) * 0.18, t, 0.1);
    const eg = s.running ? AUDIO.ENGINE_BASE_GAIN * (0.45 + thr * 0.55) * (s.inWater ? 0.6 : 1) : 0;
    this.engineGain.gain.setTargetAtTime(eg, t, 0.08);
    this.rumbleGain.gain.setTargetAtTime(s.running ? 0.12 + thr * 0.18 : 0, t, 0.1);

    const sp = clamp(s.airspeed / AUDIO.WIND_SPEED_REF, 0, 1.4);
    this.windBp.frequency.setTargetAtTime(280 + sp * 1600, t, 0.1);
    this.windGain.gain.setTargetAtTime(AUDIO.WIND_MAX_GAIN * sp * sp, t, 0.15);
    this.whistleGain.gain.setTargetAtTime(Math.max(0, sp - 0.85) * 0.05, t, 0.2);
    this.whistle.frequency.setTargetAtTime(1100 + sp * 500, t, 0.2);

    const roll = s.grounded ? clamp(Math.abs(s.wheelSpeed) / 25, 0, 1) : 0;
    this.rollGain.gain.setTargetAtTime(roll * 0.35, t, 0.06);
    this.rollLp.frequency.setTargetAtTime(160 + roll * 500, t, 0.1);
  }

  dispose(): void {
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {
        // sudah berhenti
      }
      n.disconnect();
    }
  }
}

function loop(ctx: AudioContext, buffer: AudioBuffer, offsetRate = 1): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = buffer;
  s.loop = true;
  s.playbackRate.value = offsetRate === 1 ? 1 : 0.9 + offsetRate * 0.2;
  return s;
}
