/**
 * Palet SKYFOLIO (docs/04 bagian 2). Dipakai shader, model prosedural, dan CSS (lewat variabel di ui/theme.css).
 */
export const PALETTE = {
  skyDayTop: '#4DB8FF',
  skyDayHorizon: '#BDE8FF',
  skySunsetTop: '#6C7BD9',
  skySunsetHorizon: '#FFB27A',
  skyNightTop: '#0B1640',
  skyNightHorizon: '#27306B',
  oceanDeep: '#1E6FD9',
  oceanShallow: '#3FD0E0',
  foam: '#F4FFFF',
  sand: '#F6D99A',
  grassTropic: '#5CCB5F',
  grassTemperate: '#8BD45A',
  grassBoreal: '#3E9B5B',
  desert: '#F2B66D',
  redRock: '#D9774A',
  rock: '#9C8F86',
  snow: '#F7FBFF',
  ice: '#CDEBFF',
  cream: '#FFF6E6',
  sun: '#FFC93C',
  sky: '#3AA0FF',
  berry: '#FF5A5F',
  leaf: '#3DCB7A',
  ink: '#2B2D42',
  lantern: '#FFB347',
  city1: '#FFF4E0',
  city2: '#FFD6A5',
  city3: '#A0C4FF',
  city4: '#FFADAD',
  city5: '#CAFFBF',
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** Warna tambahan (turunan palet) untuk detail model. */
export const EXTRA = {
  lake: '#4FC3E8',
  runway: '#5B6170',
  runwayMark: '#FFFFFF',
  trunk: '#9A6A45',
  leafDark: '#2FA35A',
  palmLeaf: '#4CC46A',
  pine: '#2E8A5A',
  skin: '#FFD3B0',
  skinShade: '#F2B994',
  hair: '#3B2A22',
  cheek: '#FF9AA2',
  metal: '#C9CED6',
  rubber: '#3A3D4A',
  glass: '#BFE9FF',
  wood: '#C98B55',
  white: '#FFFFFF',
} as const;

export function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
