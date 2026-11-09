import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  angularDistanceDeg,
  bearingDirection,
  destination,
  eastAt,
  headingOf,
  latLonToVec3,
  northAt,
  vec3ToLatLon,
} from '../../src/utils/geo';

describe('geo', () => {
  it('memetakan lat/lon ke sumbu sesuai konvensi (Y = utara, lon 0 = +Z, lon 90 = +X)', () => {
    const a = latLonToVec3(0, 0, 1);
    expect(a.z).toBeCloseTo(1);
    const b = latLonToVec3(90, 0, 1);
    expect(b.y).toBeCloseTo(1);
    const c = latLonToVec3(0, 90, 1);
    expect(c.x).toBeCloseTo(1);
    const d = latLonToVec3(0, 0, 400);
    expect(d.length()).toBeCloseTo(400);
  });

  it('vec3ToLatLon adalah kebalikan latLonToVec3', () => {
    for (const [lat, lon] of [
      [3.5952, 98.6722],
      [-33.86, 151.21],
      [51.5, -0.12],
      [-89.9, 45],
      [0, -179.5],
    ] as const) {
      const p = latLonToVec3(lat, lon, 400);
      const ll = vec3ToLatLon(p);
      expect(ll.lat).toBeCloseTo(lat, 6);
      expect(ll.lon).toBeCloseTo(lon, 6);
    }
  });

  it('rangka tangen ortonormal dan aman di kutub', () => {
    for (const lat of [0, 45, 89.999, 90, -90]) {
      const p = latLonToVec3(lat, 30, 400);
      const e = eastAt(p);
      const n = northAt(p);
      const up = p.clone().normalize();
      expect(Number.isFinite(e.x + e.y + e.z + n.x + n.y + n.z)).toBe(true);
      expect(e.length()).toBeCloseTo(1);
      expect(n.length()).toBeCloseTo(1);
      expect(e.dot(up)).toBeCloseTo(0);
      expect(n.dot(up)).toBeCloseTo(0);
      expect(e.dot(n)).toBeCloseTo(0);
    }
  });

  it('bearing dan heading konsisten', () => {
    const p = latLonToVec3(10, 20, 400);
    for (const b of [0, 45, 90, 180, 270, 359]) {
      const dir = bearingDirection(p, b);
      expect(headingOf(p, dir)).toBeCloseTo(b, 4);
    }
    // Utara di khatulistiwa = +Y
    expect(bearingDirection(latLonToVec3(0, 0, 1), 0).y).toBeCloseTo(1);
  });

  it('jarak sudut dan titik tujuan lingkaran besar', () => {
    expect(angularDistanceDeg({ lat: 0, lon: 0 }, { lat: 0, lon: 90 })).toBeCloseTo(90);
    expect(angularDistanceDeg({ lat: 90, lon: 0 }, { lat: -90, lon: 0 })).toBeCloseTo(180);
    const d = destination({ lat: 0, lon: 0 }, 90, 10);
    expect(d.lat).toBeCloseTo(0);
    expect(d.lon).toBeCloseTo(10);
    const n = destination({ lat: 80, lon: 0 }, 0, 20);
    expect(n.lat).toBeCloseTo(80);
    expect(Math.abs(n.lon)).toBeCloseTo(180);
  });

  it('heading tidak NaN untuk arah apa pun', () => {
    const p = new Vector3(0, 400, 0);
    expect(Number.isFinite(headingOf(p, new Vector3(1, 0, 0)))).toBe(true);
  });
});
