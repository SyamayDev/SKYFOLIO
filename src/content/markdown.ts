/**
 * Markdown mini yang aman untuk cerita proyek (docs/08): paragraf, judul, daftar, tebal, miring, kode,
 * dan tautan http(s)/mailto. Semua teks di-escape dulu → tidak ada HTML mentah dari konten.
 */

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeUrl(url: string): string | null {
  const u = url.trim();
  if (/^(https?:\/\/|mailto:)/i.test(u)) return u;
  return null;
}

export function inlineMd(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const safe = safeUrl(url.replace(/&amp;/g, '&'));
    return safe ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
  });
  return s;
}

export function markdownToHtml(md: string): string {
  const clean = md.replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n/g, '\n');
  const blocks = clean.split(/\n{2,}/);
  const out: string[] = [];
  for (const block of blocks) {
    const b = block.trim();
    if (!b) continue;
    const lines = b.split('\n');
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      out.push(`<ul>${lines.map((l) => `<li>${inlineMd(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`);
      continue;
    }
    if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      out.push(`<ol>${lines.map((l) => `<li>${inlineMd(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(lines[0]!);
    if (h && lines.length === 1) {
      const level = Math.min(6, h[1]!.length + 1);
      out.push(`<h${level}>${inlineMd(h[2]!)}</h${level}>`);
      continue;
    }
    out.push(`<p>${lines.map((l) => inlineMd(l.trim())).join('<br>')}</p>`);
  }
  return out.join('\n');
}

/** Teks polos (tanpa markdown) untuk ringkasan, suara Piko, dan paket pengetahuan AI. */
export function markdownToText(md: string): string {
  return md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*`]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Pisahkan cerita proyek dua bahasa. Bagian "## Cerita (ID)" / "## Story (EN)"; judul lain yang mengandung
 * (ID)/(EN) juga dikenali. Bagian tanpa penanda bahasa dianggap Indonesia.
 */
export function splitStory(body: string): { id: string; en: string } {
  const res = { id: '', en: '' };
  const parts = body.split(/^##\s+/m);
  for (const part of parts) {
    if (!part.trim()) continue;
    const nl = part.indexOf('\n');
    const head = nl >= 0 ? part.slice(0, nl) : part;
    const text = nl >= 0 ? part.slice(nl + 1) : '';
    if (/\(EN\)|english|story/i.test(head) && !/\(ID\)/i.test(head)) res.en += `${text}\n`;
    else if (/\(ID\)|cerita|indonesia/i.test(head)) res.id += `${text}\n`;
    else res.id += `${part}\n`;
  }
  return { id: res.id.trim(), en: res.en.trim() };
}
