/**
 * Papan teks 3D (CanvasTexture) yang otomatis digambar ulang saat bahasa diganti (docs/07 bagian 4).
 * Mode `sprite` selalu menghadap kamera; mode bidang dipakai untuk papan yang tertancap di dunia.
 */
import { CanvasTexture, DoubleSide, Mesh, PlaneGeometry, SRGBColorSpace, Sprite, type Object3D } from 'three';
import { color, frontFacing, select, texture, vec4 } from 'three/tsl';
import { MeshBasicNodeMaterial, SpriteNodeMaterial } from 'three/webgpu';
import { locale, tr, type I18nKey } from '../i18n';

export interface BillboardOptions {
  width: number;
  height: number;
  fontSize?: number;
  color?: string;
  bg?: string;
  sprite?: boolean;
  /** Gambar kustom (menggantikan teks biasa). */
  draw?: (g: CanvasRenderingContext2D, w: number, h: number) => void;
}

const PX_PER_UNIT = 128;

export class Billboard {
  readonly object: Object3D;
  private readonly canvas: HTMLCanvasElement;
  private readonly texture: CanvasTexture;
  private readonly material: MeshBasicNodeMaterial | SpriteNodeMaterial;
  private readonly unsub: () => void;

  constructor(
    private text: I18nKey | (() => string),
    private readonly opts: BillboardOptions,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.min(2048, Math.round(opts.width * PX_PER_UNIT));
    this.canvas.height = Math.min(2048, Math.round(opts.height * PX_PER_UNIT));
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    if (opts.sprite !== false) {
      const m = new SpriteNodeMaterial({ map: this.texture, transparent: true, depthWrite: false });
      this.material = m;
      const s = new Sprite(m);
      s.scale.set(opts.width, opts.height, 1);
      s.renderOrder = 3;
      this.object = s;
    } else {
      // Satu mesh dua sisi: depan bertekstur, belakang polos mengikuti bentuk (alfa) papan → dari belakang
      // tidak terlihat teks cermin. Bidang datar tidak pernah menutupi dirinya sendiri, jadi cukup satu pass
      // (hemat 1 draw call per papan dibanding mesh belakang terpisah).
      const m = new MeshBasicNodeMaterial({ transparent: true, side: DoubleSide });
      const tex = texture(this.texture);
      m.colorNode = select(frontFacing, tex, vec4(color('#E3D6BF'), tex.a));
      m.forceSinglePass = true;
      this.material = m;
      this.object = new Mesh(new PlaneGeometry(opts.width, opts.height), m);
    }
    this.object.name = 'billboard';
    this.unsub = locale.subscribe(() => this.redraw());
    // Gambar ulang setelah font self-hosted siap.
    document.fonts?.ready.then(() => this.redraw(), () => undefined);
  }

  setText(text: I18nKey | (() => string)): void {
    this.text = text;
    this.redraw();
  }

  redraw(): void {
    const g = this.canvas.getContext('2d');
    if (!g) return;
    const { width: w, height: h } = this.canvas;
    g.clearRect(0, 0, w, h);
    if (this.opts.draw) {
      this.opts.draw(g, w, h);
    } else {
      if (this.opts.bg) {
        g.fillStyle = this.opts.bg;
        roundRect(g, 6, 6, w - 12, h - 12, Math.min(w, h) * 0.3);
        g.fill();
      }
      const text = typeof this.text === 'function' ? this.text() : tr(this.text);
      g.fillStyle = this.opts.color ?? '#2B2D42';
      const size = this.opts.fontSize ?? 72;
      g.font = `600 ${size}px Fredoka, "Nunito Sans", system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const lines = text.split('\n');
      lines.forEach((line, i) => g.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15, w - 24));
    }
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.unsub();
    this.texture.dispose();
    this.material.dispose();
    if ((this.object as Mesh).isMesh) (this.object as Mesh).geometry.dispose();
  }
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
