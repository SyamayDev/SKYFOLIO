/**
 * Cek dukungan grafis minimum (WebGPU atau WebGL2) tanpa mengimpor three.js,
 * supaya UI pra-terbang tampil secepat mungkin.
 */
export function hasGraphicsSupport(): boolean {
  try {
    if ('gpu' in navigator) return true;
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}
