/**
 * Fase 2: fase Bulan, cuaca WMO, sel cuaca, lapisan terbang (darat → angkasa → Bulan), orbit, skor musik.
 */
import { describe, expect, it } from 'vitest';
import { FLIGHT, SPACE } from '../../src/config/flight';
import { PLANET_RADIUS } from '../../src/config/world';
import { genMotif, toStation } from '../../src/audio/MusicEngine/MusicEngine';
import { THEMES, degreeFreq, parsePhrase } from '../../src/audio/MusicEngine/themes';
import { mulberry32 } from '../../src/utils/rng';
import { circularSpeed, regimeOf } from '../../src/vehicle/SpaceFlight';
import { cellsFor } from '../../src/world/weatherCells';
import { manualProfile, windKmhToUnits, wmoToProfile } from '../../src/world/weatherCodes';
import { dayPartOf } from '../../src/world/WorldClock';
import { seasonOf } from '../../src/world/WorldState';
import { moonPhase } from '../../src/world/MoonPhase';

describe('fase Bulan', () => {
  it('purnama 13 Januari 2025 ≈ 0,5', () => {
    const p = moonPhase(new Date(Date.UTC(2025, 0, 13, 22, 27)));
    expect(Math.abs(p - 0.5)).toBeLessThan(0.04);
  });
  it('bulan baru 29 Januari 2025 ≈ 0 atau 1', () => {
    const p = moonPhase(new Date(Date.UTC(2025, 0, 29, 12, 36)));
    expect(Math.min(p, 1 - p)).toBeLessThan(0.04);
  });
});

describe('cuaca WMO', () => {
  it('cerah, hujan, badai, salju, kabut', () => {
    expect(wmoToProfile(0)).toMatchObject({ kind: 'clear', rain: 0 });
    expect(wmoToProfile(63).kind).toBe('rain');
    expect(wmoToProfile(65).rain).toBe(1);
    expect(wmoToProfile(95)).toMatchObject({ kind: 'storm' });
    expect(wmoToProfile(95).storm).toBeGreaterThan(0.5);
    expect(wmoToProfile(75)).toMatchObject({ kind: 'snow', snow: 1 });
    expect(wmoToProfile(45).fog).toBeGreaterThan(0.5);
    expect(wmoToProfile(80).rain).toBeGreaterThan(0);
  });
  it('kode tak dikenal → berawan sebagian, nilai selalu 0..1', () => {
    for (const code of [0, 1, 2, 3, 45, 48, 51, 53, 55, 61, 63, 65, 71, 73, 75, 80, 81, 82, 95, 96, 99, 1234]) {
      const p = wmoToProfile(code);
      for (const v of [p.rain, p.snow, p.storm, p.cloud, p.fog]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    expect(wmoToProfile(1234).kind).toBe('partly');
  });
  it('pilihan manual dan angin', () => {
    expect(manualProfile('storm').kind).toBe('storm');
    expect(manualProfile('apa-saja').kind).toBe('clear');
    expect(windKmhToUnits(0)).toBe(0);
    expect(windKmhToUnits(1000)).toBeLessThanOrEqual(6);
  });
  it('sel cuaca deterministik per hari dan salju di belahan musim dingin', () => {
    const d = new Date(Date.UTC(2026, 0, 15, 8));
    expect(cellsFor(d, seasonOf(d))).toEqual(cellsFor(d, seasonOf(d)));
    const next = new Date(Date.UTC(2026, 0, 16, 8));
    expect(cellsFor(next, seasonOf(next))).not.toEqual(cellsFor(d, seasonOf(d)));
    const cells = cellsFor(d, seasonOf(d));
    for (const c of cells) if (c.lat > 50) expect(c.kind).toBe('snow');
  });
  it('musim: Juni = musim panas utara, Desember = musim dingin utara', () => {
    expect(seasonOf(new Date(Date.UTC(2026, 5, 21)))).toBeGreaterThan(0.95);
    expect(seasonOf(new Date(Date.UTC(2026, 11, 21)))).toBeLessThan(-0.95);
  });
  it('tema UI dari jam lokal', () => {
    expect(dayPartOf(10)).toBe('day');
    expect(dayPartOf(18)).toBe('dusk');
    expect(dayPartOf(23)).toBe('night');
  });
});

describe('lapisan terbang', () => {
  it('naik: darat → udara → stratosfer → angkasa, dengan histeresis', () => {
    let r = regimeOf('ground', 0, true, false, false);
    expect(r).toBe('ground');
    r = regimeOf(r, 50, false, false, false);
    expect(r).toBe('air');
    r = regimeOf(r, SPACE.STRATO_ALT + SPACE.HYST + 1, false, false, false);
    expect(r).toBe('stratosphere');
    r = regimeOf(r, SPACE.SPACE_ALT + SPACE.HYST + 1, false, false, false);
    expect(r).toBe('space');
    // Sedikit di bawah batas tetap angkasa (histeresis) → tidak berkedip.
    expect(regimeOf('space', SPACE.SPACE_ALT - 2, false, false, false)).toBe('space');
    expect(regimeOf('space', SPACE.SPACE_ALT - SPACE.HYST - 1, false, false, false)).toBe('stratosphere');
  });
  it('di wilayah Bulan selalu "moon", di air "water"', () => {
    expect(regimeOf('space', 900, false, false, true)).toBe('moon');
    expect(regimeOf('air', 0, false, true, false)).toBe('water');
  });
  it('kecepatan orbit lingkaran di permukaan = √(g·R)', () => {
    expect(circularSpeed(FLIGHT.G0, PLANET_RADIUS, PLANET_RADIUS)).toBeCloseTo(Math.sqrt(FLIGHT.G0 * PLANET_RADIUS), 6);
    expect(circularSpeed(FLIGHT.G0, PLANET_RADIUS, PLANET_RADIUS * 4)).toBeLessThan(circularSpeed(FLIGHT.G0, PLANET_RADIUS, PLANET_RADIUS));
  });
});

describe('musik Syamay FM', () => {
  it('semua frasa tema bisa dibaca dan panjangnya 4 birama', () => {
    for (const th of Object.values(THEMES)) {
      for (const ph of th.phrases) {
        const p = parsePhrase(ph);
        expect(p.steps, `${th.id}`).toBe(64);
        for (const n of p.notes) expect(n.step + n.len).toBeLessThanOrEqual(64);
      }
    }
  });
  it('derajat tangga nada → frekuensi (oktaf = ×2)', () => {
    expect(degreeFreq(293.66, 'majorPent', 0)).toBeCloseTo(293.66, 3);
    expect(degreeFreq(293.66, 'majorPent', 5)).toBeCloseTo(587.32, 2);
    expect(degreeFreq(293.66, 'majorPent', 0, -1)).toBeCloseTo(146.83, 2);
  });
  it('motif generatif deterministik dan berakhir di nada dasar/oktaf', () => {
    const a = genMotif(mulberry32(5), 32, 0.25);
    expect(a).toEqual(genMotif(mulberry32(5), 32, 0.25));
    const last = a[a.length - 1]!;
    expect([0, 5]).toContain(last.degree);
  });
  it('stasiun lama "syamay-fm" tetap dikenali', () => {
    expect(toStation('syamay-fm')).toBe('syamay');
    expect(toStation('funkot')).toBe('funkot');
    expect(toStation('xyz')).toBe('syamay');
  });
});
