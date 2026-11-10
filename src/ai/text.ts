/** Utilitas teks untuk router intent lokal (dua bahasa, toleran salah ketik). */

/** Huruf kecil, tanpa diakritik & tanda baca, spasi tunggal. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/[-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set([
  // ID
  'kak', 'dong', 'ya', 'yuk', 'aja', 'saja', 'ga', 'gak', 'nggak', 'enggak', 'kan', 'tuh', 'minta', 'coba', 'ayo', 'tolong', 'aku', 'saya', 'gue', 'gw', 'ke', 'di', 'dan', 'yang', 'itu', 'ini', 'nya', 'apa', 'sih', 'deh', 'nih', 'lah', 'kah', 'mau', 'pengen', 'ingin', 'bisa', 'boleh', 'si', 'piko', 'aril', 'kakak', 'punya', 'tentang', 'ada', 'gimana', 'bagaimana', 'tunjukkan', 'lihat',
  // EN
  'the', 'a', 'an', 'to', 'of', 'please', 'me', 'my', 'is', 'are', 'what', 'about', 'can', 'you', 'i', 'want', 'his', 'he', 'does', 'do', 'show', 'tell', 'let', 'lets', 'us', 'some', 'aril', 'piko', 'your',
]);

/** Akhiran percakapan Indonesia yang tidak mengubah makna kata (hobinya → hobi, kontaknya → kontak). */
function stem(w: string): string {
  for (const suf of ['nya', 'lah', 'kah', 'pun']) if (w.length > suf.length + 3 && w.endsWith(suf)) return w.slice(0, -suf.length);
  return w;
}

export function tokens(s: string, keepStop = false): string[] {
  const t = normalize(s).split(' ').filter(Boolean).map(stem);
  return keepStop ? t : t.filter((w) => !STOP.has(w));
}

/** Jarak Damerau-Levenshtein (transposisi bersebelahan dihitung 1). */
export function damerau(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (!n) return m;
  if (!m) return n;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => {
    const row = new Array<number>(m + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= m; j++) d[0]![j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[n]![m]!;
}

/** Dua kata dianggap sama bila jaraknya kecil dibanding panjangnya. */
export function wordMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const len = Math.min(a.length, b.length);
  if (len < 4) return false;
  if (a.startsWith(b) || b.startsWith(a)) return len >= 5;
  // Salah ketik jarang mengubah huruf pertama; tanpa syarat ini "pendapat" dianggap sama dengan "mendarat".
  if (a[0] !== b[0]) return false;
  return damerau(a, b) <= (len >= 8 ? 2 : 1);
}

/**
 * Skor 0..1 seberapa baik `phrase` tercakup oleh `text`: porsi kata frasa (tanpa kata umum) yang muncul
 * di teks (toleran salah ketik). Frasa yang muncul utuh → 1.
 */
export function phraseScore(text: string, phrase: string): number {
  const nt = ` ${normalize(text)} `;
  const np = normalize(phrase);
  if (!np) return 0;
  if (nt.includes(` ${np} `)) {
    // Frasa utuh, tapi kalimatnya jauh lebih panjang → tetap dikurangi sedikit.
    const extraWords = Math.max(0, tokens(text).length - tokens(np).length);
    return 1 - (extraWords >= 2 ? Math.min(0.4, extraWords * 0.09) : 0);
  }
  const pt = tokens(np);
  const tt = tokens(text);
  if (!pt.length || !tt.length) return 0;
  let hit = 0;
  for (const w of pt) if (tt.some((x) => wordMatch(x, w))) hit++;
  const cover = hit / pt.length;
  // Teks jauh lebih panjang dari frasa → dikurangi (kemungkinan pertanyaan lain yang kebetulan memuat kata itu).
  const extra = Math.max(0, tt.length - pt.length);
  return cover * (1 - Math.min(0.45, extra * 0.07));
}
