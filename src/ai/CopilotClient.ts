/**
 * Otak Piko di klien (docs/06 bagian 2): 1) router lokal → 2) /api/copilot (rantai AI gratis) → 3) FAQ offline.
 * Riwayat obrolan hanya disimpan selama sesi (tidak dikirim ke server kecuali 6 pesan terakhir sebagai konteks).
 */
import { content } from '../content';
import type { SiteContent } from '../content/schema';
import { currentZone, hud, panel, paused } from '../core/AppState';
import { bus } from '../core/EventBus';
import { progress } from '../game/Progress';
import { equipSkin } from '../game/Skins';
import { settings, updateSettings } from '../core/Settings';
import { store } from '../core/Store';
import { locale, tr } from '../i18n';
import { actions } from '../ui/bridge';
import { isFlight, validateActions, type ValidAction } from './Actions';
import { IntentRouter, type FaqEntry, type Lang } from './IntentRouter';
import { buildKnowledge } from './knowledge';

export interface ChatMessage {
  id: number;
  from: 'me' | 'piko';
  text: string;
  /** Sumber jawaban (untuk Di Balik Layar/debug): local, ai, offline. */
  via?: 'local' | 'ai' | 'offline';
}

export const chat = store<{ messages: ChatMessage[]; typing: boolean }>({ messages: [], typing: false });

let router: IntentRouter | null = null;
let routerFor: SiteContent | null = null;
let nextId = 1;
const TIMEOUT_MS = 12_000;

function getRouter(): IntentRouter {
  const c = content.get();
  if (!router || routerFor !== c) {
    router = new IntentRouter(buildKnowledge(c), c.faq.entries as FaqEntry[]);
    routerFor = c;
  }
  return router;
}

function push(m: Omit<ChatMessage, 'id'>): void {
  const s = chat.get();
  chat.set({ ...s, messages: [...s.messages, { ...m, id: nextId++ }].slice(-40) });
}

function setTyping(t: boolean): void {
  chat.set({ ...chat.get(), typing: t });
}

/** Jalankan aksi tervalidasi lewat jembatan UI. */
export function runActions(list: ValidAction[]): void {
  const c = content.get();
  for (const a of list) {
    const g = a.args;
    switch (a.tool) {
      case 'fly_to_zone':
        actions.flyTo(`zone:${g.zoneId}`);
        break;
      case 'fly_to_project':
        actions.flyTo(g.projectId!.startsWith('featured:') ? g.projectId! : `project:${g.projectId}`);
        break;
      case 'fly_to_landmark':
        actions.flyTo(`landmark:${g.landmarkId}`);
        break;
      case 'go_to_space':
        actions.flyTo('space');
        break;
      case 'go_to_moon':
        actions.flyTo('moon');
        break;
      case 'show_panel': {
        const map: Record<string, () => void> = {
          profile: () => panel.set({ kind: 'zone', id: 'control-tower' }),
          projects: () => panel.set({ kind: 'zone', id: 'project-archipelago' }),
          skills: () => panel.set({ kind: 'zone', id: 'skill-peaks' }),
          timeline: () => panel.set({ kind: 'zone', id: 'journey-stream' }),
          certificates: () => panel.set({ kind: 'zone', id: 'orbit' }),
          contact: () => panel.set({ kind: 'contact' }),
          passport: () => panel.set({ kind: 'passport' }),
          map: () => panel.set({ kind: 'map' }),
          settings: () => {
            panel.set(null);
            paused.set(true);
          },
        };
        map[g.panel!]?.();
        break;
      }
      case 'open_link':
        panel.set({ kind: 'link', id: g.linkId });
        break;
      case 'open_cv': {
        const lang = (g.lang || locale.get()) as Lang;
        const cv = (c.profile as unknown as { cv?: Record<string, string> }).cv;
        const url = cv?.[lang] ?? cv?.id;
        if (url) window.open(url, '_blank', 'noopener');
        break;
      }
      case 'start_tour':
        actions.startTour();
        break;
      case 'set_weather':
        actions.setWeather(g.kind as 'real');
        break;
      case 'set_time':
        actions.setTime(g.mode as 'real');
        break;
      case 'play_radio':
        updateSettings('audio', { radioStation: g.stationId! });
        break;
      case 'emote':
        actions.emote(g.type as 'wave');
        break;
      case 'change_skin':
        equipSkin(g.skinId!);
        break;
    }
  }
}

function unlockedSkins(): string[] {
  return progress.get().unlockedSkins;
}

function reply(text: string, list: ValidAction[], via: ChatMessage['via']): void {
  setTyping(false);
  push({ from: 'piko', text, via });
  actions.emote(via === 'offline' ? 'think' : 'wave');
  if (list.length) {
    // Penerbangan: tutup panel obrolan supaya pemain melihat pesawatnya terbang.
    if (list.some(isFlight)) setTimeout(() => panel.set(null), 900);
    setTimeout(() => runActions(list), 400);
  }
}

interface ApiReply {
  mode: 'ai' | 'offline';
  say?: string;
  actions?: unknown[];
  reason?: string;
}

/** Tanya Piko. Mengembalikan setelah jawaban ditampilkan. */
export async function ask(raw: string): Promise<void> {
  const text = raw.trim().slice(0, 300);
  if (!text) return;
  const lang = locale.get();
  const history = chat
    .get()
    .messages.slice(-6)
    .map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', content: m.text.slice(0, 300) }));
  push({ from: 'me', text });
  bus.emit('game:event', { id: 'chat-ask' });
  setTyping(true);
  actions.emote('think');
  const c = content.get();
  const r = getRouter().route(text, lang);
  if (r && r.confidence >= 0.75) {
    await new Promise((ok) => setTimeout(ok, 380 + Math.random() * 300));
    reply(r.say, validateActions(r.actions, c, unlockedSkins()), 'local');
    return;
  }
  // Server AI (opsional). Tanpa jaringan/key → offline.
  let data: ApiReply | null = null;
  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          lang,
          history,
          context: { zone: currentZone.get(), regime: hud.get().regime, chatter: settings.get().copilot.chatterLevel },
        }),
        signal: ctrl.signal,
      });
      if (res.ok) data = (await res.json()) as ApiReply;
    } catch {
      data = null;
    } finally {
      clearTimeout(timer);
    }
  }
  if (data?.mode === 'ai' && data.say) {
    reply(data.say.slice(0, 280), validateActions(data.actions ?? [], c, unlockedSkins()), 'ai');
    return;
  }
  // Fallback offline: FAQ terdekat, atau "belum tahu" + pilihan cepat.
  const near = getRouter().nearestFaq(text, lang);
  const prefix = data?.reason === 'limit' ? `${tr('chat.resting')} ` : '';
  if (near) reply(`${prefix}${near.say}`, validateActions(near.actions, c, unlockedSkins()), 'offline');
  else reply(`${prefix}${tr('chat.unknown')}`, [], 'offline');
}

export function clearChat(): void {
  chat.set({ messages: [], typing: false });
}
