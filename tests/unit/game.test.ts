/** Logika game Fase 4 (docs/09): achievement, hadiah skin, pelacak kejadian, dan migrasi penyimpanan. */
import { beforeEach, describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, AchievementTracker, isUnlocked, unlock } from '../../src/game/Achievements';
import { SKINS, equipSkin } from '../../src/game/Skins';
import { PROGRESS_VERSION, defaultProgress, migrateProgress, progress, resetProgress } from '../../src/game/Progress';
import { bus } from '../../src/core/EventBus';
import { en } from '../../src/i18n/en';
import { id } from '../../src/i18n/id';

beforeEach(() => resetProgress());

describe('achievement', () => {
  it('34 achievement, semuanya punya nama ID & EN', () => {
    expect(ACHIEVEMENTS).toHaveLength(34);
    const ach = (d: unknown, k: string): unknown => (d as { achievements: Record<string, { name?: string }> }).achievements[k]?.name;
    for (const a of ACHIEVEMENTS) {
      expect(ach(id, a.id), `id: ${a.id}`).toBeTruthy();
      expect(ach(en, a.id), `en: ${a.id}`).toBeTruthy();
    }
  });

  it('unlock sekali saja, id tak dikenal diabaikan, event dikirim sekali', () => {
    let events = 0;
    const off = bus.on('achievement', () => events++);
    unlock('first-flight');
    unlock('first-flight');
    unlock('tidak-ada');
    off();
    expect(isUnlocked('first-flight')).toBe(true);
    expect(isUnlocked('tidak-ada')).toBe(false);
    expect(events).toBe(1);
    expect(progress.get().startedAt).toBeTypeOf('number');
  });

  it('achievement berhadiah membuka skin, dan skin terkunci tidak bisa dipakai', () => {
    const reward = SKINS.find((s) => s.unlock && ACHIEVEMENTS.some((a) => a.id === s.unlock));
    expect(reward).toBeTruthy();
    expect(equipSkin(reward!.id)).toBe(false);
    unlock(reward!.unlock!);
    expect(progress.get().unlockedSkins).toContain(reward!.id);
    expect(equipSkin(reward!.id)).toBe(true);
  });

  it('pelacak: lepas landas & cincin latihan terakhir membuka achievement', () => {
    const tr = new AchievementTracker();
    bus.emit('plane:takeoff', undefined as never);
    bus.emit('ring:passed', { index: 2, total: 3 } as never);
    tr.dispose();
    expect(isUnlocked('first-flight')).toBe(true);
    expect(isUnlocked('training-done')).toBe(true);
  });
});

describe('migrasi penyimpanan', () => {
  it('data v1 (stempel berupa string) diubah ke format baru tanpa kehilangan isi', () => {
    const v1 = { version: 1, stamps: { 'home-airport': '2026-11-01' }, achievements: { 'first-flight': '2026-11-01T00:00:00Z' }, unlockedSkins: ['toyplane', 'toyplane'] };
    const p = migrateProgress(v1);
    expect(p.version).toBe(PROGRESS_VERSION);
    expect(p.stamps['home-airport']).toEqual({ date: '2026-11-01', rot: 0 });
    expect(p.achievements['first-flight']).toBe('2026-11-01T00:00:00Z');
    expect(new Set(p.unlockedSkins).size).toBe(p.unlockedSkins.length);
  });

  it('data rusak / kosong → bawaan, tidak pernah melempar', () => {
    for (const bad of [null, undefined, 42, 'teks', [], { stamps: { x: null } }]) {
      expect(() => migrateProgress(bad)).not.toThrow();
    }
    expect(migrateProgress(null)).toEqual(defaultProgress());
  });

  it('reset progres mengosongkan achievement', () => {
    unlock('first-flight');
    resetProgress();
    expect(isUnlocked('first-flight')).toBe(false);
  });
});
