/**
 * WebGPURenderer (three/webgpu) dengan fallback otomatis ke backend WebGL2.
 * Info backend ditampilkan di panel debug dan panel "Di Balik Layar".
 */
import { NoToneMapping, PCFShadowMap, SRGBColorSpace, WebGPURenderer } from 'three/webgpu';
import type { Camera, Scene } from 'three/webgpu';

export type BackendName = 'WebGPU' | 'WebGL2';

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  forceWebGL: boolean;
  antialias: boolean;
}

export class Renderer {
  readonly three: WebGPURenderer;
  backend: BackendName = 'WebGL2';
  private pixelRatioCap = 2;

  constructor(opts: RendererOptions) {
    this.three = new WebGPURenderer({
      canvas: opts.canvas,
      antialias: opts.antialias,
      forceWebGL: opts.forceWebGL,
      alpha: false,
    });
    this.three.outputColorSpace = SRGBColorSpace;
    // Warna palet harus tampil persis → tanpa tone mapping, intensitas cahaya disetel manual.
    this.three.toneMapping = NoToneMapping;
    this.three.shadowMap.enabled = true;
    this.three.shadowMap.type = PCFShadowMap;
  }

  async init(): Promise<void> {
    await this.three.init();
    const backend = (this.three as unknown as { backend: { isWebGPUBackend?: boolean } }).backend;
    this.backend = backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
  }

  setPixelRatioCap(cap: number): void {
    this.pixelRatioCap = cap;
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.three.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelRatioCap));
    this.three.setSize(w, h, false);
  }

  render(scene: Scene, camera: Camera): void {
    this.three.render(scene, camera);
  }

  get info(): { drawCalls: number; triangles: number } {
    const r = this.three.info.render;
    return { drawCalls: r.drawCalls, triangles: r.triangles };
  }

  dispose(): void {
    this.three.dispose();
  }
}
