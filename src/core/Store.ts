/**
 * Store kecil bertipe, kompatibel dengan kontrak store Svelte (`subscribe` mengembalikan unsubscribe),
 * jadi komponen bisa memakai `$store`. Tanpa library state besar.
 */

export type Subscriber<T> = (value: T) => void;

export interface Readable<T> {
  subscribe(run: Subscriber<T>): () => void;
  get(): T;
}

export class Store<T> implements Readable<T> {
  private value: T;
  private readonly subs = new Set<Subscriber<T>>();

  constructor(initial: T) {
    this.value = initial;
  }

  get(): T {
    return this.value;
  }

  set(value: T): void {
    if (Object.is(value, this.value) && (typeof value !== 'object' || value === null)) return;
    this.value = value;
    for (const s of this.subs) s(value);
  }

  update(fn: (v: T) => T): void {
    this.set(fn(this.value));
  }

  /** Ubah sebagian properti objek lalu beri tahu pelanggan. */
  patch(partial: Partial<T>): void {
    this.set({ ...this.value, ...partial });
  }

  subscribe(run: Subscriber<T>): () => void {
    this.subs.add(run);
    run(this.value);
    return () => {
      this.subs.delete(run);
    };
  }
}

export function store<T>(initial: T): Store<T> {
  return new Store(initial);
}
