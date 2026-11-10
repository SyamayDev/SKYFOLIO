/**
 * Laut (docs/04 bagian 4, versi awal): bola dengan shader TSL
 * - warna dangkal → dalam dari coast-distance.png,
 * - gelombang low-poly (displacement titik + flat shading),
 * - buih bergerak di garis pantai,
 * - kilau matahari dari material standar.
 */
import { Color, IcosahedronGeometry, LinearFilter, Mesh, type Texture } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  asin,
  atan,
  clamp,
  color,
  float,
  mix,
  normalLocal,
  oneMinus,
  positionGeometry,
  positionLocal,
  sin,
  smoothstep,
  texture,
  time,
  uniform,
  vec2,
} from 'three/tsl';
import { PALETTE } from '../config/palette';
import { PLANET_RADIUS } from '../config/world';

export const OCEAN_DETAIL: Record<number, number> = { 4: 26, 5: 40, 6: 56 };

export class Ocean {
  readonly mesh: Mesh;
  readonly material: MeshStandardNodeMaterial;
  private readonly uWave = uniform(1);

  constructor(coast: Texture, detailLevel: number) {
    coast.generateMipmaps = false;
    coast.minFilter = LinearFilter;
    coast.magFilter = LinearFilter;

    const m = new MeshStandardNodeMaterial({ roughness: 0.32, metalness: 0.0 });
    m.flatShading = true;
    const p = positionGeometry.normalize();
    const lon = atan(p.x, p.z);
    const lat = asin(clamp(p.y, -1, 1));
    const uv = vec2(lon.div(Math.PI * 2).add(0.5), lat.div(Math.PI).add(0.5));
    const dist = texture(coast, uv).r; // 0 di pantai → 1 di 6° lepas pantai
    const shallowK = oneMinus(smoothstep(0.0, 0.32, dist));
    const deep = color(new Color(PALETTE.oceanDeep));
    const shallow = color(new Color(PALETTE.oceanShallow));
    const foamCol = color(new Color(PALETTE.foam));
    const ripple = sin(time.mul(1.4).add(lon.mul(140)).add(lat.mul(90))).mul(0.006);
    const foam = smoothstep(float(0.03), float(0.0), dist.add(ripple)).mul(0.9);
    m.colorNode = mix(mix(deep, shallow, shallowK.pow(1.4)), foamCol, foam);

    // Gelombang: jumlah sinus di koordinat dunia (unit), digeser sepanjang normal.
    const P = positionLocal;
    const t = time;
    const wave = sin(P.x.mul(0.33).add(t.mul(1.1)))
      .mul(sin(P.z.mul(0.29).add(t.mul(0.85))))
      .mul(0.11)
      .add(sin(P.y.mul(0.41).sub(t.mul(1.3))).mul(0.06))
      .mul(this.uWave);
    m.positionNode = positionLocal.add(normalLocal.mul(wave));
    this.material = m;

    this.mesh = new Mesh(new IcosahedronGeometry(PLANET_RADIUS, OCEAN_DETAIL[detailLevel] ?? 40), m);
    this.mesh.name = 'ocean';
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  setDetail(level: number): void {
    const detail = OCEAN_DETAIL[level] ?? 40;
    const geo = this.mesh.geometry as IcosahedronGeometry;
    if (geo.parameters.detail === detail) return;
    geo.dispose();
    this.mesh.geometry = new IcosahedronGeometry(PLANET_RADIUS, detail);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
