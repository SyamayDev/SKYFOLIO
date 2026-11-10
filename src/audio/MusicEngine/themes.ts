/**
 * Tema Syamay FM (docs/05 bagian 4.4). Semua melodi di sini DIKOMPOSISI ORIGINAL untuk SKYFOLIO
 * (bukan transkripsi lagu mana pun): lompatan pentatonik lebar, tanya-jawab suling ↔ kacapi, rasa "mars kecil".
 *
 * Notasi melodi: satu token = satu not 1/8. Angka 1–5 = derajat tangga nada pentatonik,
 * `'` = satu oktaf ke atas, `,` = satu oktaf ke bawah, `-` = tahan, `.` = diam. `|` hanya pemisah birama.
 * Pola kendang (16 langkah/birama): D dung, T tak, K ketipung, P pak, . diam.
 */
export type ScaleName = 'majorPent' | 'salendro' | 'degung' | 'minorPent' | 'hijaz';

/** Tangga nada (cent dari nada dasar). Pelog degung & salendro: perkiraan, bukan ukuran baku. */
export const SCALES: Record<ScaleName, number[]> = {
  majorPent: [0, 200, 400, 700, 900],
  salendro: [0, 240, 480, 720, 960],
  degung: [0, 120, 520, 680, 800],
  minorPent: [0, 300, 500, 700, 1000],
  hijaz: [0, 100, 400, 500, 700, 800, 1000],
};

export type ThemeId =
  | 'preflight'
  | 'home'
  | 'adventure'
  | 'mountain'
  | 'journey'
  | 'city'
  | 'lab'
  | 'stage'
  | 'kitchen'
  | 'gym'
  | 'fort'
  | 'party'
  | 'lantern'
  | 'race'
  | 'space'
  | 'moon'
  | 'arrival';

export interface Theme {
  id: ThemeId;
  bpm: number;
  scale: ScaleName;
  /** Nada dasar (Hz) oktaf melodi. */
  root: number;
  /** Dua frasa 4 birama (A lalu B), dimainkan A A' B B' dengan variasi generatif. */
  phrases: [string, string];
  kendang: string;
  /** Drum modern: kick tiap ketukan / setengah / tidak ada. */
  kick: 'four' | 'half' | 'none';
  clap: boolean;
  hats: boolean;
  /** Akor pad: progresi derajat mayor (I vi IV V) atau dengung nada dasar saja. */
  harmony: 'pop' | 'drone';
  /** Kirim ke gema (0..1). */
  reverb: number;
  /** Lapisan ornamen (angklung + arpeggio kacapi) selalu aktif. */
  busy?: boolean;
  /** Instrumen melodi utama. */
  lead: 'suling' | 'kacapi' | 'pluck';
  /** Intensitas minimum tema ini. */
  floor: number;
}

const HOME_A = '1 . 3 4 5 - 4 3 | 4 - 1\' - 5 4 3 . | 3 4 5 1\' 2\' - 1\' 5 | 4 - - 3 4 - . .';
const HOME_B = '5 . 5 4 3 4 5 1\' | 2\' - 1\' 5 4 - 3 4 | 5 3 4 2 3 1 2 . | 1 - - - . . 5, 1';

export const THEMES: Record<ThemeId, Theme> = {
  preflight: {
    id: 'preflight', bpm: 100, scale: 'degung', root: 293.66,
    phrases: ['1 . . . 1 . 2 . | 3 . . . 3 . 5 . | 4 . . . 3 . 2 . | 1 - - - . . . .', '1 . 3 . 5 . 1\' . | 5 - 4 - 3 - 5 - | 4 . 3 . 2 . 3 . | 1 - - - - - . .'],
    kendang: 'D.......T.....K.', kick: 'half', clap: false, hats: false, harmony: 'drone', reverb: 0.3, lead: 'suling', floor: 0.2,
  },
  home: {
    id: 'home', bpm: 124, scale: 'majorPent', root: 293.66, phrases: [HOME_A, HOME_B],
    kendang: 'D..T.KT.D.T.K.P.', kick: 'four', clap: true, hats: true, harmony: 'pop', reverb: 0.18, lead: 'suling', floor: 0.3,
  },
  adventure: {
    id: 'adventure', bpm: 128, scale: 'majorPent', root: 293.66, phrases: [HOME_A, HOME_B],
    kendang: 'D.KT.KT.D.TKD.PK', kick: 'four', clap: true, hats: true, harmony: 'pop', reverb: 0.18, busy: true, lead: 'suling', floor: 0.45,
  },
  mountain: {
    id: 'mountain', bpm: 96, scale: 'salendro', root: 329.63,
    phrases: ['1 - - - 3 - 4 - | 5 - - - - - 4 3 | 4 - - - 2 - 3 - | 1 - - - - - . .', '3 - 5 - 1\' - - - | 2\' - 1\' - 5 - - - | 4 - 3 - 2 - 3 - | 1 - - - - - - .'],
    kendang: 'D.......D...T...', kick: 'half', clap: false, hats: false, harmony: 'drone', reverb: 0.45, lead: 'suling', floor: 0.25,
  },
  journey: {
    id: 'journey', bpm: 112, scale: 'majorPent', root: 261.63,
    phrases: ['1 2 3 . 3 4 5 . | 5 4 3 2 3 - . . | 2 3 4 . 4 5 1\' . | 5 4 3 4 5 - . .', '1\' 5 4 5 1\' - 2\' . | 1\' 5 4 3 4 - . . | 3 4 5 4 3 2 1 2 | 3 - 1 - . . . .'],
    kendang: 'D...T...D.D.T...', kick: 'half', clap: true, hats: true, harmony: 'pop', reverb: 0.2, lead: 'kacapi', floor: 0.35,
  },
  city: {
    id: 'city', bpm: 118, scale: 'majorPent', root: 277.18,
    phrases: ['1 . 1 3 . 4 . 3 | . 1 . 5, 1 . . . | 4 . 4 5 . 1\' . 5 | . 4 . 3 4 . . .', '5 . 1\' . 5 4 . 3 | . 4 . 5 . . 3 . | 2 . 3 . 4 . 3 2 | 1 . . . . . . .'],
    kendang: 'D..K..T.D.K.T..P', kick: 'four', clap: true, hats: true, harmony: 'pop', reverb: 0.15, lead: 'pluck', floor: 0.4,
  },
  lab: {
    id: 'lab', bpm: 104, scale: 'degung', root: 311.13,
    phrases: ['1 . 2 . 1 . 5, . | 3 . . 2 1 . . . | 1 . 2 . 3 . 4 . | 5 . 4 . 3 . . .', '5 4 . 5 4 . 3 . | 2 . 1 . 2 . . . | 4 . 4 3 . 2 . 1 | . . 5, . 1 . . .'],
    kendang: 'K.K.T..PK.K.T...', kick: 'half', clap: true, hats: false, harmony: 'drone', reverb: 0.25, lead: 'pluck', floor: 0.35,
  },
  stage: {
    id: 'stage', bpm: 120, scale: 'majorPent', root: 293.66,
    phrases: ['1 . 1 3 . 4 . 3 | . 1 . 5, 1 . . . | 4 . 4 5 . 1\' . 5 | . 4 . 3 4 . . .', HOME_B],
    kendang: 'D.P.T.P.D.P.T.PP', kick: 'four', clap: true, hats: true, harmony: 'pop', reverb: 0.2, lead: 'suling', floor: 0.55,
  },
  kitchen: {
    id: 'kitchen', bpm: 110, scale: 'majorPent', root: 329.63,
    phrases: ['5 4 . 5 4 . 3 . | 2 . 1 . 2 . . . | 4 . 4 3 . 2 . 1 | . . 5, . 1 . . .', '1 . 2 . 3 . 4 . | 5 . 4 . 3 . . . | 1 . 2 . 1 . 5, . | 3 . . 2 1 . . .'],
    kendang: 'D.K.T.K.D.K.TKPK', kick: 'half', clap: true, hats: true, harmony: 'pop', reverb: 0.15, lead: 'pluck', floor: 0.4,
  },
  gym: {
    id: 'gym', bpm: 128, scale: 'minorPent', root: 293.66,
    phrases: ['1 3 5 3 4 5 1\' 5 | 4 3 4 5 3 - . . | 5 1\' 2\' 1\' 5 4 5 3 | 4 5 4 3 2 - . .', '1\' 1\' 5 5 4 4 5 . | 1\' 2\' 1\' 5 4 - . . | 3 4 5 3 4 2 3 1 | 2 3 2 5, 1 - . .'],
    kendang: 'D.T.D.T.D.T.DDTT', kick: 'four', clap: true, hats: true, harmony: 'drone', reverb: 0.12, lead: 'pluck', floor: 0.6,
  },
  fort: {
    id: 'fort', bpm: 116, scale: 'majorPent', root: 261.63,
    phrases: ['1 . . . 1 . 2 . | 3 . . . 3 . 5 . | 4 . . . 3 . 2 . | 1 - - - . . . .', '1 . 3 . 5 . 1\' . | 5 - 4 - 3 - 5 - | 4 . 3 . 2 . 3 . | 1 - - - - - . .'],
    kendang: 'D...P...D.D.P...', kick: 'half', clap: false, hats: false, harmony: 'pop', reverb: 0.2, lead: 'suling', floor: 0.45,
  },
  party: {
    id: 'party', bpm: 124, scale: 'majorPent', root: 293.66,
    phrases: ['1 2 3 . 3 4 5 . | 5 4 3 2 3 - . . | 2 3 4 . 4 5 1\' . | 5 4 3 4 5 - . .', HOME_B],
    kendang: 'D.KTD.KTD.KTD.PT', kick: 'four', clap: true, hats: true, harmony: 'pop', reverb: 0.18, busy: true, lead: 'kacapi', floor: 0.65,
  },
  lantern: {
    id: 'lantern', bpm: 78, scale: 'degung', root: 293.66,
    phrases: ['1 - 2 - 3 - - - | 5 - 4 - 3 - - - | 2 - 3 - 1 - - - | 5, - - - - - . .', '3 - 4 - 5 - - - | 1\' - 5 - 4 - - - | 3 - 2 - 3 - 4 - | 1 - - - - - . .'],
    kendang: 'D...............', kick: 'none', clap: false, hats: false, harmony: 'drone', reverb: 0.5, lead: 'kacapi', floor: 0.2,
  },
  race: {
    id: 'race', bpm: 140, scale: 'majorPent', root: 293.66,
    phrases: ['1 3 5 3 4 5 1\' 5 | 4 3 4 5 3 - . . | 5 1\' 2\' 1\' 5 4 5 3 | 4 5 4 3 2 - . .', '1\' 1\' 5 5 4 4 5 . | 1\' 2\' 1\' 5 4 - . . | 3 4 5 3 4 2 3 1 | 2 3 2 5, 1 - . .'],
    kendang: 'DKTKDKTKDKTPDKTK', kick: 'four', clap: true, hats: true, harmony: 'pop', reverb: 0.12, busy: true, lead: 'suling', floor: 0.75,
  },
  space: {
    id: 'space', bpm: 72, scale: 'salendro', root: 293.66,
    phrases: ['1 - - - . . . . | 5 - - - . . . . | 4 - - 3 - - . . | 1 - - - - - - -', '3 - - - . . . . | 1\' - - - . . . . | 5 - - 4 - - . . | 3 - - - - - - -'],
    kendang: '................', kick: 'none', clap: false, hats: false, harmony: 'drone', reverb: 0.75, lead: 'kacapi', floor: 0.15,
  },
  moon: {
    id: 'moon', bpm: 60, scale: 'degung', root: 293.66,
    phrases: ['1 - - - - - - - | 3 - - - 2 - - - | 1 - - - - - - - | . . . . . . . .', '5, - - - 1 - - - | 2 - - - 3 - - - | 1 - - - - - - - | . . . . . . . .'],
    kendang: '................', kick: 'none', clap: false, hats: false, harmony: 'drone', reverb: 0.8, lead: 'suling', floor: 0.05,
  },
  arrival: {
    id: 'arrival', bpm: 92, scale: 'majorPent', root: 293.66,
    phrases: ['5, . 1 2 3 - 2 1 | 2 - 3 - 5 - . . | 4 . 3 2 1 - 2 3 | 1 - - - . . . .', '3 . 4 5 1\' - 5 4 | 5 - 4 3 2 - . . | 3 . 2 1 2 - 3 5, | 1 - - - - - - .'],
    kendang: 'D.......T...D...', kick: 'half', clap: false, hats: true, harmony: 'pop', reverb: 0.3, lead: 'suling', floor: 0.3,
  },
};

/** Zona → tema (docs/05 tabel 4.4). */
export const ZONE_THEME: Record<string, ThemeId> = {
  'home-airport': 'home',
  'control-tower': 'home',
  'post-office': 'home',
  'lantern-valley': 'lantern',
  'project-archipelago': 'adventure',
  'skill-peaks': 'mountain',
  'journey-stream': 'journey',
  'contribution-city': 'city',
  'hangar-lab': 'lab',
  'mc-stage': 'stage',
  'aril-kitchen': 'kitchen',
  'gym-island': 'gym',
  'fort-village': 'fort',
  'block-park': 'party',
  'sky-circuit': 'race',
  orbit: 'space',
  moon: 'moon',
};

export interface Note {
  /** Langkah 1/16 dari awal frasa. */
  step: number;
  /** Panjang dalam langkah 1/16. */
  len: number;
  degree: number;
  octave: number;
}

/** Ubah notasi melodi menjadi not (posisi dalam 1/16). */
export function parsePhrase(src: string): { notes: Note[]; steps: number } {
  const tokens = src.split(/\s+/).filter((t) => t && t !== '|');
  const notes: Note[] = [];
  tokens.forEach((tok, i) => {
    if (tok === '-') {
      const last = notes[notes.length - 1];
      if (last && last.step + last.len === i * 2) last.len += 2;
      return;
    }
    if (tok === '.') return;
    const m = /^([1-7])([',]*)$/.exec(tok);
    if (!m) throw new Error(`Token melodi tidak dikenal: ${tok}`);
    const oct = (m[2]!.match(/'/g)?.length ?? 0) - (m[2]!.match(/,/g)?.length ?? 0);
    notes.push({ step: i * 2, len: 2, degree: Number(m[1]) - 1, octave: oct });
  });
  return { notes, steps: tokens.length * 2 };
}

/** Frekuensi derajat `degree` (0-based) pada tangga nada `scale` dari `root`. */
export function degreeFreq(root: number, scale: ScaleName, degree: number, octave = 0): number {
  const sc = SCALES[scale];
  const n = sc.length;
  const oct = octave + Math.floor(degree / n);
  const d = ((degree % n) + n) % n;
  return root * Math.pow(2, oct + sc[d]! / 1200);
}
