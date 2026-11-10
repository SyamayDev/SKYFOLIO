/** Waktu permainan. Delta dibatasi supaya tab yang lama tersembunyi tidak membuat lonjakan. */
export class Time {
  /** Detik sejak mulai (berhenti saat jeda). */
  elapsed = 0;
  /** Delta frame terakhir (detik, dibatasi). */
  delta = 1 / 60;
  /** Delta mentah tanpa batas (untuk pengukur fps). */
  rawDelta = 1 / 60;
  frame = 0;
  /** Batas delta per frame (detik). */
  maxDelta = 0.1;
  private last = -1;

  tick(now: number): void {
    if (this.last < 0) this.last = now;
    this.rawDelta = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    this.delta = Math.min(this.rawDelta, this.maxDelta);
    this.frame++;
  }

  advance(dt: number): void {
    this.elapsed += dt;
  }

  /** Abaikan jeda panjang (misalnya kembali dari tab lain). */
  resetClock(): void {
    this.last = -1;
  }
}
