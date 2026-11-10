/**
 * Parser & penulis YAML subset untuk frontmatter proyek (content/projects/*.md).
 * Ditulis sendiri karena pustaka YAML populer membawa dependensi berlisensi di luar daftar yang diizinkan
 * (CLAUDE.md aturan 12). Subset yang didukung — cukup untuk format frontmatter SKYFOLIO dan Hangar:
 *   key: nilai            (string tanpa/bertanda kutip, angka, true/false, null, ~)
 *   key:                  (diikuti blok berindentasi: map bersarang atau daftar "- item")
 *   key: [a, b, 'c d']    (daftar sebaris)
 *   key: {}  / key: []    (map/daftar kosong)
 *   # komentar dan komentar di akhir baris
 */

export type YamlValue = string | number | boolean | null | YamlValue[] | { [k: string]: YamlValue };

interface Line {
  indent: number;
  text: string;
  no: number;
}

function stripComment(s: string): string {
  let q: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (q) {
      if (c === q && s[i - 1] !== '\\') q = null;
    } else if (c === '"' || c === "'") q = c;
    else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]!))) return s.slice(0, i).trimEnd();
  }
  return s.trimEnd();
}

function splitInline(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q: string | null = null;
  let depth = 0;
  for (const c of s) {
    if (q) {
      cur += c;
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") {
      q = c;
      cur += c;
    } else if (c === '[' || c === '{') {
      depth++;
      cur += c;
    } else if (c === ']' || c === '}') {
      depth--;
      cur += c;
    } else if (c === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function parseScalar(raw: string): YamlValue {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === '[]') return [];
  if (s === '{}') return {};
  if (s.startsWith('[') && s.endsWith(']')) return splitInline(s.slice(1, -1)).map(parseScalar);
  if (s.startsWith('{') && s.endsWith('}')) {
    const obj: Record<string, YamlValue> = {};
    for (const part of splitInline(s.slice(1, -1))) {
      const i = part.indexOf(':');
      if (i > 0) obj[unquote(part.slice(0, i).trim())] = parseScalar(part.slice(i + 1));
    }
    return obj;
  }
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return unquote(s);
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

function unquote(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n');
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  return s;
}

export class YamlError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(`${message} (baris ${line})`);
  }
}

export function parseYaml(text: string): Record<string, YamlValue> {
  const lines: Line[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const noComment = stripComment(raw);
    if (!noComment.trim()) return;
    const indent = noComment.length - noComment.trimStart().length;
    lines.push({ indent, text: noComment.trim(), no: i + 1 });
  });
  let pos = 0;

  const parseBlock = (indent: number): YamlValue => {
    const first = lines[pos];
    if (!first) return null;
    if (first.text.startsWith('- ') || first.text === '-') {
      const arr: YamlValue[] = [];
      while (pos < lines.length && lines[pos]!.indent === indent && (lines[pos]!.text.startsWith('- ') || lines[pos]!.text === '-')) {
        const l = lines[pos]!;
        const rest = l.text.slice(1).trim();
        pos++;
        if (!rest) arr.push(parseBlock(lines[pos]?.indent ?? indent + 2));
        else if (/^[^'"[{][^:]*:\s/.test(rest) || /^[^'"[{][^:]*:$/.test(rest)) {
          // "- key: value" → map yang dimulai di baris yang sama.
          const fake: Line = { indent: indent + 2, text: rest, no: l.no };
          lines.splice(pos, 0, fake);
          arr.push(parseBlock(indent + 2));
        } else arr.push(parseScalar(rest));
      }
      return arr;
    }
    const obj: Record<string, YamlValue> = {};
    while (pos < lines.length && lines[pos]!.indent === indent) {
      const l = lines[pos]!;
      const i = l.text.indexOf(':');
      if (i <= 0) throw new YamlError(`Baris tidak dikenali: "${l.text}"`, l.no);
      const key = unquote(l.text.slice(0, i).trim());
      const rest = l.text.slice(i + 1).trim();
      pos++;
      if (rest) obj[key] = parseScalar(rest);
      else if (pos < lines.length && lines[pos]!.indent > indent) obj[key] = parseBlock(lines[pos]!.indent);
      else if (pos < lines.length && lines[pos]!.indent === indent && lines[pos]!.text.startsWith('- ')) obj[key] = parseBlock(indent);
      else obj[key] = null;
    }
    if (pos < lines.length && lines[pos]!.indent > indent) throw new YamlError('Indentasi tidak konsisten', lines[pos]!.no);
    return obj;
  };

  if (!lines.length) return {};
  const root = parseBlock(lines[0]!.indent);
  if (pos < lines.length) throw new YamlError('Indentasi tidak konsisten', lines[pos]!.no);
  if (!root || Array.isArray(root) || typeof root !== 'object') throw new YamlError('Frontmatter harus berupa map', 1);
  return root;
}

function quoteIfNeeded(s: string): string {
  if (s === '' || /^[\s]|[\s]$|^[-?:,[\]{}#&*!|>'"%@`]|: | #|^(true|false|null|~|-?\d+(\.\d+)?)$/.test(s) || s.includes('\n')) {
    return `'${s.replace(/'/g, "''")}'`;
  }
  return s;
}

function scalarToYaml(v: YamlValue): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  if (typeof v === 'string') return quoteIfNeeded(v);
  if (Array.isArray(v)) return `[${v.map(scalarToYaml).join(', ')}]`;
  return '{}';
}

export function stringifyYaml(obj: Record<string, YamlValue>, indent = 0): string {
  const pad = ' '.repeat(indent);
  let out = '';
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (Object.keys(v).length === 0) out += `${pad}${k}: {}\n`;
      else out += `${pad}${k}:\n${stringifyYaml(v, indent + 2)}`;
    } else if (Array.isArray(v) && v.some((x) => x && typeof x === 'object')) {
      out += `${pad}${k}:\n`;
      for (const item of v) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const inner = stringifyYaml(item, indent + 4).split('\n').filter(Boolean);
          out += `${pad}  - ${inner[0]!.trim()}\n`;
          for (const line of inner.slice(1)) out += `${line}\n`;
        } else out += `${pad}  - ${scalarToYaml(item)}\n`;
      }
    } else out += `${pad}${k}: ${scalarToYaml(v)}\n`;
  }
  return out;
}

/** Pisahkan frontmatter (antara baris `---`) dari isi markdown. */
export function splitFrontmatter(text: string): { data: Record<string, YamlValue>; body: string } {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { data: {}, body: text };
  return { data: parseYaml(m[1]!), body: m[2]! };
}
