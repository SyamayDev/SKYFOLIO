import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import {
  bankAngle,
  bodyForward,
  bodyRight,
  bodyUp,
  pitchAngle,
  quatFromUpForward,
  rotateTowards,
  rotationVectorBetween,
} from '../../src/utils/quat';
import { latLonToVec3, bearingDirection } from '../../src/utils/geo';

describe('quaternion', () => {
  it('quatFromUpForward menghasilkan sumbu badan yang benar (depan −Z, atas +Y, kanan +X)', () => {
    const up = new Vector3(0, 0, 1);
    const fwd = new Vector3(1, 0, 0);
    const q = quatFromUpForward(up, fwd);
    expect(bodyForward(q).distanceTo(fwd)).toBeLessThan(1e-6);
    expect(bodyUp(q).distanceTo(up)).toBeLessThan(1e-6);
    // kanan = depan × atas
    const right = new Vector3().crossVectors(fwd, up);
    expect(bodyRight(q).distanceTo(right)).toBeLessThan(1e-6);
  });

  it('memproyeksikan depan ke bidang tegak lurus atas dan aman bila sejajar', () => {
    const up = new Vector3(0, 1, 0);
    const q = quatFromUpForward(up, new Vector3(1, 1, 0));
    expect(bodyForward(q).y).toBeCloseTo(0);
    const q2 = quatFromUpForward(up, new Vector3(0, 5, 0));
    expect(Number.isFinite(q2.x + q2.y + q2.z + q2.w)).toBe(true);
    expect(bodyUp(q2).distanceTo(up)).toBeLessThan(1e-6);
  });

  it('bank dan pitch relatif horizon lokal di sembarang titik planet', () => {
    const pos = latLonToVec3(-40, 130, 430);
    const up = pos.clone().normalize();
    const fwd = bearingDirection(pos, 70);
    const q = quatFromUpForward(up, fwd);
    expect(bankAngle(bodyRight(q), bodyUp(q), up)).toBeCloseTo(0);
    expect(pitchAngle(bodyForward(q), up)).toBeCloseTo(0);
    // Miring kanan 30°: putar di sumbu depan sebesar +30°.
    const rolled = q.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, -1), Math.PI / 6));
    expect(bankAngle(bodyRight(rolled), bodyUp(rolled), up)).toBeCloseTo(Math.PI / 6);
    // Hidung naik 20°: putar di sumbu kanan (+X).
    const pitched = q.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), (20 * Math.PI) / 180));
    expect(pitchAngle(bodyForward(pitched), up)).toBeCloseTo((20 * Math.PI) / 180);
  });

  it('rotateTowards mempertahankan panjang dan bergerak sebagian', () => {
    const v = new Vector3(10, 0, 0);
    const out = rotateTowards(v, new Vector3(0, 1, 0), 0.5, new Vector3());
    expect(out.length()).toBeCloseTo(10);
    expect(out.angleTo(new Vector3(1, 0, 0))).toBeCloseTo(Math.PI / 4);
    const same = rotateTowards(v, new Vector3(1, 0, 0), 1, new Vector3());
    expect(same.distanceTo(v)).toBeLessThan(1e-9);
  });

  it('rotationVectorBetween', () => {
    const r = rotationVectorBetween(new Vector3(1, 0, 0), new Vector3(0, 1, 0));
    expect(r.length()).toBeCloseTo(Math.PI / 2);
    expect(r.z).toBeGreaterThan(0);
  });
});
