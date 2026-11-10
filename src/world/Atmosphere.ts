/**
 * Cangkang atmosfer (docs/04 bagian 5): efek fresnel di sekeliling planet — biru di sisi siang,
 * jingga di garis senja, nyaris tak terlihat di sisi malam. Paling terasa dari orbit; memudar saat
 * kamera dekat permukaan (di sana kubah langit yang bekerja).
 */
import { AdditiveBlending, Color, FrontSide, Mesh, SphereGeometry, Vector3 } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, cameraPosition, color, dot, float, mix, normalize, oneMinus, positionWorld, pow, smoothstep, uniform } from 'three/tsl';
import { PLANET_RADIUS } from '../config/world';
import { smoothstep as sstep } from '../utils/math';

export const ATMOSPHERE_RADIUS = PLANET_RADIUS + 46;

export class Atmosphere {
  readonly mesh: Mesh;
  private readonly material: MeshBasicNodeMaterial;
  private readonly uSun = uniform(new Vector3(0, 0, 1));
  private readonly uFade = uniform(0);

  constructor() {
    const m = new MeshBasicNodeMaterial({ side: FrontSide, transparent: true, depthWrite: false, blending: AdditiveBlending });
    m.fog = false;
    const n = normalize(positionWorld);
    const v = normalize(cameraPosition.sub(positionWorld));
    const rim = pow(oneMinus(abs(dot(n, v))), float(2.6));
    const sd = dot(n, this.uSun);
    const day = smoothstep(-0.2, 0.4, sd);
    const twilight = smoothstep(-0.32, -0.02, sd).mul(oneMinus(smoothstep(-0.02, 0.32, sd)));
    const blue = color(new Color('#58B4FF'));
    const orange = color(new Color('#FF9A5C'));
    const night = color(new Color('#0E1A44'));
    const col = mix(night.mul(0.25), blue, day).add(orange.mul(twilight.mul(0.9)));
    m.colorNode = col.mul(rim).mul(this.uFade).mul(1.25);
    this.material = m;
    this.mesh = new Mesh(new SphereGeometry(ATMOSPHERE_RADIUS, 72, 48), m);
    this.mesh.name = 'atmosphere';
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
  }

  update(cameraPos: Vector3, sunDir: Vector3): void {
    this.uSun.value.copy(sunDir);
    const alt = cameraPos.length() - PLANET_RADIUS;
    // Muncul saat kamera sudah di luar lapisan atmosfer.
    this.uFade.value = sstep(60, 140, alt);
    this.mesh.visible = this.uFade.value > 0.001;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
