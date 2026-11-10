/**
 * 34 achievement (docs/09 bagian 2). Pelacak berbasis event bus + satu `tick` per frame untuk syarat
 * berbasis waktu/gerak (loop, keliling dunia, pilot malam, menembus awan & badai).
 * Membuka: simpan tanggal → toast + stinger + Piko bersorak + skin hadiah.
 */
import { content } from '../content';
import { panel } from '../core/AppState';
import { bus } from '../core/EventBus';
import { tr, type I18nKey } from '../i18n';
import { pushToast } from '../ui/toasts';
import { patchProgress, progress } from './Progress';
import { unlockSkinFor } from './Skins';

export interface AchievementDef {
  id: string;
  secret?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-flight' },
  { id: 'name-crasher' },
  { id: 'training-done' },
  { id: 'smooth-landing' },
  { id: 'island-hopper' },
  { id: 'project-collector' },
  { id: 'around-the-world' },
  { id: 'cloud-surfer' },
  { id: 'edge-of-space' },
  { id: 'moonwalker' },
  { id: 'night-owl' },
  { id: 'storm-chaser' },
  { id: 'loop-de-loop' },
  { id: 'barrel-master' },
  { id: 'under-bridge' },
  { id: 'landmark-tourist' },
  { id: 'passport-full' },
  { id: 'skill-climber' },
  { id: 'time-traveler' },
  { id: 'city-lights' },
  { id: 'mailman' },
  { id: 'lantern-lighter' },
  { id: 'chef-aril' },
  { id: 'gym-pr' },
  { id: 'laundry-hero' },
  { id: 'fort-breaker' },
  { id: 'mc-applause' },
  { id: 'piko-friend' },
  { id: 'recruiter-tour' },
  { id: 'circuit-finisher' },
  { id: 'circuit-champ' },
  { id: 'daredevil', secret: true },
  { id: 'phoenix', secret: true },
  { id: 'true-captain' },
];

export interface AchievementTick {
  dt: number;
  airborne: boolean;
  night: boolean;
  cloud: number;
  storm: number;
  lon: number;
  /** Laju angguk (rad/dtk, sumbu kanan pesawat). */
  pitchRate: number;
  lettersScattered: number;
}

export function isUnlocked(id: string): boolean {
  return !!progress.get().achievements[id];
}

export function unlock(id: string): void {
  if (isUnlocked(id) || !ACHIEVEMENTS.some((a) => a.id === id)) return;
  patchProgress((p) => {
    p.achievements[id] = new Date().toISOString();
    p.startedAt ??= Date.now();
  });
  const skin = unlockSkinFor(id);
  const name = tr(`achievements.${id}.name` as I18nKey);
  pushToast(skin ? `${tr('achievements.unlocked', { name })} ${tr('achievements.skinReward')}` : tr('achievements.unlocked', { name }), 'success', 'trophy');
  bus.emit('achievement', { id });
  // Kapten Sejati: semua yang tidak rahasia.
  const all = ACHIEVEMENTS.filter((a) => !a.secret && a.id !== 'true-captain').every((a) => isUnlocked(a.id));
  if (all && !isUnlocked('true-captain')) {
    patchProgress((p) => {
      p.completedAt = Date.now();
    });
    setTimeout(() => unlock('true-captain'), 1500);
  }
}

function count(key: string, by = 1): number {
  let n = 0;
  patchProgress((p) => {
    n = (p.counters[key] ?? 0) + by;
    p.counters[key] = n;
  });
  return n;
}

/** Simpan himpunan kecil (mis. pulau yang sudah didarati) di counters sebagai bit nama. */
function addToSet(key: string, member: string): number {
  const k = `${key}:${member}`;
  const p = progress.get();
  if (!p.counters[k]) {
    patchProgress((q) => {
      q.counters[k] = 1;
    });
  }
  return Object.keys(progress.get().counters).filter((x) => x.startsWith(`${key}:`)).length;
}

export class AchievementTracker {
  private readonly offs: (() => void)[] = [];
  private nightTime = 0;
  private lonPrev: number | null = null;
  private lonSum = 0;
  private loopSum = 0;
  private loopTime = 0;

  constructor() {
    const on = bus.on.bind(bus);
    this.offs.push(
      on('plane:takeoff', () => unlock('first-flight')),
      on('plane:landed', (e) => {
        if (e.smooth) unlock('smooth-landing');
        this.lonSum = 0;
        this.lonPrev = null;
      }),
      on('plane:respawn', () => {
        this.lonSum = 0;
        this.lonPrev = null;
      }),
      on('ring:passed', (e) => {
        if (e.index === e.total - 1) unlock('training-done');
      }),
      on('project:land', (e) => {
        if (addToSet('land', e.id) >= 3) unlock('island-hopper');
      }),
      on('flight:regime', (e) => {
        if (e.regime === 'space') unlock('edge-of-space');
      }),
      on('moon:landed', (e) => {
        if (e.smooth) unlock('moonwalker');
      }),
      on('plane:barrelRoll', () => {
        if (count('barrel-rolls') >= 10) unlock('barrel-master');
      }),
      on('landmark:visit', () => {
        const n = Object.keys(progress.get().stamps).filter((k) => k.startsWith('landmark:')).length;
        if (n >= 10) unlock('landmark-tourist');
      }),
      on('stamp', (e) => {
        if (e.kind !== 'zone') return;
        const zones = content.get().zones.zones.map((z) => z.id);
        if (zones.every((z) => progress.get().stamps[z])) unlock('passport-full');
      }),
      on('zone:enter', (e) => {
        if (e.id === 'contribution-city' && this.lastNight) unlock('city-lights');
      }),
      on('parcel:delivered', () => unlock('mailman')),
      on('interact', (e) => {
        const a = e.action;
        if (a === 'all-skill-rings') unlock('skill-climber');
        else if (a === 'journey-complete') unlock('time-traveler');
        else if (a === 'release-lantern') unlock('lantern-lighter');
        else if (a.startsWith('cook:')) unlock('chef-aril');
        else if (a === 'gym-pr' && count('gym-lifts') >= 5) unlock('gym-pr');
        else if (a === 'fort-broken') unlock('fort-breaker');
        else if (a === 'mc-applause') unlock('mc-applause');
        else if (a === 'crater-dive') unlock('daredevil');
        else if (a.startsWith('lap:')) unlock('circuit-finisher');
        else if (a.startsWith('under:')) unlock('under-bridge');
        else if (a.startsWith('laundry-score:') && Number(a.split(':')[1]) >= 8) unlock('laundry-hero');
      }),
      on('game:event', (e) => {
        if (e.id === 'chat-ask' && count('chat-asks') >= 5) unlock('piko-friend');
        else if (e.id === 'tour-done') unlock('recruiter-tour');
        else if (e.id === 'circuit-top10') unlock('circuit-champ');
        else if (e.id === 'phoenix') unlock('phoenix');
      }),
      panel.subscribe((p) => {
        if (p?.kind !== 'project' || !p.id) return;
        const n = addToSet('opened', p.id);
        if (n >= content.get().projects.length) unlock('project-collector');
      }),
    );
  }

  private lastNight = false;

  tick(t: AchievementTick): void {
    this.lastNight = t.night;
    if (t.lettersScattered >= 7) unlock('name-crasher');
    if (!t.airborne) {
      this.loopSum = 0;
      return;
    }
    if (t.cloud > 0.5) unlock('cloud-surfer');
    if (t.storm > 0.45) unlock('storm-chaser');
    if (t.night) {
      this.nightTime += t.dt;
      if (this.nightTime > 120) unlock('night-owl');
    }
    // Keliling dunia: jumlah perubahan bujur (dibuka lipatannya) dalam satu penerbangan ≥ 360°.
    if (this.lonPrev !== null) {
      let d = t.lon - this.lonPrev;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      this.lonSum += d;
      if (Math.abs(this.lonSum) >= 360) unlock('around-the-world');
    }
    this.lonPrev = t.lon;
    // Loop: putaran angguk kumulatif 360° dalam 15 detik.
    this.loopSum += t.pitchRate * t.dt;
    this.loopTime += t.dt;
    if (Math.abs(this.loopSum) >= Math.PI * 2) unlock('loop-de-loop');
    if (this.loopTime > 15) {
      this.loopTime = 0;
      this.loopSum = 0;
    }
  }

  dispose(): void {
    for (const o of this.offs) o();
  }
}
