/**
 * Penyaring lokal untuk teks pengunjung (lampion, nama di papan skor) — docs/06 bagian 8.
 * Dipakai server DAN klien (supaya pengunjung langsung tahu kalau pesannya ditolak).
 * Daftar sengaja ringkas: kata kasar umum ID & EN dalam bentuk dasar; pencocokan menoleransi
 * angka pengganti huruf (4→a, 1→i, 0→o, 3→e, 5→s) dan huruf berulang.
 */
const BAD = [
  // Indonesia
  'anjing', 'anjg', 'anjir', 'bangsat', 'bajingan', 'babi', 'kontol', 'memek', 'ngentot', 'entot', 'jancok', 'jancuk', 'cok',
  'goblok', 'tolol', 'bego', 'kampret', 'tai', 'taik', 'perek', 'lonte', 'pelacur', 'setan', 'brengsek', 'keparat', 'asu',
  'pantek', 'puki', 'pukimak', 'kimak', 'bodat', 'ngewe', 'sange', 'bokep',
  // English
  'fuck', 'fuk', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'pussy', 'cunt', 'slut', 'whore', 'nigger', 'nigga', 'fag',
  'retard', 'porn', 'sex', 'rape', 'nazi',
];

function squash(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/4/g, 'a')
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/3/g, 'e')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't')
    .replace(/(.)\1+/g, '$1');
}

export interface Verdict {
  ok: boolean;
  reason?: 'empty' | 'too_long' | 'link' | 'phone' | 'bad_word';
}

/** Cek teks pendek (default maks. 30 karakter, aturan lampion). */
export function moderateText(text: string, maxLen = 30): Verdict {
  const t = text.trim();
  if (!t) return { ok: false, reason: 'empty' };
  if ([...t].length > maxLen) return { ok: false, reason: 'too_long' };
  if (/(https?:\/\/|www\.|\.(com|id|net|org|io|co|xyz|me|link|ly)\b)/i.test(t)) return { ok: false, reason: 'link' };
  if ((t.match(/\d/g) ?? []).length >= 7) return { ok: false, reason: 'phone' };
  const sq = squash(t);
  const words = sq.split(/[^a-z]+/).filter(Boolean);
  const joined = sq.replace(/[^a-z]/g, '');
  for (const b of BAD) {
    const bb = squash(b);
    // Kata pendek (≤ 3 huruf, mis. "tai", "asu", "cok") hanya bila berdiri sendiri; yang panjang juga bila tersambung.
    if (words.includes(bb) || (bb.length >= 5 && joined.includes(bb))) return { ok: false, reason: 'bad_word' };
  }
  return { ok: true };
}
