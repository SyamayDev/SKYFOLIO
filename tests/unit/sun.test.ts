import { describe, expect, it } from 'vitest';
import { manualDate, subsolarPoint } from '../../src/world/Sun';

describe('posisi matahari (NOAA)', () => {
  it('21 Juni 12.00 UTC → lat subsolar ≈ +23,4°, lon ≈ 0°', () => {
    const s = subsolarPoint(new Date(Date.UTC(2026, 5, 21, 12, 0, 0)));
    expect(s.lat).toBeGreaterThan(23.2);
    expect(s.lat).toBeLessThan(23.6);
    expect(Math.abs(s.lon)).toBeLessThan(1);
  });

  it('21 Desember → lat subsolar ≈ −23,4°', () => {
    const s = subsolarPoint(new Date(Date.UTC(2026, 11, 21, 12, 0, 0)));
    expect(s.lat).toBeLessThan(-23.2);
    expect(s.lat).toBeGreaterThan(-23.6);
  });

  it('pukul 00.00 UTC matahari di sekitar bujur 180°', () => {
    const s = subsolarPoint(new Date(Date.UTC(2026, 2, 20, 0, 0, 0)));
    expect(Math.abs(Math.abs(s.lon) - 180)).toBeLessThan(5);
  });

  it('manualDate: 10.00 WIB = 03.00 UTC', () => {
    const d = manualDate(10, 7, new Date(Date.UTC(2026, 10, 9, 15)));
    expect(d.getUTCHours()).toBe(3);
  });
});
