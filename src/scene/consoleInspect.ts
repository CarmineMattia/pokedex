import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS3DObject, CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";

/**
 * Optional 360° inspect for the GBA shell.
 * Play mode keeps the handheld in normal DOM flow (portrait-safe).
 * Inspect mode mounts it into a CSS3D scene for orbit.
 */
export class ConsoleInspect {
  readonly stage: HTMLElement;
  readonly gba: HTMLElement;
  private viewport: HTMLElement;
  private cssRenderer: CSS3DRenderer;
  private glRenderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private glScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private object: CSS3DObject | null = null;
  private shellMesh: THREE.Mesh;
  private raf = 0;
  private baseDistance = 1100;
  private playParent: HTMLElement;
  private playNext: ChildNode | null;
  inspecting = false;
  onChange: ((on: boolean) => void) | null = null;

  constructor(stage: HTMLElement, viewport: HTMLElement, gba: HTMLElement) {
    this.stage = stage;
    this.viewport = viewport;
    this.gba = gba;
    this.playParent = gba.parentElement ?? stage;
    this.playNext = gba.nextSibling;

    this.scene = new THREE.Scene();
    this.glScene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(36, 1, 1, 20000);
    this.camera.position.set(0, 40, 1100);

    this.cssRenderer = new CSS3DRenderer();
    this.cssRenderer.domElement.className = "console-css3d";
    this.viewport.appendChild(this.cssRenderer.domElement);

    this.glRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.glRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.glRenderer.domElement.className = "console-gl";
    this.viewport.insertBefore(
      this.glRenderer.domElement,
      this.cssRenderer.domElement,
    );

    const shellMat = new THREE.MeshStandardMaterial({
      color: 0x1a3568,
      roughness: 0.42,
      metalness: 0.28,
      emissive: 0x0a1830,
      emissiveIntensity: 0.35,
    });
    this.shellMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1, 2, 2, 2),
      shellMat,
    );
    this.shellMesh.scale.set(920, 740, 48);
    this.shellMesh.position.z = -28;
    this.glScene.add(this.shellMesh);

    const key = new THREE.DirectionalLight(0xd8e6ff, 1.15);
    key.position.set(320, 480, 620);
    this.glScene.add(key);
    const fill = new THREE.DirectionalLight(0x6a88c8, 0.45);
    fill.position.set(-420, -120, 280);
    this.glScene.add(fill);
    this.glScene.add(new THREE.AmbientLight(0x4a6088, 0.55));

    const rim = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 64),
      new THREE.MeshBasicMaterial({
        color: 0x152038,
        transparent: true,
        opacity: 0.55,
      }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(0, -420, -40);
    rim.scale.set(1100, 1100, 1);
    this.glScene.add(rim);

    this.controls = new OrbitControls(this.camera, this.cssRenderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 620;
    this.controls.maxDistance = 2200;
    this.controls.target.set(0, 0, 0);
    this.controls.enabled = false;

    this.setViewportActive(false);
    this.resize();
    this.loop();

    window.addEventListener("resize", this.onWindowResize);
  }

  private onWindowResize = () => this.resize();

  private setViewportActive(on: boolean) {
    this.viewport.classList.toggle("is-active", on);
    this.viewport.setAttribute("aria-hidden", on ? "false" : "true");
    this.cssRenderer.domElement.style.pointerEvents = on ? "auto" : "none";
  }

  private syncShellToGba() {
    const w = Math.max(this.gba.offsetWidth, 320);
    const h = Math.max(this.gba.offsetHeight, 280);
    this.shellMesh.scale.set(w * 0.98, h * 0.98, Math.max(36, w * 0.045));
    this.shellMesh.position.z = -Math.max(22, w * 0.028);
    this.baseDistance = Math.max(w, h) * 1.22;
  }

  /** Narrow portrait phones keep flat play UI — no CSS3D orbit. */
  static canInspect(): boolean {
    return window.matchMedia("(min-width: 641px), (orientation: landscape) and (min-width: 500px)").matches;
  }

  setInspecting(on: boolean) {
    if (on && !ConsoleInspect.canInspect()) on = false;
    if (this.inspecting === on) return;
    this.inspecting = on;
    this.stage.classList.toggle("is-inspecting", on);
    this.gba.classList.toggle("is-inspecting", on);
    this.controls.enabled = on;
    this.controls.autoRotate = false;
    this.setViewportActive(on);

    if (on) {
      this.mountIntoScene();
      this.syncShellToGba();
      this.controls.minPolarAngle = 0.15;
      this.controls.maxPolarAngle = Math.PI - 0.15;
      this.resetFrontView();
    } else {
      this.unmountToPlay();
    }

    this.onChange?.(on);
  }

  toggle() {
    this.setInspecting(!this.inspecting);
  }

  private mountIntoScene() {
    if (this.object) return;
    this.playParent = this.gba.parentElement ?? this.stage;
    this.playNext = this.gba.nextSibling;
    this.object = new CSS3DObject(this.gba);
    this.scene.add(this.object);
  }

  private unmountToPlay() {
    if (this.object) {
      this.scene.remove(this.object);
      this.object = null;
    }
    if (this.gba.parentElement !== this.playParent) {
      if (this.playNext && this.playNext.parentNode === this.playParent) {
        this.playParent.insertBefore(this.gba, this.playNext);
      } else {
        this.playParent.appendChild(this.gba);
      }
    }
  }

  resetFrontView() {
    this.syncShellToGba();
    this.camera.position.set(0, this.baseDistance * 0.03, this.baseDistance);
    this.controls.target.set(0, 0, 0);
    this.controls.minPolarAngle = Math.PI / 2 - 0.02;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.02;
    this.controls.update();
    this.camera.lookAt(0, 0, 0);
  }

  resize() {
    const w = this.stage.clientWidth || window.innerWidth;
    const h = this.stage.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.cssRenderer.setSize(w, h);
    this.glRenderer.setSize(w, h, false);
    if (this.inspecting) {
      if (!ConsoleInspect.canInspect()) {
        this.setInspecting(false);
        return;
      }
      this.syncShellToGba();
      this.resetFrontView();
    }
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.inspecting) return;
    this.controls.update();
    this.glRenderer.render(this.glScene, this.camera);
    this.cssRenderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onWindowResize);
    this.setInspecting(false);
    this.controls.dispose();
    this.glRenderer.dispose();
    this.cssRenderer.domElement.remove();
    this.glRenderer.domElement.remove();
  }
}
