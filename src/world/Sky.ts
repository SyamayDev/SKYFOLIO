/**
 * Langit, cahaya, dan kabut (docs/04 bagian 5).
 * - Kubah langit mengikuti kamera; warnanya bercampur siang/senja/malam berdasarkan elevasi matahari
 *   terhadap "atas" lokal kamera.
 * - Cahaya hemisfer selalu diarahkan ke atas lokal kamera (planet bulat → tidak ada "atas" global).
 * - Bayangan matahari mengikuti pesawat.
 */
import { BackSide, Color, DirectionalLight, Fog, HemisphereLight, Mesh, SphereGeometry, Vector3, type Scene } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { clamp, dot, float, max, mix, normalize, positionWorld, cameraPosition, pow, smoothstep, uniform, vec3 } from 'three/tsl';
import { PALETTE } from '../config/palette';
import { PLANET_RADIUS, SPACE_START } from '../config/world';
import { smoothstep as sstep } from '../utils/math';
import { rimColor } from '../utils/modeling/materials';

const C = (hex: string): Color => new Color(hex);

export class Sky {
  readonly sunDir = new Vector3(0, 0, 1);
  readonly dome: Mesh;
  readonly sun: DirectionalLight;
  readonly hemi: HemisphereLight;
  readonly fog: Fog;
  /** Elevasi matahari di posisi kamera (−1..1). */
  sunElevation = 1;

  private readonly uUp = uniform(new Vector3(0, 1, 0));
  private readonly uSun = uniform(new Vector3(0, 0, 1));
  private readonly uTop = uniform(new Color(PALETTE.skyDayTop));
  private readonly uHorizon = uniform(new Color(PALETTE.skyDayHorizon));
  private readonly uSunColor = uniform(new Color('#FFF1C4'));
  private readonly uSpace = uniform(0);

  private readonly palette = {
    dayTop: C(PALETTE.skyDayTop),
    dayHorizon: C(PALETTE.skyDayHorizon),
    sunsetTop: C(PALETTE.skySunsetTop),
    sunsetHorizon: C(PALETTE.skySunsetHorizon),
    nightTop: C(PALETTE.skyNightTop),
    nightHorizon: C(PALETTE.skyNightHorizon),
    space: C('#060A1F'),
  };
  private readonly top = new Color();
  private readonly horizon = new Color();
  private readonly tmpC = new Color();
  private readonly up = new Vector3();
  private shadowRange = 30;

  constructor(private readonly scene: Scene) {
    // Kubah langit
    const mat = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false });
    mat.fog = false;
    const dir = normalize(positionWorld.sub(cameraPosition));
    const h = dot(dir, this.uUp);
    const t = pow(clamp(h, 0, 1), float(0.5));
    let col = mix(this.uHorizon, this.uTop, t);
    // Di bawah horizon sedikit lebih gelap supaya tepi planet terbaca dari ketinggian.
    col = mix(col, this.uHorizon.mul(0.82), smoothstep(0.0, -0.35, h));
    const s = max(dot(dir, this.uSun), 0);
    const glow = pow(s, float(10)).mul(0.28).add(pow(s, float(900)).mul(3.0));
    col = col.add(this.uSunColor.mul(glow));
    // Menuju angkasa: biru pekat dulu (stratosfer), lalu biru malam angkasa.
    const deepBlue = vec3(0.03, 0.16, 0.55);
    const spaceCol = vec3(0.012, 0.022, 0.08).add(this.uSunColor.mul(pow(s, float(1400)).mul(4)));
    const toDeep = mix(col, deepBlue, smoothstep(0.0, 0.5, this.uSpace).mul(dot(dir, this.uUp).max(0).mul(0.6).add(0.4)));
    mat.colorNode = mix(toDeep, spaceCol, smoothstep(0.45, 1.0, this.uSpace));
    this.dome = new Mesh(new SphereGeometry(5200, 32, 16), mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.dome.name = 'sky-dome';
    scene.add(this.dome);

    // Cahaya
    this.sun = new DirectionalLight(0xfff4e0, 2.7);
    this.sun.castShadow = true;
    this.sun.shadow.intensity = 0.55;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 220;
    scene.add(this.sun, this.sun.target);
    this.hemi = new HemisphereLight(0xcfe9ff, 0x6fa85a, 1.35);
    scene.add(this.hemi);

    this.fog = new Fog(new Color(PALETTE.skyDayHorizon), 60, 900);
    scene.fog = this.fog;
  }

  setSunDirection(dir: Vector3): void {
    this.sunDir.copy(dir).normalize();
    this.uSun.value.copy(this.sunDir);
  }

  setShadow(mapSize: number, range: number): void {
    this.shadowRange = range;
    const sh = this.sun.shadow;
    this.sun.castShadow = mapSize > 0;
    if (mapSize > 0 && (sh.mapSize.x !== mapSize || sh.mapSize.y !== mapSize)) {
      sh.mapSize.set(mapSize, mapSize);
      sh.map?.dispose();
      sh.map = null;
    }
    const cam = sh.camera;
    cam.left = -range;
    cam.right = range;
    cam.top = range;
    cam.bottom = -range;
    cam.updateProjectionMatrix();
  }

  update(cameraPos: Vector3, shadowTarget: Vector3): void {
    const r = cameraPos.length();
    this.up.copy(cameraPos).divideScalar(r || 1);
    this.uUp.value.copy(this.up);
    const e = this.up.dot(this.sunDir);
    this.sunElevation = e;
    const alt = r - PLANET_RADIUS;

    // Campur palet: senja di e≈0, siang di atas, malam di bawah.
    const dayK = sstep(-0.04, 0.28, e);
    const nightK = sstep(0.02, -0.26, e);
    const p = this.palette;
    this.top.copy(p.sunsetTop).lerp(p.dayTop, dayK).lerp(p.nightTop, nightK);
    this.horizon.copy(p.sunsetHorizon).lerp(p.dayHorizon, dayK).lerp(p.nightHorizon, nightK);
    // Makin tinggi makin gelap → angkasa.
    const spaceK = sstep(PLANET_RADIUS + 90, SPACE_START + 40, r);
    this.uSpace.value = spaceK;
    this.uTop.value.copy(this.top);
    this.uHorizon.value.copy(this.horizon);
    this.uSunColor.value.set('#FFF1C4').lerp(this.tmpC.set('#FF9A5C'), 1 - dayK);

    // Kabut: warna horizon, menipis dengan ketinggian, hilang di angkasa.
    this.fog.color.copy(this.horizon).lerp(this.tmpC.set('#ffffff'), 0.12 * dayK);
    this.fog.near = 40 + Math.max(0, alt) * 1.6;
    this.fog.far = (260 + Math.max(0, alt) * 5) * (1 + spaceK * 30);

    // Hemisfer: arahkan ke atas lokal kamera; redup dan kebiruan saat malam.
    this.hemi.position.copy(this.up);
    this.hemi.color.copy(this.top).lerp(this.tmpC.set('#ffffff'), 0.55);
    this.hemi.groundColor.set('#6FA85A').lerp(this.tmpC.set('#24305E'), nightK);
    this.hemi.intensity = 1.35 - nightK * 0.75;
    rimColor.value.copy(this.horizon);

    // Matahari: sedikit oranye saat rendah.
    this.sun.color.set('#FFF4E0').lerp(this.tmpC.set('#FFB27A'), (1 - dayK) * 0.6);
    this.sun.position.copy(shadowTarget).addScaledVector(this.sunDir, 100);
    this.sun.target.position.copy(shadowTarget);
    this.sun.target.updateMatrixWorld();
    // Kubah ikut kamera.
    this.dome.position.copy(cameraPos);
    void this.shadowRange;
  }

  dispose(): void {
    this.scene.remove(this.dome, this.sun, this.sun.target, this.hemi);
    this.dome.geometry.dispose();
    (this.dome.material as MeshBasicNodeMaterial).dispose();
    this.sun.shadow.map?.dispose();
    this.scene.fog = null;
  }
}
