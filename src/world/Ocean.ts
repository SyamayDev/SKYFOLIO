/**
 * Laut (docs/04 bagian 4): bola dengan shader TSL
 * - warna dangkal → dalam dari coast-distance.png, plus bercak warna dalam (noise) supaya tidak polos,
 * - gelombang low-poly dua lapis (displacement titik + flat shading),
 * - garis buih yang bergerak menuju pantai + buih tepat di garis pantai,
 * - kilau matahari dari material standar, kilauan kecil (sparkle) di permukaan.
 */
import { Color, IcosahedronGeometry, LinearFilter, Mesh, type Texture } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  asin,
  atan,
  cameraPosition,
  clamp,
  color,
  distance,
  float,
  fract,
  mix,
  mx_noise_float,
  normalLocal,
  oneMinus,
  positionGeometry,
  positionLocal,
  positionWorld,
  select,
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
  /** Kecerahan (malam dikurangi oleh siklus siang-malam). */
  readonly brightness = uniform(1);

  constructor(coast: Texture, detailLevel: number) {
    coast.generateMipmaps = false;
    coast.minFilter = LinearFilter;
    coast.magFilter = LinearFilter;

    const m = new MeshStandardNodeMaterial({ roughness: 0.48, metalness: 0.0 });
    m.flatShading = true;
    const p = positionGeometry.normalize();
    const lon = atan(p.x, p.z);
    const lat = asin(clamp(p.y, -1, 1));
    const uv = vec2(lon.div(Math.PI * 2).add(0.5), lat.div(Math.PI).add(0.5));
    const dist = texture(coast, uv).r; // 0 di pantai → 1 di 6° lepas pantai
    const shallowK = oneMinus(smoothstep(0.0, 0.3, dist));
    const deep = color(new Color(PALETTE.oceanDeep));
    const deep2 = color(new Color('#1A5FC4'));
    const deep3 = color(new Color('#2A86E6'));
    const shallow = color(new Color(PALETTE.oceanShallow));
    const foamCol = color(new Color(PALETTE.foam));
    const wp = positionWorld;
    const near = oneMinus(smoothstep(40, 300, distance(cameraPosition, wp)));
    // Bercak samudra: arus gelap/terang yang besar.
    const n0 = mx_noise_float(wp.mul(0.018).add(time.mul(0.004)));
    let water = mix(deep, select(n0.greaterThan(0), deep3, deep2), n0.abs().mul(0.55));
    water = mix(water, shallow, shallowK.pow(1.35));
    // Buih pantai: pita tepat di garis pantai + garis-garis buih yang bergerak ke pantai.
    const ripple = sin(time.mul(1.4).add(lon.mul(140)).add(lat.mul(90))).mul(0.006);
    const edgeFoam = smoothstep(float(0.035), float(0.0), dist.add(ripple));
    const band = fract(dist.mul(34).add(time.mul(0.22)));
    const bands = smoothstep(0.86, 0.94, band).mul(oneMinus(smoothstep(0.93, 1.0, band)));
    const bandMask = oneMinus(smoothstep(0.02, 0.11, dist)).mul(near.mul(0.7).add(0.3));
    const bandBreak = smoothstep(-0.2, 0.35, mx_noise_float(wp.mul(0.35)));
    let foam = edgeFoam.mul(0.9).max(bands.mul(bandMask).mul(bandBreak).mul(0.7));
    // Kilauan kecil di laut lepas (topi ombak), hanya dekat kamera.
    const caps = smoothstep(0.62, 0.78, mx_noise_float(wp.mul(0.9).add(time.mul(0.35)))).mul(near).mul(0.35);
    foam = foam.max(caps.mul(smoothstep(0.08, 0.3, dist)));
    m.colorNode = mix(water, foamCol, foam).mul(this.brightness);

    // Gelombang: dua lapis sinus di koordinat dunia (unit), digeser sepanjang normal.
    const P = positionLocal;
    const t = time;
    const wave = sin(P.x.mul(0.33).add(t.mul(1.1)))
      .mul(sin(P.z.mul(0.29).add(t.mul(0.85))))
      .mul(0.11)
      .add(sin(P.y.mul(0.41).sub(t.mul(1.3))).mul(0.06))
      .add(sin(P.x.mul(0.9).add(P.y.mul(0.7)).add(t.mul(1.9))).mul(0.035))
      .mul(this.uWave);
    m.positionNode = positionLocal.add(normalLocal.mul(wave));
    this.material = m;

    this.mesh = new Mesh(new IcosahedronGeometry(PLANET_RADIUS, OCEAN_DETAIL[detailLevel] ?? 40), m);
    this.mesh.name = 'ocean';
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  /** Besar ombak (cuaca). */
  setWaveScale(s: number): void {
    this.uWave.value = s;
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
