/**
 * WebGPURenderer (three/webgpu) dengan fallback otomatis ke backend WebGL2.
 * Info backend ditampilkan di panel debug dan panel "Di Balik Layar".
 */
import { NoToneMapping, PCFShadowMap, RenderPipeline, SRGBColorSpace, WebGPURenderer } from 'three/webgpu';
import type { Camera, Scene } from 'three/webgpu';
import { dot, float, length, mix, pass, smoothstep, uniform, uv, vec3 } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

/** off = render langsung (Low), light = vinyet + grading, full = + bloom (High/Ultra). docs/04 bagian 8. */
export type PostMode = 'off' | 'light' | 'full';

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
  private pipeline: RenderPipeline | null = null;
  private postMode: PostMode = 'off';
  /** Kekuatan bloom (naik saat malam: lampu kota lebih berpendar). */
  readonly bloomStrength = uniform(0.35);

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

  /** Pasang/lepas rantai post-processing sesuai tier & Pengaturan. */
  setPost(scene: Scene, camera: Camera, mode: PostMode): void {
    if (mode === this.postMode && (mode === 'off' || this.pipeline)) return;
    this.pipeline?.dispose();
    this.pipeline = null;
    this.postMode = mode;
    if (mode === 'off') return;
    const scenePass = pass(scene, camera);
    const col = scenePass.getTextureNode('output');
    let out = col.rgb;
    if (mode === 'full') {
      // Hanya bagian sangat terang (matahari, lampu, api roket, kilat) yang berpendar.
      const b = bloom(col, 0.35, 0.45, 0.82);
      b.strength = this.bloomStrength;
      out = out.add(b.rgb);
    }
    // Grading lembut: sedikit lebih jenuh & hangat, lalu vinyet tipis di tepi.
    const luma = dot(out, vec3(0.299, 0.587, 0.114));
    out = mix(vec3(luma), out, float(1.08)).mul(vec3(1.02, 1.0, 0.98));
    const vig = smoothstep(0.42, 0.95, length(uv().sub(0.5)).mul(1.25));
    out = out.mul(float(1).sub(vig.mul(0.22)));
    const pl = new RenderPipeline(this.three);
    pl.outputNode = out;
    this.pipeline = pl;
  }

  render(scene: Scene, camera: Camera): void {
    if (this.pipeline) this.pipeline.render();
    else this.three.render(scene, camera);
  }

  get info(): { drawCalls: number; triangles: number } {
    const r = this.three.info.render;
    return { drawCalls: r.drawCalls, triangles: r.triangles };
  }

  dispose(): void {
    this.pipeline?.dispose();
    this.three.dispose();
  }
}
