/**
 * Posisi matahari nyata (docs/04 bagian 6.1, rumus NOAA): titik subsolar dari waktu UTC.
 * Fase 0 memakai waktu manual 10.00 WIB (lihat docs/decisions.md); Fase 2 mengaktifkan waktu nyata
 * bersama render malam lengkap.
 */
import { Vector3 } from 'three';
import { latLonToVec3 } from '../utils/geo';

export interface Subsolar {
  lat: number;
  lon: number;
}

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / 86400000) + 1;
}

/** Titik subsolar (lat/lon derajat) untuk waktu `date`. */
export function subsolarPoint(date: Date): Subsolar {
  const hourUtc = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const doy = dayOfYear(date);
  const year = date.getUTCFullYear();
  const daysInYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
  const g = ((2 * Math.PI) / daysInYear) * (doy - 1 + (hourUtc - 12) / 24);
  const eot =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  let lon = -15 * (hourUtc - 12 + eot / 60);
  lon = ((lon + 540) % 360) - 180;
  return { lat: (decl * 180) / Math.PI, lon };
}

/** Arah (satuan) dari pusat planet ke matahari. */
export function sunDirection(date: Date, out = new Vector3()): Vector3 {
  const s = subsolarPoint(date);
  return latLonToVec3(s.lat, s.lon, 1, out);
}

/**
 * Tanggal hari ini dengan jam lokal tertentu pada zona waktu WIB (UTC+7, zona Medan).
 * Dipakai untuk mode waktu manual.
 */
export function manualDate(hourLocal: number, utcOffsetHours = 7, base = new Date()): Date {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  d.setTime(d.getTime() + (hourLocal - utcOffsetHours) * 3600_000);
  return d;
}
