/**
 * Cuaca nyata kota asal Aril (Medan) dari Open-Meteo: gratis, tanpa API key, CORS terbuka (docs/10).
 * Disimpan 15 menit di localStorage (dibungkus try/catch). Jika offline atau gagal → null, dan dunia
 * memakai sel cuaca prosedural saja (aturan "semua fitur online punya fallback offline").
 */
import { HOME } from '../config/world';

export interface HomeWeather {
  code: number;
  temperature: number;
  windKmh: number;
  windFromDeg: number;
  cloudCover: number;
  isDay: boolean;
  fetchedAt: number;
}

const KEY = 'skyfolio.weather.v1';
const TTL = 15 * 60 * 1000;
const URL_BASE = 'https://api.open-meteo.com/v1/forecast';

function readCache(): HomeWeather | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const w = JSON.parse(raw) as HomeWeather;
    return Date.now() - w.fetchedAt < TTL ? w : null;
  } catch {
    return null;
  }
}

function writeCache(w: HomeWeather): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    // Mode privat / kuota penuh: tidak apa-apa, ambil ulang nanti.
  }
}

export async function fetchHomeWeather(timeoutMs = 6000): Promise<HomeWeather | null> {
  const cached = readCache();
  if (cached) return cached;
  if (typeof fetch === 'undefined') return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const q = new URLSearchParams({
      latitude: HOME.lat.toFixed(4),
      longitude: HOME.lon.toFixed(4),
      current: 'weather_code,temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover,is_day',
      timezone: 'Asia/Jakarta',
    });
    const res = await fetch(`${URL_BASE}?${q.toString()}`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const j = (await res.json()) as { current?: Record<string, number> };
    const c = j.current;
    if (!c || typeof c.weather_code !== 'number') return null;
    const w: HomeWeather = {
      code: c.weather_code,
      temperature: c.temperature_2m ?? 28,
      windKmh: c.wind_speed_10m ?? 5,
      windFromDeg: c.wind_direction_10m ?? 45,
      cloudCover: (c.cloud_cover ?? 50) / 100,
      isDay: c.is_day === 1,
      fetchedAt: Date.now(),
    };
    writeCache(w);
    return w;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
