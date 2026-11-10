/**
 * LOD sederhana untuk zona & landmark: benda kecil (papan teks, diorama, balon, props) hanya digambar dalam
 * radius tertentu dari kamera — dari jauh memang tidak terbaca, dan menghemat banyak draw call.
 * Bentuk besar (pulau, gunung, menara) tetap terlihat dari jauh.
 */
import { Box3, Sphere, Vector3, type Object3D } from 'three';

interface Item {
  obj: Object3D;
  pos: Vector3;
  radius: number;
}

const _box = new Box3();
const _sph = new Sphere();

export class DetailCuller {
  private readonly items: Item[] = [];
  private timer = 0;
  /** Pengali radius per tier kualitas (Low lebih pendek). */
  scale = 1;

  /**
   * Daftarkan semua mesh/sprite kecil di bawah `root` (bounding sphere < `maxSize`).
   * Dipanggil sekali setelah isi dibangun.
   */
  add(root: Object3D, radius = 170, maxSize = 7): void {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const m = o as unknown as { isMesh?: boolean; isSprite?: boolean; geometry?: { boundingSphere: Sphere | null; computeBoundingSphere(): void } };
      if (!m.isMesh && !m.isSprite) return;
      // InstancedMesh berposisi di ruang dunia (asal di pusat planet) → tidak bisa dipangkas per objek.
      if (o.userData.noCull || (o as unknown as { isInstancedMesh?: boolean }).isInstancedMesh) return;
      let size: number;
      if (m.isSprite) size = Math.max(o.scale.x, o.scale.y);
      else {
        if (!m.geometry) return;
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        _sph.copy(m.geometry.boundingSphere!).applyMatrix4(o.matrixWorld);
        size = _sph.radius;
      }
      if (size > maxSize) return;
      _box.setFromObject(o);
      this.items.push({ obj: o, pos: _box.getCenter(new Vector3()), radius });
    });
  }

  update(dt: number, cam: Vector3): void {
    this.timer += dt;
    if (this.timer < 0.2) return;
    this.timer = 0;
    const k = this.scale * this.scale;
    for (const it of this.items) it.obj.visible = cam.distanceToSquared(it.pos) < it.radius * it.radius * k;
  }

  get count(): number {
    return this.items.length;
  }
}

/** Satu pemangkas global untuk semua zona, pulau, dan landmark. */
export const detailCuller = new DetailCuller();
