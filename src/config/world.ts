/**
 * Konstanta dunia — sumber tunggal (CLAUDE.md bagian 5).
 * Dipakai oleh klien DAN oleh scripts/build-earth.ts, jadi file ini tidak boleh mengimpor DOM.
 */

export const PLANET_RADIUS = 400;
export const TERRAIN_MAX_HEIGHT = 18;
export const SKILL_PEAK_MAX_HEIGHT = 42;
export const CLOUD_LAYER = { min: 445, max: 470 } as const;
export const CRUISE_ALTITUDE = 430;
export const STRATOSPHERE_START = 520;
export const SPACE_START = 600;
export const ORBIT_RING = 660;
export const MOON_DISTANCE = 2000;
export const MOON_RADIUS = 60;

/** Lantai laut padat (jaring pengaman supaya benda tidak jatuh ke pusat planet). */
export const SEA_FLOOR_RADIUS = PLANET_RADIUS - 3;
/** Di bawah radius ini benda dianggap "tembus" dan di-respawn. */
export const FALL_THROUGH_RADIUS = PLANET_RADIUS - 8;
/** Lebih jauh dari ini dari pusat = keluar sistem → respawn otomatis. */
export const OUT_OF_BOUNDS_RADIUS = 3500;

/** Kota asal Aril (sama dengan content/world/zones.json → home-airport). */
export const HOME = { lat: 3.5952, lon: 98.6722 } as const;

/**
 * Bandara Medan.
 * Skala planet membuat 1° ≈ 7 unit, jadi landasan 60 unit membentang ±8,6°, lebih besar dari Sumatra Utara
 * dan akan menimpa Danau Toba. Karena itu landasan dibuat 40 unit dan diletakkan sebagai pulau bandara
 * reklamasi memanjang di mulut Selat Malaka (utara Aceh–Medan), sehingga Danau Toba tetap utuh di selatannya. Lihat docs/decisions.md.
 *
 * Koordinat lokal (lihat world/AirportLayout.ts): along = sepanjang landasan (+ = arah lepas landas),
 * side = menyamping (+ = kanan saat menghadap arah lepas landas, yaitu sisi daratan Sumatra).
 */
export const AIRPORT = {
  /** Titik tengah landasan. */
  lat: 7.2,
  lon: 97.7,
  /** Arah lepas landas (derajat dari utara, searah jarum jam): dari ujung barat laut ke tenggara. */
  headingDeg: 150,
  length: 40,
  width: 7,
  /** Tinggi permukaan bandara di atas laut. */
  elevation: 1.4,
  /** Area datar = gabungan persegi panjang lokal [alongMin, alongMax, sideMin, sideMax]. */
  flatRects: [
    [-23, 23, -7, 5], // landasan + bahu kiri (laut) + bahu kanan
    [-23, 14, 5, 8], // bahu kanan lebar di paruh barat laut (ujung tenggara dekat Danau Toba dibiarkan)
    [-22, -2, 8, 14], // apron: hangar, koper, kantong angin (sisi kanan, arah Aceh)
    [8, 19, 8, 14], // plaza landmark Medan (Istana Maimun & Masjid Raya versi sederhana)
  ] as readonly (readonly [number, number, number, number])[],
  /** Lebar transisi dari datar ke medan/pantai asli (unit). */
  blendWidth: 5,
} as const;

/** Danau Toba dibesar-besarkan supaya terlihat dari udara (data aslinya terlalu kecil di skala ini). */
export const TOBA = {
  lat: 2.6,
  lon: 98.86,
  /** Sumbu panjang danau sejajar arah ini (derajat dari utara). */
  axisDeg: 145,
  semiMajorDeg: 0.8,
  semiMinorDeg: 0.33,
  surfaceHeight: 5.2,
  samosir: { lat: 2.58, lon: 98.83, semiMajorDeg: 0.38, semiMinorDeg: 0.13, height: 6.6 },
} as const;

/**
 * Wilayah dengan jaring medan lebih rapat (setiap muka icosphere level 7 dibagi `subdivisions`²):
 * seluruh Indonesia + Semenanjung Malaysia, supaya pulau-pulau tanah air dan bandara terlihat detail.
 */
export const DETAIL_REGION = { latMin: -11.5, latMax: 8.5, lonMin: 94, lonMax: 141.5, subdivisions: 3 } as const;

/** Data biner planet dikuantisasi relatif radius ini. */
export const EARTH_QUANT_RADIUS = PLANET_RADIUS + TERRAIN_MAX_HEIGHT + 4;

/** Kepadatan udara: ρ(alt) = exp(−alt / AIR_DENSITY_SCALE). */
export const AIR_DENSITY_SCALE = 90;

/** Angin global sementara (Fase 2 akan mengambil dari sistem cuaca). Unit/detik, arah dari timur laut. */
export const BASE_WIND = { speed: 1.6, fromBearingDeg: 45 } as const;
