/**
 * Loop utama: fisika langkah tetap 60 Hz dengan akumulator (maks. 4 sub-langkah per frame,
 * sisanya dibuang supaya tidak terjadi "spiral of death"), lalu update visual dengan alpha interpolasi.
 */
export interface LoopHandlers {
  fixedUpdate(dt: number): void;
  update(dt: number, alpha: number): void;
}

export class FixedStepper {
  private acc = 0;
  /** Jumlah sub-langkah frame terakhir (untuk debug). */
  lastSteps = 0;

  constructor(
    readonly dt = 1 / 60,
    readonly maxSteps = 4,
  ) {}

  /** Jalankan langkah fisika sesuai waktu yang berlalu. Mengembalikan alpha interpolasi. */
  advance(frameDt: number, step: (dt: number) => void): number {
    this.acc += frameDt;
    let n = 0;
    while (this.acc >= this.dt && n < this.maxSteps) {
      step(this.dt);
      this.acc -= this.dt;
      n++;
    }
    if (n === this.maxSteps && this.acc >= this.dt) this.acc %= this.dt;
    this.lastSteps = n;
    return this.acc / this.dt;
  }

  reset(): void {
    this.acc = 0;
  }
}
