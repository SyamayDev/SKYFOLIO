/**
 * Material medan planet (docs/04 bagian 4): warna dasar per muka dari build-earth + detail prosedural
 * per piksel di shader TSL, supaya permukaan terasa detail tanpa menambah segitiga.
 *
 * - Bercak padang rumput (noise lebar + noise halus yang memudar dengan jarak, mencegah kedip/aliasing).
 * - Ladang tambal-sulam: sel 3D yang dibengkokkan noise → warna tanaman acak, alur tanam, pagar semak.
 * - Pita pantai berpasir tepat di garis air (dari tinggi per piksel) + pasir basah.
 * - Salju puncak mengikuti garis salju per lintang (tidak mengikuti tepi segitiga).
 * - Strata batu, riak gurun, lantai hutan berbintik.
 *
 * aux (vec4, unorm8): x = kepadatan hutan, y = ladang, z = kelas×32/255.
 */
import { Color } from 'three';
import { MeshToonNodeMaterial } from 'three/webgpu';
import { uSeason, uWet } from './WorldState';
import {
  abs,
  attribute,
  cameraPosition,
  color,
  distance,
  dot,
  float,
  floor,
  fract,
  length,
  min,
  mix,
  mx_cell_noise_float,
  mx_noise_float,
  normalView,
  normalize,
  oneMinus,
  positionViewDirection,
  positionWorld,
  pow,
  select,
  sin,
  smoothstep,
  uniform,
  vec3,
} from 'three/tsl';
import { PALETTE } from '../config/palette';
import { PLANET_RADIUS } from '../config/world';
import { rimColor, rimStrength, toonGradient } from '../utils/modeling/materials';

export type TerrainDetail = 'low' | 'high';

/** Kecerahan malam lampu kota dll. diatur Fase 2; di sini cukup pengali global. */
export const terrainSnowBoost = uniform(0);

const C = (hex: string): Color => new Color(hex);

export function createTerrainMaterial(detail: TerrainDetail): MeshToonNodeMaterial {
  const m = new MeshToonNodeMaterial({ gradientMap: toonGradient() });
  m.name = `terrain-${detail}`;
  const hi = detail === 'high';

  const fresnel = pow(oneMinus(dot(normalView, positionViewDirection).abs()), float(3));
  m.emissiveNode = color(rimColor).mul(fresnel).mul(rimStrength.mul(0.55));

  const p = positionWorld;
  const up = normalize(p);
  const h = length(p).sub(PLANET_RADIUS);
  const base = attribute('color', 'vec3');
  const aux = attribute('aux', 'vec4');
  const forest = aux.x;
  const farm = aux.y;
  const cls = aux.z.mul(255 / 32).round();
  const is = (c: number) => select(cls.equal(c), float(1), float(0));
  const isLake = is(2);
  const isSnow = is(3);
  const isRock = is(4);
  const isDesert = is(5);
  const isAirport = is(6);

  // Detail halus memudar dengan jarak supaya tidak berkedip di kejauhan.
  const near = oneMinus(smoothstep(35, 260, distance(cameraPosition, p)));
  const n1 = mx_noise_float(p.mul(0.42));
  const n2 = hi ? mx_noise_float(p.mul(1.9)) : float(0);

  let col = base.mul(n1.mul(0.07).add(1));
  if (hi) col = col.mul(n2.mul(0.045).mul(near).add(1));

  // --- Ladang tambal-sulam
  const fp = p.mul(0.34).add(vec3(n1.mul(0.22), n1.mul(-0.17), n1.mul(0.12)));
  const cell = floor(fp);
  const r1 = mx_cell_noise_float(cell);
  const wheat = color(C('#E8D27E'));
  const young = color(C('#AEDD70'));
  const green = color(C('#7CCB66'));
  const soil = color(C('#C9A46F'));
  const bloom = color(C('#E9C46A'));
  const crop = mix(mix(wheat, young, smoothstep(0.24, 0.26, r1)), mix(green, mix(soil, bloom, smoothstep(0.9, 0.92, r1)), smoothstep(0.8, 0.82, r1)), smoothstep(0.52, 0.54, r1));
  let cropCol = crop;
  if (hi) {
    const r2 = mx_cell_noise_float(cell.add(17.31));
    const r3 = mx_cell_noise_float(cell.add(-5.7));
    const rowDir = normalize(vec3(r1.sub(0.5), r2.sub(0.5), r3.sub(0.5)));
    const rows = sin(dot(p, rowDir).mul(11)).mul(0.5).add(0.5);
    cropCol = crop.mul(rows.mul(0.13).mul(near).add(0.935));
  }
  // Pagar semak di batas sel, hanya pada sumbu yang tidak sejajar permukaan.
  const f = fract(fp);
  const ax = abs(up);
  const big = float(9);
  const ex = select(ax.x.greaterThan(0.62), big, min(f.x, oneMinus(f.x)));
  const ey = select(ax.y.greaterThan(0.62), big, min(f.y, oneMinus(f.y)));
  const ez = select(ax.z.greaterThan(0.62), big, min(f.z, oneMinus(f.z)));
  const edge = min(min(ex, ey), ez);
  const farmMask = smoothstep(0.22, 0.5, farm).mul(oneMinus(isAirport));
  col = mix(col, cropCol, farmMask.mul(0.9));
  const hedge = oneMinus(smoothstep(0.025, 0.055, edge)).mul(farmMask).mul(near.mul(0.6).add(0.4));
  col = mix(col, color(C('#4E9E55')), hedge.mul(0.85));

  // --- Lantai hutan berbintik (lebih gelap, sedikit kebiruan)
  const fmask = smoothstep(0.3, 0.9, forest);
  col = col.mul(oneMinus(fmask.mul(n2.mul(0.06).add(0.05))));

  if (hi) {
    // --- Strata batu: garis mendatar mengikuti ketinggian.
    const strata = smoothstep(0.4, 0.5, fract(h.mul(1.6).add(n1.mul(0.4)))).mul(oneMinus(smoothstep(0.5, 0.62, fract(h.mul(1.6).add(n1.mul(0.4))))));
    col = col.mul(oneMinus(isRock.mul(strata).mul(0.13)));
    // --- Riak gurun searah angin.
    const ripple = sin(dot(p, vec3(0.83, 0.12, 0.55)).mul(3.6).add(n1.mul(3))).mul(0.5).add(0.5);
    col = col.mul(isDesert.mul(ripple.sub(0.5)).mul(0.09).mul(near).add(1));
  }

  // --- Salju puncak per lintang: tropis hanya puncak tertinggi, makin rendah ke kutub.
  const sinLat = abs(up.y);
  // Musim: belahan yang sedang musim dingin punya garis salju lebih rendah (uSeason dari WorldState).
  const snowLine = mix(float(15.6), float(9.6), smoothstep(0.38, 0.86, sinLat)).add(up.y.mul(uSeason).mul(2.4));
  const snowK = smoothstep(snowLine.sub(0.7), snowLine.add(0.25), h.add(n1.mul(0.55))).mul(oneMinus(isLake));
  const snowCol = mix(color(C(PALETTE.snow)), color(C('#DCEAFF')), n1.max(0).mul(0.7));
  col = mix(col, snowCol, snowK.max(isSnow.mul(0.85)).max(terrainSnowBoost.mul(oneMinus(isLake))));

  // --- Pantai: pita pasir di garis air + pasir basah.
  const beachH = h.add(n1.mul(0.12)).add(n2.mul(0.05));
  const beach = oneMinus(smoothstep(0.42, 0.8, beachH)).mul(oneMinus(isLake)).mul(oneMinus(isAirport));
  const wet = oneMinus(smoothstep(0.03, 0.26, h));
  const sandCol = mix(color(C(PALETTE.sand)), color(C('#DDB679')), wet);
  col = mix(col, sandCol, beach);

  // Setelah hujan: permukaan lebih gelap dan sedikit kebiruan (basah).
  col = mix(col, col.mul(vec3(0.78, 0.83, 0.92)), uWet.mul(0.85));
  m.colorNode = col;
  return m;
}
