/**
 * Router intent lokal Piko (docs/06 bagian 2.1): gratis, instan, offline. Menangani navigasi, proyek,
 * skill, kontak, CV, cuaca/waktu, radio, tur, basa-basi, dan FAQ — supaya kuota AI gratis awet.
 * Semua jawaban berasal dari Knowledge/FAQ (isi content/), tidak ada teks karangan.
 */
import type { Knowledge } from './knowledge';
import { normalize, phraseScore, tokens, wordMatch } from './text';

export type Lang = 'id' | 'en';
export interface CopilotAction {
  tool: string;
  args: Record<string, unknown>;
}
export interface RouteResult {
  intent: string;
  confidence: number;
  say: string;
  actions: CopilotAction[];
}
export interface FaqEntry {
  id: string;
  patterns: { id: string[]; en: string[] };
  answer: { id: string | null; en: string | null };
  action?: { tool: string; args: Record<string, unknown> };
}

interface Entity {
  kind: 'zone' | 'project' | 'landmark' | 'space' | 'moon' | 'featured' | 'skill';
  id: string;
  names: string[];
  label: { id: string; en: string };
}

/** Sinonim zona dua bahasa (nama resmi diambil dari konten, ini tambahan percakapan). */
const ZONE_ALIASES: Record<string, string[]> = {
  'home-airport': ['bandara', 'airport', 'landasan', 'runway', 'rumah', 'home', 'medan'],
  'control-tower': ['menara', 'menara kontrol', 'tower', 'control tower', 'profil', 'profile', 'tentang aril'],
  'post-office': ['kantor pos', 'pos', 'post office', 'kotak surat', 'mailbox', 'kontak', 'contact'],
  'lantern-valley': ['danau toba', 'toba', 'lampion', 'lantern', 'lantern valley', 'lembah lampion'],
  'project-archipelago': ['kepulauan proyek', 'pulau proyek', 'proyek', 'projects', 'project islands', 'archipelago'],
  'skill-peaks': ['pegunungan skill', 'gunung skill', 'skill', 'skills', 'skill peaks', 'gunung'],
  'journey-stream': ['arus perjalanan', 'perjalanan', 'journey', 'journey stream', 'timeline', 'jet stream'],
  'contribution-city': ['kota kontribusi', 'kota', 'contribution city', 'github city', 'kontribusi'],
  'hangar-lab': ['hangar', 'hangar eksperimen', 'kawah', 'kawah nekat', 'lab', 'crater', 'volcano', 'gunung api'],
  'mc-stage': ['panggung', 'panggung mc', 'mc stage', 'stage', 'mc'],
  'aril-kitchen': ['dapur', 'dapur aril', 'kitchen', 'masak', 'cooking'],
  'gym-island': ['gym', 'pulau gym', 'gym island', 'barbel', 'fitness'],
  'fort-village': ['benteng', 'desa benteng', 'fort', 'fort village', 'castle'],
  'block-park': ['taman balok', 'balok', 'block park', 'blocks'],
  'sky-circuit': ['sirkuit', 'sirkuit langit', 'balapan', 'sky circuit', 'race', 'racing', 'cincin'],
};

const NAV_ID = ['antar', 'antarkan', 'bawa', 'terbang ke', 'pergi ke', 'ke ', 'menuju', 'kunjungi', 'tunjukkan', 'lihat', 'arahkan'];
const NAV_EN = ['take me', 'fly to', 'go to', 'bring me', 'show me', 'visit', 'head to', 'navigate', 'lets go', 'travel to'];
const BEST = ['terbaik', 'unggulan', 'favorit', 'paling bagus', 'andalan', 'best', 'featured', 'top', 'favorite', 'proudest', 'greatest'];

const pick = (t: { id: string | null; en: string | null } | { id: string; en: string }, lang: Lang): string => (lang === 'id' ? t.id || t.en : t.en || t.id) ?? '';

export class IntentRouter {
  private readonly entities: Entity[] = [];

  constructor(
    private readonly k: Knowledge,
    private readonly faq: FaqEntry[],
  ) {
    for (const z of k.zones) {
      if (z.id === 'orbit' || z.id === 'moon') continue;
      this.entities.push({ kind: 'zone', id: z.id, names: [z.name.id, z.name.en, ...(ZONE_ALIASES[z.id] ?? [])].map(normalize), label: z.name });
    }
    for (const p of k.projects) {
      const names = [p.title, p.id.replace(/-/g, ' '), p.title.replace(/[-\s]?\d+(\.\d+)?$/, '')];
      if (p.fullTitle) names.push(p.fullTitle.id, p.fullTitle.en);
      this.entities.push({ kind: 'project', id: p.id, names: names.map(normalize).filter((n) => n.length >= 3), label: { id: p.title, en: p.title } });
    }
    for (const l of k.landmarks) this.entities.push({ kind: 'landmark', id: l.id, names: [l.name.id, l.name.en].map(normalize), label: l.name });
    this.entities.push({ kind: 'moon', id: 'moon', names: ['bulan', 'moon', 'the moon', 'lunar'], label: { id: 'Bulan', en: 'the Moon' } });
    this.entities.push({ kind: 'space', id: 'space', names: ['angkasa', 'luar angkasa', 'antariksa', 'orbit', 'space', 'outer space'], label: { id: 'angkasa', en: 'space' } });
  }

  /** Entitas terbaik yang disebut di teks (skor 0..1). */
  private findEntity(text: string): { e: Entity; score: number } | null {
    let best: { e: Entity; score: number } | null = null;
    for (const e of this.entities) {
      for (const n of e.names) {
        let s = phraseScore(text, n);
        // Nama satu kata pendek (mis. "pos", "mc") harus muncul utuh.
        if (n.length <= 3 && !` ${normalize(text)} `.includes(` ${n} `)) s = 0;
        // Nama proyek lebih spesifik daripada alias zona yang umum.
        if (e.kind === 'project' || e.kind === 'landmark') s *= 1.02;
        if (!best || s > best.score) best = { e, score: s };
      }
    }
    return best && best.score >= 0.75 ? best : null;
  }

  route(raw: string, lang: Lang): RouteResult | null {
    const text = normalize(raw);
    if (!text) return null;
    const words = tokens(text, true);
    const has = (list: string[]): boolean => list.some((w) => (w.endsWith(' ') ? ` ${text} `.includes(` ${w}`) : ` ${text} `.includes(` ${w} `)) || words.some((x) => !w.includes(' ') && wordMatch(x, w)));
    const L = (id: string, en: string): string => (lang === 'id' ? id : en);
    const P = this.k.profile;

    // --- Basa-basi
    if (/^(halo+|hai+|hi+|hello|hey|hei|pagi|siang|sore|malam|selamat (pagi|siang|sore|malam)|assalamualaikum|good (morning|afternoon|evening))( piko| kak)?$/.test(text)) {
      return this.done('greet', 1, L('Halo, Kak! Aku Piko. Mau ke mana kita hari ini?', 'Hi, Captain! I\'m Piko. Where shall we fly today?'), [{ tool: 'emote', args: { type: 'wave' } }]);
    }
    if (/\b(makasih|terima kasih|trims|thanks|thank you|thx|mantap|keren|bagus|cool|awesome|nice)\b/.test(text) && words.length <= 5) {
      return this.done('thanks', 1, L('Sama-sama, Kak! Piko senang bisa bantu.', "You're welcome, Captain! Happy to help."), [{ tool: 'emote', args: { type: 'cheer' } }]);
    }

    const nav = has(lang === 'id' ? NAV_ID : NAV_EN) || has(lang === 'id' ? NAV_EN : NAV_ID);
    const best = has(BEST);

    // --- Proyek terbaik/unggulan
    if (best && /proyek|project|karya|work|app|aplikasi|portofolio|portfolio/.test(text)) {
      const f = this.k.projects.filter((p) => p.featuredRank).sort((a, b) => (a.featuredRank ?? 9) - (b.featuredRank ?? 9))[0];
      if (f) return this.done('best-project', 0.95, L(`Proyek unggulan Kak Aril: ${f.title}! ${pick(f.summary, 'id')} Ayo ke pulaunya!`, `Aril's featured project: ${f.title}! ${pick(f.summary, 'en')} Let's fly to its island!`), [{ tool: 'fly_to_project', args: { projectId: 'featured:1' } }]);
    }

    // --- Cuaca & waktu (perintah)
    const weatherCmd = this.weatherCommand(text);
    if (weatherCmd) return weatherCmd(lang);
    const timeCmd = this.timeCommand(text);
    if (timeCmd) return timeCmd(lang);

    // --- Radio
    const station = this.k.stations.find((s) => s !== 'syamay' && new RegExp(`\\b${s}\\b`).test(text)) ?? (/\bsyamay\b/.test(text) ? 'syamay' : null);
    if (station && (/radio|putar|play|ganti|change|musik|music|fm|setel/.test(text) || words.length <= 3)) {
      const name = `${station.charAt(0).toUpperCase()}${station.slice(1)} FM`;
      return this.done('radio', 0.95, L(`Siap, Piko putar ${name}!`, `On it, playing ${name}!`), [{ tool: 'play_radio', args: { stationId: station } }]);
    }

    // --- Tur
    if (/\b(tur|tour|rekruter|recruiter|hrd|recruitment)\b/.test(text)) {
      return this.done('tour', 0.95, L('Siap! Tur singkat tentang Kak Aril dimulai.', "Ready! Starting the quick tour about Aril."), [{ tool: 'start_tour', args: { kind: 'recruiter' } }]);
    }

    // --- FAQ dulu bila tidak ada kata kerja navigasi ("kontaknya?" → jawaban kontak, bukan langsung terbang).
    const faqHit = this.bestFaq(text, lang);
    if (!nav && faqHit && faqHit.score >= 0.8) return this.fromFaq(faqHit.e, faqHit.score, lang);

    // --- Navigasi ke entitas
    const ent = this.findEntity(text);
    if (ent) {
      const e = ent.e;
      const name = pick(e.label, lang);
      if (e.kind === 'moon') return this.done('moon', 0.95, L('Ke Bulan! Pegangan yang erat, Kak!', 'To the Moon! Hold on tight, Captain!'), [{ tool: 'go_to_moon', args: {} }]);
      if (e.kind === 'space') return this.done('space', 0.95, L('Ayo ke angkasa! Kit roket siap.', 'To space! The rocket kit is ready.'), [{ tool: 'go_to_space', args: {} }]);
      if (e.kind === 'project') {
        const p = this.k.projects.find((x) => x.id === e.id)!;
        const info = `${p.title}: ${pick(p.summary, lang)}`;
        return this.done('project', 0.9 * ent.score, nav ? L(`Siap, Piko antar ke pulau ${p.title}!`, `Sure, flying you to the ${p.title} island!`) : `${info} ${L('Mau Piko antar ke pulaunya?', 'Want me to fly you there?')}`, nav ? [{ tool: 'fly_to_project', args: { projectId: p.id } }] : []);
      }
      if (e.kind === 'landmark') return this.done('landmark', 0.9 * ent.score, L(`Ayo terbang ke ${name}!`, `Let's fly to ${name}!`), [{ tool: 'fly_to_landmark', args: { landmarkId: e.id } }]);
      // Zona: navigasi bila ada kata kerja, atau bila teks hampir hanya nama zonanya.
      if (nav || tokens(text).length <= 3) return this.done('zone', 0.9 * ent.score, L(`Siap, kita ke ${name}!`, `Roger, heading to ${name}!`), [{ tool: 'fly_to_zone', args: { zoneId: e.id } }]);
    }

    // --- Skill tertentu
    for (const s of this.k.skills) {
      const n = normalize(s.name);
      if (n.length >= 2 && phraseScore(text, n) >= 0.99 && s.level && s.levelLabel) {
        return this.done('skill', 0.92, L(`Bisa! ${s.name} Kak Aril ada di level ${s.level} (${s.levelLabel.id}).`, `Yes! Aril's ${s.name} is level ${s.level} (${s.levelLabel.en}).`), [{ tool: 'fly_to_zone', args: { zoneId: 'skill-peaks' } }]);
      }
    }

    // --- FAQ fuzzy
    if (faqHit && faqHit.score >= 0.75) return this.fromFaq(faqHit.e, faqHit.score, lang);

    // --- Nama Aril saja / siapa
    if (/\b(siapa|who)\b/.test(text) && /\b(aril|syahril|dia|he|him)\b/.test(text)) {
      return this.done('who', 0.85, L(`Kak Aril itu ${P.name}, ${pick(P.tagline, 'id').toLowerCase()} di ${P.campus}.`, `Aril is ${P.name}, a ${pick(P.tagline, 'en').toLowerCase()} at ${P.campus}.`), [{ tool: 'fly_to_zone', args: { zoneId: 'control-tower' } }]);
    }
    return null;
  }

  private bestFaq(text: string, lang: Lang): { e: FaqEntry; score: number } | null {
    let best: { e: FaqEntry; score: number } | null = null;
    for (const e of this.faq) {
      // Pola bahasa aktif sedikit diutamakan.
      for (const pat of e.patterns[lang]) {
        // Pola yang lebih panjang (lebih spesifik) menang bila sama-sama cocok.
        const s = phraseScore(text, pat) + Math.min(0.04, tokens(pat).length * 0.01);
        if (!best || s > best.score) best = { e, score: s };
      }
      for (const pat of e.patterns[lang === 'id' ? 'en' : 'id']) {
        const s = phraseScore(text, pat) * 0.97;
        if (!best || s > best.score) best = { e, score: s };
      }
    }
    return best;
  }

  private fromFaq(e: FaqEntry, score: number, lang: Lang): RouteResult {
    return this.done(`faq:${e.id}`, score, pick(e.answer, lang), e.action ? [{ tool: e.action.tool, args: e.action.args }] : []);
  }

  /** Jawaban terbaik untuk mode offline (ambang lebih rendah), atau null. */
  nearestFaq(raw: string, lang: Lang): RouteResult | null {
    let best: { e: FaqEntry; score: number } | null = null;
    for (const e of this.faq) for (const pat of [...e.patterns.id, ...e.patterns.en]) {
      const s = phraseScore(raw, pat);
      if (!best || s > best.score) best = { e, score: s };
    }
    if (!best || best.score < 0.5) return null;
    return this.done(`faq:${best.e.id}`, best.score, pick(best.e.answer, lang), best.e.action ? [{ tool: best.e.action.tool, args: best.e.action.args }] : []);
  }

  private weatherCommand(text: string): ((lang: Lang) => RouteResult) | null {
    const map: [RegExp, string, string, string][] = [
      [/\b(hujan|rain|rainy)\b/, 'rain', 'Hujan turun! Kanopi kita menutup otomatis.', 'Here comes the rain! The canopy closes by itself.'],
      [/\b(badai|petir|storm|thunder|lightning)\b/, 'storm', 'Wah, badai petir! Pegangan, Kak.', 'Whoa, a thunderstorm! Hold on, Captain.'],
      [/\b(salju|snow|snowy)\b/, 'snow', 'Salju turun! Dingin-dingin seru.', "It's snowing! Chilly and fun."],
      [/\b(cerah|clear|sunny|terang)\b/, 'clear', 'Langit cerah lagi!', 'Clear skies again!'],
      [/\b(cuaca asli|cuaca nyata|real weather|cuaca sebenarnya)\b/, 'real', 'Cuaca kembali mengikuti cuaca asli Medan.', "Weather is back to Medan's real weather."],
    ];
    const cmd = /\b(buat|bikin|jadikan|ubah|ganti|make|set|turn|change|aktifkan|nyalakan)\b/.test(text) || text.split(' ').length <= 2;
    if (!cmd) return null;
    for (const [re, kind, id, en] of map) if (re.test(text)) return (lang) => this.done('weather', 0.92, lang === 'id' ? id : en, [{ tool: 'set_weather', args: { kind } }]);
    return null;
  }

  private timeCommand(text: string): ((lang: Lang) => RouteResult) | null {
    const map: [RegExp, string, string, string][] = [
      [/\b(malam|night|nighttime|gelap)\b/, 'night', 'Sim salabim, malam tiba! Lihat lampu-lampu kota.', 'Abracadabra, nighttime! Look at the city lights.'],
      [/\b(senja|sunset|sore|dusk|matahari terbenam)\b/, 'sunset', 'Senja yang cantik datang!', 'Here comes a beautiful sunset!'],
      [/\b(siang|pagi|day|daytime|morning)\b/, 'day', 'Matahari bersinar terang!', 'The sun is shining bright!'],
      [/\b(waktu asli|waktu nyata|real time|jam asli)\b/, 'real', 'Waktu kembali mengikuti jam dunia nyata.', 'Time follows the real clock again.'],
    ];
    const cmd = /\b(buat|bikin|jadikan|ubah|ganti|make|set|turn|change|mode)\b/.test(text);
    if (!cmd) return null;
    for (const [re, mode, id, en] of map) if (re.test(text)) return (lang) => this.done('time', 0.92, lang === 'id' ? id : en, [{ tool: 'set_time', args: { mode } }]);
    return null;
  }

  private done(intent: string, confidence: number, say: string, actions: CopilotAction[]): RouteResult {
    return { intent, confidence: Math.min(1, confidence), say, actions };
  }
}
