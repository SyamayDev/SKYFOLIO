/** Antrean toast: maksimal 2 tampil sekaligus (docs/07 bagian 2). */
import { toasts, type Toast } from '../core/AppState';

const MAX_VISIBLE = 2;
const DURATION = 2600;
let nextId = 1;
const queue: Toast[] = [];

function pump(): void {
  while (toasts.get().length < MAX_VISIBLE && queue.length > 0) {
    const t = queue.shift()!;
    toasts.set([...toasts.get(), t]);
    setTimeout(() => {
      toasts.set(toasts.get().filter((x) => x.id !== t.id));
      pump();
    }, DURATION);
  }
}

export function pushToast(text: string, kind: Toast['kind'] = 'info', icon?: string): void {
  // Hindari duplikat beruntun.
  if (toasts.get().some((t) => t.text === text) || queue.some((t) => t.text === text)) return;
  queue.push({ id: nextId++, text, kind, ...(icon ? { icon } : {}) });
  if (queue.length > 4) queue.shift();
  pump();
}
