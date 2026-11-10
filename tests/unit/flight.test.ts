/**
 * Uji model terbang (docs/03 bagian 4.6) dengan Rapier headless.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { PhysicsWorld } from '../../src/physics/PhysicsWorld';
import { RadialGravity } from '../../src/physics/RadialGravity';
import { FlightModel, type FlightEnv, type FlightInput } from '../../src/vehicle/FlightModel';
import { createPlaneBody } from '../../src/vehicle/PlaneBody';
import { FLIGHT } from '../../src/config/flight';
import { PLANET_RADIUS } from '../../src/config/world';
import { bearingDirection, latLonToVec3 } from '../../src/utils/geo';
import { quatFromUpForward } from '../../src/utils/quat';
import { DEG2RAD } from '../../src/utils/math';

let physics: PhysicsWorld;

beforeAll(async () => {
  physics = await PhysicsWorld.create();
});

interface Sim {
  body: ReturnType<typeof createPlaneBody>;
  model: FlightModel;
  gravity: RadialGravity;
  input: FlightInput;
  env: FlightEnv;
  step: () => void;
  pos: () => Vector3;
  vel: () => Vector3;
}

function makeSim(lat: number, lon: number, altitude: number, heading: number, speed: number): Sim {
  const pos = latLonToVec3(lat, lon, PLANET_RADIUS + altitude);
  const up = pos.clone().normalize();
  const fwd = bearingDirection(pos, heading);
  const rot = quatFromUpForward(up, fwd, new Quaternion());
  const body = createPlaneBody(physics, pos, rot);
  body.setLinvel(fwd.clone().multiplyScalar(speed), true);
  const gravity = new RadialGravity();
  gravity.add(body);
  const model = new FlightModel();
  model.state.throttle = FLIGHT.CRUISE_THROTTLE;
  const input: FlightInput = { pitch: 0, roll: 0, yaw: 0, gas: 0, boost: false, brake: false };
  const env: FlightEnv = {
    grounded: false,
    inWater: false,
    heightAboveGround: altitude,
    assist: 'normal',
    wind: new Vector3(),
  };
  const dt = physics.dt;
  const sim: Sim = {
    body,
    model,
    gravity,
    input,
    env,
    step: () => {
      const t = body.translation();
      env.heightAboveGround = Math.hypot(t.x, t.y, t.z) - PLANET_RADIUS;
      model.step(body, input, env, dt);
      gravity.apply(dt);
      physics.world.step();
    },
    pos: () => {
      const t = body.translation();
      return new Vector3(t.x, t.y, t.z);
    },
    vel: () => {
      const v = body.linvel();
      return new Vector3(v.x, v.y, v.z);
    },
  };
  return sim;
}

function cleanup(sim: Sim): void {
  physics.world.removeRigidBody(sim.body);
}

describe('model terbang', () => {
  it('terbang lurus di kecepatan jelajah tetap di ketinggian ±2 unit selama 20 detik', () => {
    const sim = makeSim(10, 40, 30, 90, FLIGHT.CRUISE_SPEED);
    let maxDev = 0;
    for (let i = 0; i < 20 * 60; i++) {
      sim.step();
      const alt = sim.pos().length() - PLANET_RADIUS;
      maxDev = Math.max(maxDev, Math.abs(alt - 30));
    }
    const speed = sim.vel().length();
    cleanup(sim);
    expect(maxDev).toBeLessThanOrEqual(2);
    expect(speed).toBeGreaterThan(FLIGHT.CRUISE_SPEED - 5);
    expect(speed).toBeLessThan(FLIGHT.CRUISE_SPEED + 5);
  });

  it('stall terjadi di bawah STALL_SPEED dan tidak di kecepatan jelajah', () => {
    const slow = makeSim(0, 0, 40, 0, FLIGHT.STALL_SPEED - 4);
    slow.step();
    expect(slow.model.state.stalled).toBe(true);
    let minAlt = Infinity;
    for (let i = 0; i < 60; i++) {
      slow.step();
      minAlt = Math.min(minAlt, slow.pos().length() - PLANET_RADIUS);
    }
    expect(minAlt).toBeLessThan(40);
    cleanup(slow);

    const fast = makeSim(0, 0, 40, 0, FLIGHT.CRUISE_SPEED);
    for (let i = 0; i < 30; i++) fast.step();
    expect(fast.model.state.stalled).toBe(false);
    cleanup(fast);
  });

  it('radius belok dengan bank 45° di kecepatan jelajah antara 25 dan 45 unit', () => {
    const sim = makeSim(-20, 120, 30, 0, FLIGHT.CRUISE_SPEED);
    const curvatures: number[] = [];
    let prevVel = sim.vel();
    for (let i = 0; i < 10 * 60; i++) {
      // Pilot uji: jaga bank 45° dengan kendali P pada input roll.
      const bank = sim.model.state.bankDeg;
      sim.input.roll = Math.max(-1, Math.min(1, (45 - bank) * 0.08));
      sim.step();
      const vel = sim.vel();
      if (i > 4 * 60) {
        // Kelengkungan geodesik: perubahan kecepatan ke arah samping horizontal / v².
        const up = sim.pos().normalize();
        const side = new Vector3().crossVectors(up, vel).normalize();
        const acc = vel.clone().sub(prevVel).divideScalar(physics.dt);
        const s = vel.length();
        curvatures.push(acc.dot(side) / (s * s));
      }
      prevVel = vel;
    }
    cleanup(sim);
    const k = Math.abs(curvatures.reduce((a, b) => a + b, 0) / curvatures.length);
    const radius = 1 / k;
    expect(radius).toBeGreaterThanOrEqual(25);
    expect(radius).toBeLessThanOrEqual(45);
  });

  it('melintasi kutub utara tanpa glitch (tidak NaN, sayap tetap datar, ketinggian stabil)', () => {
    const sim = makeSim(86, 10, 30, 0, FLIGHT.CRUISE_SPEED);
    let maxBank = 0;
    let maxDev = 0;
    let crossed = false;
    for (let i = 0; i < 6 * 60; i++) {
      sim.step();
      const p = sim.pos();
      expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
      maxBank = Math.max(maxBank, Math.abs(sim.model.state.bankDeg));
      maxDev = Math.max(maxDev, Math.abs(p.length() - PLANET_RADIUS - 30));
      const lat = Math.asin(p.y / p.length()) / DEG2RAD;
      if (lat > 89) crossed = true;
    }
    cleanup(sim);
    expect(crossed).toBe(true);
    expect(maxBank).toBeLessThan(3);
    expect(maxDev).toBeLessThan(2.5);
  });
  it('satu putaran planet ±75 detik melewati kedua kutub tanpa glitch', () => {
    const sim = makeSim(3.6, 98.67, 30, 0, FLIGHT.CRUISE_SPEED);
    const start = sim.pos().normalize();
    let north = false;
    let south = false;
    let maxBank = 0;
    let maxDev = 0;
    let lapTime = -1;
    let travelled = 0;
    let prev = sim.pos();
    for (let i = 0; i < 90 * 60; i++) {
      sim.step();
      const p = sim.pos();
      travelled += p.distanceTo(prev);
      prev = p;
      const lat = Math.asin(p.y / p.length()) / DEG2RAD;
      if (lat > 89) north = true;
      if (lat < -89) south = true;
      maxBank = Math.max(maxBank, Math.abs(sim.model.state.bankDeg));
      maxDev = Math.max(maxDev, Math.abs(p.length() - PLANET_RADIUS - 30));
      // Kembali dekat titik awal setelah melewati kedua kutub.
      if (north && south && lapTime < 0 && p.clone().normalize().angleTo(start) < 0.05) lapTime = i / 60;
    }
    cleanup(sim);
    expect(north && south).toBe(true);
    expect(maxBank).toBeLessThan(3);
    expect(maxDev).toBeLessThan(3);
    expect(lapTime).toBeGreaterThan(60);
    expect(lapTime).toBeLessThan(90);
    expect(Number.isFinite(travelled)).toBe(true);
  });
});
