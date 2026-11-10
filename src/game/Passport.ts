/**
 * Paspor (docs/09 bagian 1): pengelompokan stempel per wilayah dan warna stempel unik (deterministik).
 */
import { hashString } from '../utils/rng';

export const REGIONS = ['indonesia', 'asia', 'europe', 'africa', 'america', 'oceania', 'space'] as const;
export type Region = (typeof REGIONS)[number];

export function regionOfLandmark(lat: number, lon: number): Region {
  if (lat > -11.5 && lat < 6.5 && lon > 94 && lon < 141.5) return 'indonesia';
  if (lon < -25) return 'america';
  if (lat < -10 && lon > 110) return 'oceania';
  if (lat > 35 && lon > -25 && lon < 45) return 'europe';
  if (lon > -20 && lon < 52 && lat < 35) return 'africa';
  return 'asia';
}

export function regionOfZone(id: string, lat?: number, lon?: number): Region {
  if (id === 'orbit' || id === 'moon') return 'space';
  // Zona di sekitar bandara Medan (termasuk pulau pos di lautnya) dihitung Indonesia walau koordinat mainannya di luar.
  if (id === 'journey-stream' || id === 'sky-circuit' || id === 'project-archipelago' || id === 'post-office' || id === 'control-tower') return 'indonesia';
  if (lat == null || lon == null) return 'indonesia';
  if (id === 'gym-island') return 'oceania';
  return regionOfLandmark(lat, lon);
}

const COLORS = ['#E5484D', '#2F8FA6', '#3DCB7A', '#E8A33D', '#6C7BD9', '#B05FD0', '#D9774A', '#3AA0FF'];
export function stampColor(id: string): string {
  return COLORS[hashString(id) % COLORS.length]!;
}
