import * as THREE from "three";
import { previewUrl, spritesheetUrl, type Pet } from "../data/pets";

const COLS = 8;
const ROWS = 9;
const CELL_W = 192;
const CELL_H = 208;

export class PetStage {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private mesh: THREE.Mesh | null = null;
  private texture: THREE.Texture | null = null;
  private frame = 0;
  private acc = 0;
  private raf = 0;
  private statusEl: HTMLElement | null = null;

  private dragX = 0;
  private dragging = false;
  /** Fired (throttled by caller) when pointer-drag rotates the mesh. */
  onRotate: (() => void) | null = null;

  constructor(host: HTMLElement, statusEl?: HTMLElement | null) {
    this.statusEl = statusEl ?? null;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "stage-canvas";
    this.canvas.style.touchAction = "none";
    host.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(0, 0.15, 2.4);

    const light = new THREE.DirectionalLight(0xffffff, 1.1);
    light.position.set(2, 3, 4);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0x88aaff, 0.55));

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 48),
      new THREE.MeshStandardMaterial({
        color: 0x1a2a3a,
        roughness: 0.85,
        metalness: 0.1,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.55;
    this.scene.add(ground);

    this.bindDragRotate();
    this.resize();
    this.loop(0);
  }

  /** Touch / pointer drag on the sprite stage rotates the mesh (←→ equivalent). */
  private bindDragRotate() {
    const el = this.canvas;
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      this.dragging = true;
      this.dragX = e.clientX;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.dragging || !this.mesh) return;
      const dx = e.clientX - this.dragX;
      this.dragX = e.clientX;
      if (dx === 0) return;
      this.mesh.rotation.y += dx * 0.01;
      this.onRotate?.();
    });
    const end = () => {
      this.dragging = false;
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("lostpointercapture", end);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  setStatus(msg: string) {
    if (this.statusEl) this.statusEl.textContent = msg;
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth || 320;
    const h = parent.clientHeight || 200;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  async show(pet: Pet) {
    this.setStatus(`Loading ${pet.name}…`);
    this.clearMesh();

    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";

    try {
      const tex = await new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(spritesheetUrl(pet.slug), resolve, undefined, reject);
      });
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      this.texture = tex;
      this.frame = 0;
      this.applyFrame();

      const aspect = CELL_W / CELL_H;
      const geo = new THREE.PlaneGeometry(1.1 * aspect, 1.1);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.05,
      });
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.position.y = 0.05;
      this.scene.add(this.mesh);
      this.setStatus(`${pet.name} · spritesheet`);
    } catch {
      // Fallback: preview gif via image plane using canvas texture from Image
      try {
        const img = await loadImage(previewUrl(pet.slug));
        const tex = new THREE.Texture(img);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        this.texture = tex;
        const aspect = img.width / img.height || 1;
        const geo = new THREE.PlaneGeometry(1.1 * Math.min(aspect, 1.4), 1.1);
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.scene.add(this.mesh);
        this.setStatus(`${pet.name} · preview`);
      } catch {
        const geo = new THREE.CapsuleGeometry(0.28, 0.45, 4, 12);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x4a9eff,
          roughness: 0.4,
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.scene.add(this.mesh);
        this.setStatus(`${pet.name} · placeholder`);
      }
    }
  }

  nudge(dir: "left" | "right") {
    if (!this.mesh) return;
    this.mesh.rotation.y += dir === "left" ? 0.2 : -0.2;
  }

  private applyFrame() {
    if (!this.texture) return;
    // Idle row = row 0 (top of spritesheet in UV is v=1)
    const col = this.frame % COLS;
    const row = 0;
    this.texture.repeat.set(1 / COLS, 1 / ROWS);
    this.texture.offset.set(col / COLS, 1 - (row + 1) / ROWS);
  }

  private clearMesh() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      const mat = this.mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
      this.mesh = null;
    }
    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
  }

  private loop = (t: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = t - (this as unknown as { _last?: number })._last! || 16;
    (this as unknown as { _last: number })._last = t;
    this.acc += dt;
    if (this.texture && this.texture.image && this.acc > 120) {
      this.acc = 0;
      // only animate if it looks like a spritesheet
      const img = this.texture.image as HTMLImageElement;
      if (img.width >= CELL_W * 4) {
        this.frame = (this.frame + 1) % COLS;
        this.applyFrame();
      }
    }
    if (this.mesh) this.mesh.rotation.y += 0.003;
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.clearMesh();
    this.renderer.dispose();
  }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("img fail"));
    img.src = url;
  });
}
