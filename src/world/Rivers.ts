/**
 * Pita sungai (dari rivers.bin, dibuat build-earth): mengikuti permukaan lembah sungai.
 * Shader: arus berjalan sepanjang sungai (koordinat u), tepi lebih terang seperti riak di tepian.
 */
import { BufferAttribute, BufferGeometry, Color, Mesh } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { abs, attribute, color, mix, sin, smoothstep, time } from 'three/tsl';
import { RIVER_VERTEX_BYTES, type EarthMeta } from './EarthFormat';

export class Rivers {
  readonly mesh: Mesh;
  private readonly material: MeshStandardNodeMaterial;

  constructor(data: ArrayBuffer, meta: EarthMeta) {
    const n = Math.min(meta.rivers.vertexCount, Math.floor(data.byteLength / RIVER_VERTEX_BYTES));
    const view = new DataView(data);
    const scale = meta.quantRadius / 32767;
    const pos = new Float32Array(n * 3);
    const flow = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const o = i * RIVER_VERTEX_BYTES;
      pos[i * 3] = view.getInt16(o, true) * scale;
      pos[i * 3 + 1] = view.getInt16(o + 2, true) * scale;
      pos[i * 3 + 2] = view.getInt16(o + 4, true) * scale;
      const packed = view.getUint16(o + 6, true);
      flow[i * 2] = (packed >> 1) / 4;
      flow[i * 2 + 1] = packed & 1;
    }
    let quads = 0;
    for (const len of meta.rivers.strips) quads += Math.max(0, len - 1);
    const index = n > 65535 ? new Uint32Array(quads * 6) : new Uint16Array(quads * 6);
    let base = 0;
    let k = 0;
    for (const len of meta.rivers.strips) {
      for (let i = 0; i < len - 1; i++) {
        const l0 = base + i * 2;
        const r0 = l0 + 1;
        const l1 = l0 + 2;
        const r1 = l0 + 3;
        index[k++] = l0;
        index[k++] = r0;
        index[k++] = r1;
        index[k++] = l0;
        index[k++] = r1;
        index[k++] = l1;
      }
      base += len * 2;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('flow', new BufferAttribute(flow, 2));
    geo.setIndex(new BufferAttribute(index, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const m = new MeshStandardNodeMaterial({ roughness: 0.28, metalness: 0 });
    const f = attribute('flow', 'vec2');
    const across = abs(f.y.sub(0.5)).mul(2); // 0 di tengah → 1 di tepi
    const ripple = sin(f.x.mul(1.6).sub(time.mul(2.4)).add(f.y.mul(2.1))).mul(0.5).add(0.5);
    const deep = color(new Color('#2F8FE0'));
    const light = color(new Color('#7FD8F2'));
    m.colorNode = mix(deep, light, ripple.mul(0.28).add(smoothstep(0.55, 1, across).mul(0.45)));
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -4;
    this.material = m;
    this.mesh = new Mesh(geo, m);
    this.mesh.name = 'rivers';
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
