/**
 * Kode cuaca WMO (dipakai Open-Meteo) → profil cuaca SKYFOLIO (docs/04 bagian 7).
 * Fungsi murni supaya mudah diuji.
 */
export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

export interface WeatherProfile {
  kind: WeatherKind;
  /** 0..1 intensitas hujan. */
  rain: number;
  /** 0..1 intensitas salju. */
  snow: number;
  /** 0..1 badai (petir, awan gelap). */
  storm: number;
  /** 0..1 tutupan awan. */
  cloud: number;
  /** 0..1 kabut. */
  fog: number;
}

const P = (kind: WeatherKind, rain: number, snow: number, storm: number, cloud: number, fog = 0): WeatherProfile => ({ kind, rain, snow, storm, cloud, fog });

export function wmoToProfile(code: number): WeatherProfile {
  switch (code) {
    case 0:
      return P('clear', 0, 0, 0, 0.1);
    case 1:
      return P('clear', 0, 0, 0, 0.25);
    case 2:
      return P('partly', 0, 0, 0, 0.55);
    case 3:
      return P('cloudy', 0, 0, 0, 0.9);
    case 45:
    case 48:
      return P('fog', 0, 0, 0, 0.7, 0.85);
    case 51:
      return P('drizzle', 0.2, 0, 0, 0.8, 0.2);
    case 53:
      return P('drizzle', 0.3, 0, 0, 0.85, 0.25);
    case 55:
    case 56:
    case 57:
      return P('drizzle', 0.4, 0, 0, 0.9, 0.3);
    case 61:
    case 80:
      return P('rain', 0.45, 0, 0, 0.85);
    case 63:
    case 81:
    case 66:
      return P('rain', 0.7, 0, 0.1, 0.92);
    case 65:
    case 82:
    case 67:
      return P('rain', 1, 0, 0.25, 1);
    case 71:
    case 85:
    case 77:
      return P('snow', 0, 0.45, 0, 0.85);
    case 73:
      return P('snow', 0, 0.7, 0, 0.9);
    case 75:
    case 86:
      return P('snow', 0, 1, 0, 1);
    case 95:
      return P('storm', 0.85, 0, 0.8, 1);
    case 96:
    case 99:
      return P('storm', 1, 0, 1, 1);
    default:
      return P('partly', 0, 0, 0, 0.5);
  }
}

/** Profil untuk pilihan cuaca manual di Pengaturan. */
export function manualProfile(kind: string): WeatherProfile {
  switch (kind) {
    case 'cloudy':
      return wmoToProfile(3);
    case 'rain':
      return wmoToProfile(63);
    case 'storm':
      return wmoToProfile(95);
    case 'snow':
      return wmoToProfile(73);
    case 'fog':
      return wmoToProfile(45);
    default:
      return wmoToProfile(0);
  }
}

/** Kecepatan angin nyata (km/j) → unit dunia per detik (1 unit/dtk ≈ 4 km/j di HUD, angin dilunakkan supaya tetap enak diterbangi). */
export function windKmhToUnits(kmh: number): number {
  return Math.min(6, Math.max(0, kmh) * 0.25 * 0.6);
}
