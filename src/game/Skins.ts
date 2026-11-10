/**
 * Skin pesawat (docs/09 bagian 3). Versi SKYFOLIO: cat prosedural pada pesawat PK-ARL (badan, aksen, garis)
 * — model & fisika tetap sama supaya semua zona, kanopi, dan kit roket tetap berfungsi (lihat docs/decisions.md).
 * Skin dibuka oleh achievement; pilihan tersimpan di progres.
 */
import { bus } from '../core/EventBus';
import { patchProgress, progress } from './Progress';

export interface SkinDef {
  id: string;
  /** Achievement yang membuka skin ini (null = bawaan). */
  unlock: string | null;
  paint: { body: string; accent: string; trim: string } | null;
  secret?: boolean;
}

export const SKINS: SkinDef[] = [
  { id: 'toyplane', unlock: null, paint: null },
  { id: 'amphibian', unlock: 'island-hopper', paint: { body: '#DDF3F7', accent: '#2F8FA6', trim: '#FFC93C' } },
  { id: 'paper', unlock: 'project-collector', paint: { body: '#FFFFFF', accent: '#C7D0DC', trim: '#3AA0FF' } },
  { id: 'jet', unlock: 'around-the-world', paint: { body: '#DCE2EA', accent: '#5D6178', trim: '#E5484D' } },
  { id: 'rocket', unlock: 'edge-of-space', paint: { body: '#FFFFFF', accent: '#E5484D', trim: '#2B2D42' } },
  { id: 'ufo', unlock: 'moonwalker', paint: { body: '#B8F2C9', accent: '#6C7BD9', trim: '#DCE2EA' } },
  { id: 'balloon', unlock: 'landmark-tourist', paint: { body: '#FFE08A', accent: '#FF7A45', trim: '#B5374A' } },
  { id: 'phoenix', unlock: 'phoenix', paint: { body: '#FFB347', accent: '#E5484D', trim: '#FFE08A' }, secret: true },
  { id: 'gold', unlock: 'true-captain', paint: { body: '#FFD870', accent: '#C9962E', trim: '#8A6A2E' } },
];

export function skinById(id: string): SkinDef | undefined {
  return SKINS.find((s) => s.id === id);
}

/** Buka skin yang terkait achievement `achId` (mengembalikan id skin bila baru terbuka). */
export function unlockSkinFor(achId: string): string | null {
  const s = SKINS.find((x) => x.unlock === achId);
  if (!s || progress.get().unlockedSkins.includes(s.id)) return null;
  patchProgress((p) => {
    p.unlockedSkins = [...p.unlockedSkins, s.id];
  });
  return s.id;
}

/** Pakai skin (hanya yang sudah terbuka). */
export function equipSkin(id: string): boolean {
  if (!skinById(id) || !progress.get().unlockedSkins.includes(id)) return false;
  patchProgress((p) => {
    p.skin = id;
  });
  bus.emit('skin:equip', { id });
  return true;
}
