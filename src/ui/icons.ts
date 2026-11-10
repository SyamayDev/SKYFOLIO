/**
 * Set ikon SKYFOLIO (buatan sendiri, grid 24×24, garis 2 px membulat). Satu sumber untuk komponen
 * Icon.svelte dan untuk kanvas (peta globe, penanda 3D) lewat Path2D — supaya tampilan sama di semua
 * perangkat (emoji tampil berbeda-beda, bahkan jadi kotak di sebagian HP/PC).
 */
export interface IconPart {
  d: string;
  fill?: boolean;
}

/** Roda gigi 8 gigi (dibangkitkan supaya simetris). */
function cog(): string {
  const pts: string[] = [];
  const teeth = 8;
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 4 < 2 ? 9 : 6.6;
    pts.push(`${(12 + Math.cos(a) * r).toFixed(2)} ${(12 + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join('L')}z`;
}

const c = (cx: number, cy: number, r: number): string => `M${cx + r} ${cy}a${r} ${r} 0 1 1 ${-2 * r} 0a${r} ${r} 0 1 1 ${2 * r} 0`;

export const ICONS = {
  map: [{ d: 'M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z' }, { d: 'M9 4v13.5M15 6.5V20' }],
  passport: [{ d: 'M6 3h11.5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z' }, { d: c(11.75, 10, 3.6) }, { d: 'M8.15 10h7.2M11.75 6.4c1.3 1.9 1.3 5.3 0 7.2M11.75 6.4c-1.3 1.9-1.3 5.3 0 7.2M8.5 17h6.5' }],
  camera: [{ d: 'M4 8h3l2-2.5h6L17 8h3v11H4z' }, { d: c(12, 13, 3.5) }],
  pause: [{ d: 'M7 5h3.2v14H7zM13.8 5H17v14h-3.2z', fill: true }],
  play: [{ d: 'M8 5.2l11 6.8-11 6.8z', fill: true }],
  close: [{ d: 'M6.5 6.5l11 11M17.5 6.5l-11 11' }],
  gear: [{ d: cog() }, { d: c(12, 12, 2.8) }],
  compass: [{ d: c(12, 12, 9) }, { d: 'M15.8 8.2l-2.3 5.3-5.3 2.3 2.3-5.3z', fill: true }],
  rocket: [{ d: 'M12 2.5c3 2 4.8 5.6 4.8 9.6L15 16H9l-1.8-3.9c0-4 1.8-7.6 4.8-9.6z' }, { d: c(12, 9.5, 1.6) }, { d: 'M7.2 12.4L4.5 15l2.8 1.2M16.8 12.4l2.7 2.6-2.8 1.2M10 18.5l2 3 2-3' }],
  boost: [{ d: 'M6 12.5l6-6 6 6M6 18.5l6-6 6 6' }],
  brake: [{ d: c(12, 12, 8.5) }, { d: 'M8 12h8' }],
  horn: [{ d: 'M4 10v4h3l6 4V6l-6 4z' }, { d: 'M16.2 9.2a4 4 0 0 1 0 5.6M18.6 6.8a7.4 7.4 0 0 1 0 10.4' }],
  tap: [{ d: 'M9.5 11V5.2a1.6 1.6 0 0 1 3.2 0V10M12.7 9.6a1.6 1.6 0 0 1 3.2 0v1.2M15.9 10.6a1.6 1.6 0 0 1 3.1.4v3.4a6.4 6.4 0 0 1-6.4 6.4h-.7a5.5 5.5 0 0 1-4.4-2.2l-2.9-3.9a1.6 1.6 0 0 1 2.5-2l2.6 2.6' }],
  mail: [{ d: 'M3.5 6h17v12h-17z' }, { d: 'M3.8 6.5L12 12.5l8.2-6' }],
  external: [{ d: 'M14 4h6v6M20 4l-8.5 8.5' }, { d: 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5' }],
  star: [{ d: 'M12 3.2l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.4-4.2 6-.9z', fill: true }],
  info: [{ d: c(12, 12, 9) }, { d: 'M12 11v5.5M12 7.6v.4' }],
  music: [{ d: 'M9 17.5V6.2l10-2.2v11.3' }, { d: c(6.8, 17.5, 2.2) }, { d: c(16.8, 15.3, 2.2) }],
  globe: [{ d: c(12, 12, 9) }, { d: 'M3 12h18M12 3c3.2 3.2 3.2 14.8 0 18M12 3c-3.2 3.2-3.2 14.8 0 18' }],
  back: [{ d: 'M15 5l-7 7 7 7' }],
  next: [{ d: 'M9 5l7 7-7 7' }],
  arrow: [{ d: 'M5 12h14M13 6l6 6-6 6' }],
  sun: [{ d: c(12, 12, 4) }, { d: 'M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6' }],
  moon: [{ d: 'M19.5 14.5A8 8 0 1 1 9.5 4.5a6.3 6.3 0 0 0 10 10z' }],
  rain: [{ d: 'M7 15a4 4 0 0 1-.4-8A5.6 5.6 0 0 1 17.3 8.6 3.3 3.3 0 0 1 17 15z' }, { d: 'M8.5 18l-1 2.2M12.5 18l-1 2.2M16.5 18l-1 2.2' }],
  wrench: [{ d: 'M14.8 3.6a5 5 0 0 0-4.2 6.8L3.8 17.2a1.9 1.9 0 0 0 2.7 2.7l6.8-6.8a5 5 0 0 0 6.8-4.2l-2.9 1.5-2.7-.9-.9-2.7z' }],
  user: [{ d: c(12, 8, 3.6) }, { d: 'M5 20.5c.9-4 3.8-6 7-6s6.1 2 7 6' }],
  trophy: [{ d: 'M8 4h8v5.5a4 4 0 0 1-8 0z' }, { d: 'M8 6H5.2a3 3 0 0 0 3.2 4.2M16 6h2.8a3 3 0 0 1-3.2 4.2M12 13.5v3.5M9 20.5h6M10 17h4v3.5h-4z' }],
  home: [{ d: 'M4 11.2l8-7 8 7' }, { d: 'M6.2 9.6V20h11.6V9.6M10 20v-5h4v5' }],
  refresh: [{ d: 'M19.5 11a7.6 7.6 0 1 0-2.2 5.4' }, { d: 'M19.8 4.6v6.2h-6.2' }],
  check: [{ d: 'M5 12.5l4.5 4.5L19 7.5' }],
  plane: [{ d: 'M12 2.8c.9 0 1.4.9 1.4 2.4v3.9l7 4.1v2l-7-2.1v4l2 1.5v1.6l-3.4-.9-3.4.9v-1.6l2-1.5v-4l-7 2.1v-2l7-4.1V5.2c0-1.5.5-2.4 1.4-2.4z', fill: true }],
  takeoff: [{ d: 'M3 20.5h18' }, { d: 'M4.5 14.8l2.4-.9 2.6 1.6 3.4-2.4L7.4 8.9l2.2-.8 6.7 3.1 3.1-2.1a1.5 1.5 0 0 1 1.7 2.5L8.2 17.8z', fill: true }],
  pin: [{ d: 'M12 21s-6.8-6.3-6.8-11.2a6.8 6.8 0 0 1 13.6 0C18.8 14.7 12 21 12 21z' }, { d: c(12, 9.8, 2.4) }],
  tower: [{ d: 'M9.2 21l1-10.5h3.6l1 10.5' }, { d: 'M7.5 10.5h9l-1.2-4.2H8.7zM12 6.3V3M10 15.5h4M6.5 21h11' }],
  lantern: [{ d: 'M9 5h6M12 2.8V5' }, { d: 'M7 10a5 5 0 0 1 10 0v3.8a5 5 0 0 1-10 0z' }, { d: 'M10 18.6V21h4v-2.4M7.2 12h9.6' }],
  island: [{ d: 'M3 19.3c3-1.8 6-1.8 9 0s6 1.8 9 0' }, { d: 'M12.5 18c0-4.8 1-7.6 2-9.6M14.5 8.4c-2-2.9-5.8-2.8-7.7-.9M14.5 8.4c2-2.7 5.8-2 6.8.9M14.5 8.4c.2-2.9-1.6-4.8-4.6-5' }],
  mountain: [{ d: 'M2.5 19.5l6.5-11 4 6.2 2.2-3 6.3 7.8z' }, { d: 'M7.4 11.2l1.6-2.7 1.5 2.3' }],
  wind: [{ d: 'M3 9h11.5a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7' }],
  city: [{ d: 'M3 21h18M4.5 21V9.5h5.5V21M10 21V4h7v17M17 21v-8.5h3V21' }, { d: 'M6.5 12.5h1.5M6.5 15.5h1.5M12.5 7h2M12.5 10h2M12.5 13h2M12.5 16h2' }],
  volcano: [{ d: 'M3 20.5l6-9.5h6l6 9.5z' }, { d: 'M10 8.3c0-1.8 1.8-2.2 1.8-4.3M14 8.3c0-1.4 1.4-1.9 1.4-3.4' }],
  mic: [{ d: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z' }, { d: 'M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6' }],
  pan: [{ d: 'M3 12h12a6 6 0 0 1-12 0zM15 12h6.5' }, { d: 'M7 8.4c0-1.3 1.2-1.6 1.2-3.2M11 8.4c0-1.3 1.2-1.6 1.2-3.2' }],
  dumbbell: [{ d: 'M6.5 7.5v9M4 10v4M17.5 7.5v9M20 10v4M6.5 12h11' }],
  castle: [{ d: 'M4 21V10h2.2V7.2h2.2V10h2.2V7.2h2.8V10h2.2V7.2h2.2V10H20v11z' }, { d: 'M10 21v-3.8a2 2 0 0 1 4 0V21' }],
  blocks: [{ d: 'M4 13.2h7v7H4zM13 13.2h7v7h-7zM8.5 4.6h7v8.6h-7z' }],
  flag: [{ d: 'M5.5 21V3.5M5.5 4h12.5l-2.2 4.2 2.2 4.3H5.5' }, { d: 'M9.5 4v8.5M13.6 4v8.5M5.5 8.2h12', fill: false }],
  satellite: [{ d: 'M10 10h4v4h-4zM2.8 10.4h4.6v3.2H2.8zM16.6 10.4h4.6v3.2h-4.6zM7.4 12H10M14 12h2.6M12 10V7' }, { d: 'M9.4 6.8a2.6 2.6 0 0 1 5.2 0' }],
  code: [{ d: 'M8 7.5L3.5 12 8 16.5M16 7.5l4.5 4.5-4.5 4.5M13.6 5.5l-3.2 13' }],
  gamepad: [{ d: 'M7.5 8.5h9a4.5 4.5 0 0 1 4.5 4.5v1.2a2.8 2.8 0 0 1-5 1.7L14.6 14H9.4L8 15.9a2.8 2.8 0 0 1-5-1.7V13a4.5 4.5 0 0 1 4.5-4.5z' }, { d: 'M8 10.8v3.6M6.2 12.6h3.6M15.5 11.6v.2M17.8 13.4v.2' }],
  keyboard: [{ d: 'M3 7h18v10H3z' }, { d: 'M6.5 10.2h.5M9.5 10.2h.5M12.5 10.2h.5M15.5 10.2h.5M18 10.2h.5M7.5 13.8h9' }],
  sparkle: [{ d: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', fill: true }, { d: 'M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z', fill: true }],
  sound: [{ d: 'M4 10v4h3l5.5 4V6L7 10z' }, { d: 'M15.5 9a4 4 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11' }],
  phone: [{ d: 'M8 2.8h8a1.2 1.2 0 0 1 1.2 1.2v16a1.2 1.2 0 0 1-1.2 1.2H8A1.2 1.2 0 0 1 6.8 20V4A1.2 1.2 0 0 1 8 2.8z' }, { d: 'M11 18.2h2' }],
  rotate: [{ d: 'M4 12a8 8 0 0 1 13.7-5.6L20 8.6' }, { d: 'M20 4v4.6h-4.6M20 12a8 8 0 0 1-13.7 5.6L4 15.4M4 20v-4.6h4.6' }],
  file: [{ d: 'M6 3h8l4 4v14H6z' }, { d: 'M14 3v4h4M9 12h6M9 15h6M9 18h4' }],
  chat: [{ d: 'M4 5h16v11H9.5L4 20z' }, { d: 'M8 9.5h8M8 12.5h5' }],
  clapper: [{ d: 'M4 9.5h16V20H4z' }, { d: 'M4 9.5l1.6-4.8 13.6 2-1 2.8M9 5.3l-1.4 4.2M14 6l-1.4 3.5' }],
  warn: [{ d: 'M12 3.5l9.5 16.5h-19z' }, { d: 'M12 10v4.5M12 17v.4' }],
  photo: [{ d: 'M4 6h16v13H4z' }, { d: c(9, 10.5, 1.6) }, { d: 'M4.5 17.5l5-5 3.5 3.5 2.5-2.5 4 4' }],
  heart: [{ d: 'M12 20s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z' }],
} satisfies Record<string, IconPart[]>;

export type IconName = keyof typeof ICONS;

/** Ikon tiap zona (radar, peta, penanda). */
export const ZONE_ICONS: Record<string, IconName> = {
  'home-airport': 'takeoff',
  'control-tower': 'tower',
  'post-office': 'mail',
  'lantern-valley': 'lantern',
  'project-archipelago': 'island',
  'skill-peaks': 'mountain',
  'journey-stream': 'wind',
  'contribution-city': 'city',
  'hangar-lab': 'volcano',
  'mc-stage': 'mic',
  'aril-kitchen': 'pan',
  'gym-island': 'dumbbell',
  'fort-village': 'castle',
  'block-park': 'blocks',
  'sky-circuit': 'flag',
  orbit: 'satellite',
  moon: 'moon',
};

export function isIconName(v: string | undefined | null): v is IconName {
  return !!v && v in ICONS;
}

const pathCache = new Map<string, Path2D>();

/** Gambar ikon di kanvas 2D (pusat x,y; ukuran px). */
export function drawIcon(g: CanvasRenderingContext2D, name: IconName, x: number, y: number, size: number, color: string): void {
  const s = size / 24;
  g.save();
  g.translate(x - size / 2, y - size / 2);
  g.scale(s, s);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 2.2;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const part of ICONS[name] as IconPart[]) {
    let p = pathCache.get(part.d);
    if (!p) {
      p = new Path2D(part.d);
      pathCache.set(part.d, p);
    }
    if (part.fill) g.fill(p);
    else g.stroke(p);
  }
  g.restore();
}
