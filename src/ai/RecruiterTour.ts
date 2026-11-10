/**
 * Mode Rekruter (docs/06 bagian 7): tur 60–90 detik TANPA AI online. Narasi disusun dari template + konten,
 * jadi selalu jalan dan selalu akurat. Autopilot jujur-fisika mengantar ke tiap titik; kamera sinematik.
 * Tombol: Lewati, Berikutnya, Ambil Alih Kemudi, Unduh CV.
 */
import { L, content } from '../content';
import { appPhase } from '../core/AppState';
import { bus } from '../core/EventBus';
import { store } from '../core/Store';
import { locale, tr } from '../i18n';
import { toPublicContent } from '../content/public';
import { actions } from '../ui/bridge';

export interface TourStep {
  dest: string;
  title: string;
  text: string;
}

export const tour = store<{ active: boolean; step: number; total: number; title: string; text: string; last: boolean }>({
  active: false,
  step: 0,
  total: 0,
  title: '',
  text: '',
  last: false,
});

const MIN_STEP = 7;
const MAX_STEP = 13;

let steps: TourStep[] = [];
let idx = -1;
let t = 0;
let timer: ReturnType<typeof setInterval> | null = null;

const list = (xs: string[]): string => {
  const and = locale.get() === 'id' ? 'dan' : 'and';
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${and} ${xs[xs.length - 1]}`;
};

/** Langkah tur dari konten yang sudah dikonfirmasi saja. */
export function buildSteps(): TourStep[] {
  const c = toPublicContent(content.get()).content;
  const p = c.profile;
  const zoneName = (id: string): string => L(c.zones.zones.find((z) => z.id === id)?.name);
  const out: TourStep[] = [
    {
      dest: 'zone:control-tower',
      title: zoneName('control-tower'),
      text: tr('tour.tower', { name: p.name, tagline: L(p.tagline), campus: p.education.campus }),
    },
  ];
  const featured = c.projects.filter((x) => x.featured).sort((a, b) => (a.featuredRank ?? 9) - (b.featuredRank ?? 9));
  featured.slice(0, 3).forEach((x, i) => {
    out.push({ dest: `featured:${i + 1}`, title: `${tr('tour.featured', { n: i + 1 })}: ${x.title}`, text: L(x.summary) || x.title });
  });
  const top = c.skills.groups.flatMap((g) => g.skills).filter((s) => s.level === 5).map((s) => (typeof s.name === 'string' ? s.name : L(s.name)));
  if (top.length) out.push({ dest: 'zone:skill-peaks', title: zoneName('skill-peaks'), text: tr('tour.skills', { skills: list(top.slice(0, 6)) }) });
  const items = c.timeline.items.filter((it) => L(it.title)).slice(0, 3);
  if (items.length)
    out.push({
      dest: 'zone:journey-stream',
      title: zoneName('journey-stream'),
      text: tr('tour.journey', { items: list(items.map((it) => `${L(it.title)} (${(it as { org?: string }).org ?? ''})`.replace(' ()', ''))) }),
    });
  out.push({ dest: 'zone:post-office', title: zoneName('post-office'), text: tr('tour.contact', { email: c.socials.contactEmail }) });
  return out;
}

function show(): void {
  const s = steps[idx]!;
  tour.set({ active: true, step: idx + 1, total: steps.length, title: s.title, text: s.text, last: idx === steps.length - 1 });
  actions.flyTo(s.dest, { openPanel: false, hold: true, boost: true });
  t = 0;
}

export function startTour(): void {
  if (tour.get().active) return;
  // Dari layar boarding: tunggu sampai sudah terbang (mesin hidup).
  if (appPhase.get() !== 'flying') {
    const off = appPhase.subscribe((ph) => {
      if (ph === 'flying') {
        setTimeout(() => {
          off();
          startTour();
        }, 1200);
      }
    });
    return;
  }
  steps = buildSteps();
  idx = 0;
  actions.cinematic(true);
  actions.emote('wave');
  show();
  timer = setInterval(tick, 250);
}

function tick(): void {
  if (!tour.get().active) return;
  t += 0.25;
  const ap = actions.autopilotInfo();
  // Pemain mengambil kemudi sendiri (autopilot batal) → tur berhenti dengan sopan.
  if (!ap.active && t > 2) {
    endTour(false);
    return;
  }
  if ((ap.arrived && t >= MIN_STEP) || t >= MAX_STEP) next();
}

export function next(): void {
  if (!tour.get().active) return;
  if (idx >= steps.length - 1) {
    endTour(true);
    return;
  }
  idx++;
  show();
}

/** Selesai/berhenti. `completed` = sampai langkah terakhir (achievement Tur Kilat). */
export function endTour(completed: boolean): void {
  if (timer) clearInterval(timer);
  timer = null;
  tour.set({ ...tour.get(), active: false });
  actions.cinematic(false);
  if (completed) {
    bus.emit('game:event', { id: 'tour-done' });
    actions.emote('cheer');
  }
}

/** Ambil alih kemudi: hentikan tur & autopilot. */
export function takeOver(): void {
  endTour(false);
  actions.cancelAutopilot();
}

export function downloadCv(): void {
  const cv = (content.get().profile as unknown as { cv?: Record<string, string> }).cv;
  const url = cv?.[locale.get()] ?? cv?.id;
  if (url) window.open(url, '_blank', 'noopener');
}
