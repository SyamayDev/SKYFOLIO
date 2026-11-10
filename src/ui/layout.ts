/**
 * Status tata letak responsif: `compact` = layar sempit (HP portrait) atau pendek (HP landscape).
 * Dipakai komponen untuk memindahkan elemen ke tumpukan atas supaya tidak bertabrakan dengan meter/tombol.
 */
import { store } from '../core/Store';

const QUERY = '(max-width: 600px), (max-height: 560px)';

export const compact = store<boolean>(typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches);

if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia(QUERY);
  const on = (): void => compact.set(mq.matches);
  mq.addEventListener?.('change', on);
}

/** HP landscape (layar pendek): bagian tengah dipakai pesawat, jadi pesan dipindah ke sisi. */
const SHORT = '(max-height: 560px) and (orientation: landscape)';
export const shortLandscape = store<boolean>(typeof window !== 'undefined' && !!window.matchMedia?.(SHORT).matches);
if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia(SHORT);
  mq.addEventListener?.('change', () => shortLandscape.set(mq.matches));
}
