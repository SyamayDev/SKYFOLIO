import { describe, expect, it } from 'vitest';
import { FixedStepper } from '../../src/core/Loop';
import { applyDeadzone, smoothDamp, wrapAngle } from '../../src/utils/math';

describe('loop langkah tetap', () => {
  it('menjalankan jumlah langkah sesuai waktu dan mengembalikan alpha', () => {
    const s = new FixedStepper(1 / 60, 4);
    let steps = 0;
    const alpha = s.advance(2.5 / 60, () => steps++);
    expect(steps).toBe(2);
    expect(alpha).toBeCloseTo(0.5, 5);
  });

  it('membatasi sub-langkah (tidak ada spiral of death)', () => {
    const s = new FixedStepper(1 / 60, 4);
    let steps = 0;
    s.advance(1, () => steps++);
    expect(steps).toBe(4);
    steps = 0;
    s.advance(0, () => steps++);
    expect(steps).toBeLessThanOrEqual(1);
  });
});

describe('matematika', () => {
  it('zona mati + kurva', () => {
    expect(applyDeadzone(0.1, 0.15)).toBe(0);
    expect(applyDeadzone(1, 0.15)).toBeCloseTo(1);
    expect(applyDeadzone(-1, 0.15)).toBeCloseTo(-1);
  });

  it('wrapAngle ke (−π, π]', () => {
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 5);
    expect(Math.abs(wrapAngle(0.5))).toBeCloseTo(0.5);
  });

  it('smoothDamp mendekati target tanpa melampaui jauh', () => {
    const st = [0];
    let x = 0;
    for (let i = 0; i < 120; i++) x = smoothDamp(x, 10, st, 0, 0.2, 1 / 60);
    expect(x).toBeGreaterThan(9.9);
    expect(x).toBeLessThan(10.05);
  });
});
