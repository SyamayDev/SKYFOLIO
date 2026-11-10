/**
 * Jam dunia (docs/04 bagian 6): waktu nyata (bawaan) atau jam manual dari Pengaturan. Matahari, Bulan,
 * musim, dan tema UI semuanya membaca jam ini, jadi membuka situs jam 19.00 memberi senja yang nyata.
 */
import { settings } from '../core/Settings';
import { manualDate } from './Sun';

export type DayPart = 'day' | 'dusk' | 'night';

export class WorldClock {
  /** Jam manual paksa (debug/tes/Mode Foto); null = ikut Pengaturan. */
  override: number | null = null;
  private readonly date = new Date();

  /** Waktu dunia sekarang (objek dipakai ulang, jangan disimpan). */
  now(): Date {
    const s = settings.get().world;
    if (this.override !== null) return this.setFrom(manualDate(this.override));
    if (!s.realTimeDayNight) return this.setFrom(manualDate(s.manualTimeOfDay));
    this.date.setTime(Date.now());
    return this.date;
  }

  /** Jam lokal Medan (WIB) dari waktu dunia, 0..24. */
  medanHour(): number {
    const d = this.now();
    return (d.getUTCHours() + 7 + d.getUTCMinutes() / 60 + 24) % 24;
  }

  private setFrom(d: Date): Date {
    this.date.setTime(d.getTime());
    return this.date;
  }
}

/** Bagian hari dari jam lokal pengunjung (untuk tema UI). */
export function dayPartOf(hour: number): DayPart {
  if (hour >= 6 && hour < 17) return 'day';
  if ((hour >= 17 && hour < 19) || (hour >= 5 && hour < 6)) return 'dusk';
  return 'night';
}
