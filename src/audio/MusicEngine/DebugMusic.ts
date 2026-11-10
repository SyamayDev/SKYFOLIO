/**
 * Halaman debug musik (`/#debug-music`, docs/05): dengarkan setiap tema, lapisan (solo/bisu), intensitas,
 * stasiun radio, dan stinger secara terpisah. Hanya alat pengembang (dimuat dinamis, tidak ada di bundel utama).
 */
import { LAYERS, MusicEngine, STATIONS, type Layer, type StationId, type StingerId } from './MusicEngine';
import { THEMES, type ThemeId } from './themes';

export function mountDebugMusic(): void {
  const box = document.createElement('div');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Debug musik');
  box.style.cssText =
    'position:fixed;inset:12px auto auto 12px;z-index:9999;max-width:min(420px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:#2b2d42;color:#fff6e6;font:14px system-ui;padding:14px;border-radius:14px;box-shadow:0 10px 30px #0006';
  box.innerHTML = '<b style="font-size:18px">🎵 Syamay FM — debug</b><p style="margin:6px 0 10px;opacity:.75">Klik tema untuk memutar. Pergantian terjadi di batas birama.</p>';
  document.body.appendChild(box);
  let eng: MusicEngine | null = null;
  const ensure = (): MusicEngine => {
    if (eng) return eng;
    const ctx = new AudioContext();
    const len = ctx.sampleRate * 2;
    const noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    eng = new MusicEngine(ctx, ctx.destination, noise);
    eng.start();
    return eng;
  };
  const row = (title: string): HTMLDivElement => {
    const h = document.createElement('div');
    h.style.cssText = 'margin:10px 0 4px;font-weight:700';
    h.textContent = title;
    box.appendChild(h);
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
    box.appendChild(r);
    return r;
  };
  const btn = (parent: HTMLElement, label: string, fn: (b: HTMLButtonElement) => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'border:0;border-radius:8px;padding:6px 10px;background:#ffc93c;color:#2b2d42;font-weight:700;cursor:pointer';
    b.onclick = () => fn(b);
    parent.appendChild(b);
    return b;
  };
  const themes = row('Tema');
  for (const id of Object.keys(THEMES) as ThemeId[]) {
    btn(themes, `${id} (${THEMES[id].bpm})`, () => {
      const e = ensure();
      e.setStation('syamay');
      e.setTheme(id);
    });
  }
  const st = row('Stasiun radio');
  for (const id of STATIONS) btn(st, id, () => ensure().setStation(id as StationId));
  const ly = row('Lapisan (klik = bisu/aktif, shift+klik = solo)');
  for (const l of LAYERS) {
    const b = btn(ly, l, () => undefined);
    b.onclick = (ev) => {
      const e = ensure();
      if (ev.shiftKey) e.solo = e.solo === l ? null : (l as Layer);
      else if (e.muted.has(l)) e.muted.delete(l);
      else e.muted.add(l);
      b.style.opacity = e.muted.has(l) ? '0.4' : '1';
      b.style.outline = e.solo === l ? '2px solid #fff' : 'none';
      e.refreshLayers();
    };
  }
  const ir = row('Intensitas');
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.05';
  slider.value = '0.4';
  slider.style.width = '100%';
  slider.oninput = () => ensure().setIntensity(Number(slider.value));
  ir.appendChild(slider);
  const sg = row('Stinger');
  for (const id of ['stamp', 'zone', 'achievement', 'landing', 'moon'] as StingerId[]) btn(sg, id, () => ensure().stinger(id));
  const ctl = row('Kontrol');
  btn(ctl, '⏹ Stop', () => {
    eng?.dispose();
    eng = null;
  });
  btn(ctl, '✕ Tutup', () => {
    eng?.dispose();
    box.remove();
    history.replaceState(null, '', location.pathname + location.search);
  });
}
