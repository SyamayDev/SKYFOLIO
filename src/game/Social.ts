/**
 * Fitur sosial di klien (docs/09 bagian 4–6): lampion online, counter km global, papan skor Sirkuit Langit,
 * dan penerjun Kawah Nekat (Phoenix). Semua permintaan ber-timeout dan gagal dengan diam → dunia tetap
 * berjalan lokal (aturan "setiap fitur online punya fallback offline").
 */
import { moderateText, type Verdict } from '../../api/_lib/badwords';
import { bus } from '../core/EventBus';
import { store } from '../core/Store';
import { tr, type I18nKey } from '../i18n';
import { pushToast } from '../ui/toasts';
import { visitor } from '../ui/visitor';
import type { LanternData } from '../world/Zones/LanternValley';
import { circuit } from '../world/Zones/SkyCircuit';

export const leaderboard = store<{ top: { name: string; time: number }[]; offline: boolean; rank: number | null }>({ top: [], offline: false, rank: null });

const offline = (): boolean => new URLSearchParams(location.search).has('test') || navigator.onLine === false;

async function api<T>(path: string, body?: unknown, timeout = 6000): Promise<T | null> {
  if (offline()) return null;
  try {
    const res = await fetch(`/api/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok && res.status !== 400 && res.status !== 429) return null;
    const ct = res.headers.get('content-type') ?? '';
    return ct.includes('json') ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export interface SocialHooks {
  setLanterns(list: LanternData[]): void;
  releaseLanternAnim(): void;
  setTotalKm(km: number | null): void;
}

export class Social {
  private km = 0;
  private flushT = 0;
  private lanternT = 0;
  private token: string | null = null;
  private pending = false;
  private readonly offs: (() => void)[] = [];

  constructor(private readonly hooks: SocialHooks) {
    void this.refreshCounters();
    void this.refreshLanterns();
    void this.refreshBoard();
    void api('counters', { event: 'visit' });
    this.offs.push(
      bus.on('plane:takeoff', () => void api('counters', { event: 'flight' })),
      bus.on('interact', (e) => {
        if (e.action === 'crater-dive') void this.dive();
        else if (e.action.startsWith('lap:')) void this.submitLap(Number(e.action.slice(4)));
      }),
      circuit.subscribe((c) => {
        // Token sesi diminta saat lap dimulai (cincin start dilewati).
        if (c.racing && c.next === 1 && !this.token && !this.pending) {
          this.pending = true;
          void api<{ token: string }>('leaderboard', { action: 'start' }).then((r) => {
            this.token = r?.token ?? null;
            this.pending = false;
          });
        }
        if (!c.racing && c.next === 0) this.token = null;
      }),
    );
  }

  /** Jarak terbang (unit dunia) ditambahkan tiap frame; dikirim berkala sebagai km. */
  tick(dt: number, distanceUnits: number): void {
    this.km += distanceUnits * 0.02;
    this.flushT += dt;
    this.lanternT += dt;
    if (this.flushT > 60 && this.km > 0.05) {
      this.flushT = 0;
      const km = Math.min(500, this.km);
      this.km = 0;
      void api('counters', { event: 'km', km }).then(() => this.refreshCounters());
    }
    if (this.lanternT > 120) {
      this.lanternT = 0;
      void this.refreshLanterns();
    }
  }

  async refreshCounters(): Promise<void> {
    const r = await api<{ km: number; offline?: boolean }>('counters');
    this.hooks.setTotalKm(r && !r.offline ? r.km : null);
  }

  async refreshLanterns(): Promise<void> {
    const r = await api<{ lanterns: (LanternData & { t: number })[] }>('lanterns');
    if (r?.lanterns?.length) this.hooks.setLanterns(r.lanterns);
  }

  async refreshBoard(): Promise<void> {
    const r = await api<{ top: { name: string; time: number }[]; offline?: boolean }>('leaderboard');
    leaderboard.set({ ...leaderboard.get(), top: r?.top ?? [], offline: !r || !!r.offline });
  }

  /** Lepas lampion: saring lokal dulu (pengunjung langsung tahu), animasi lokal, lalu kirim ke server. */
  async postLantern(text: string): Promise<Verdict> {
    const v = moderateText(text);
    if (!v.ok) {
      pushToast(tr(`panels.lantern.rejected.${v.reason}` as I18nKey), 'warn', 'lantern');
      return v;
    }
    this.hooks.releaseLanternAnim();
    const country = visitor.get().country;
    const r = await api<{ ok: boolean; reason?: string }>('lanterns', { text, country: /^[A-Z]{2}$/.test(country) ? country : undefined });
    if (r && !r.ok && r.reason) {
      pushToast(tr(`panels.lantern.rejected.${r.reason}` as I18nKey), 'warn', 'lantern');
      return { ok: false, reason: r.reason as Verdict['reason'] };
    }
    if (r?.ok) setTimeout(() => void this.refreshLanterns(), 1500);
    return { ok: true };
  }

  private async dive(): Promise<void> {
    const r = await api<{ divers?: number }>('counters', { event: 'dive' });
    if (r?.divers && r.divers % 100 === 0) bus.emit('game:event', { id: 'phoenix' });
  }

  private async submitLap(time: number): Promise<void> {
    const c = circuit.get();
    if (!this.token || !Number.isFinite(time)) return;
    const name = visitor.get().name || 'Captain';
    const r = await api<{ ok: boolean; rank: number | null; top: { name: string; time: number }[] }>('leaderboard', {
      action: 'submit',
      token: this.token,
      time,
      splits: c.splits,
      name: name.slice(0, 16),
    });
    this.token = null;
    if (!r?.ok) return;
    leaderboard.set({ top: r.top, offline: false, rank: r.rank });
    if (r.rank && r.rank <= 10) {
      pushToast(tr('zones.circuit.rank', { n: r.rank }), 'success', 'trophy');
      bus.emit('game:event', { id: 'circuit-top10' });
    }
  }

  dispose(): void {
    for (const o of this.offs) o();
  }
}
