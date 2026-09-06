import "./styles/gba.css";
import { Sfx } from "./audio/sfx";
import { loadPets, padId, type Pet } from "./data/pets";
import { InputBus, type Action } from "./input/bus";
import { ConsoleInspect } from "./scene/consoleInspect";
import { PetStage } from "./scene/stage";

type Prediction = { label: string; prob: number };

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <div class="console-stage" id="consoleStage">
    <button type="button" class="inspect-toggle" id="inspectToggle" title="Inspect console (360°)" aria-pressed="false" aria-label="Toggle 360 degree console inspect">
      <svg class="inspect-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 5c-5 0-9.3 3.1-11 7 1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
      </svg>
    </button>
    <div class="console-viewport" id="consoleViewport" aria-hidden="true"></div>
    <div class="gba is-booting" role="application" aria-label="Pokédex">
      <div class="gba-top">
        <span class="power" aria-hidden="true"></span>
        <span class="power-label">POWER</span>
      </div>
      <div class="screen-bezel">
        <div class="screen">
          <div class="boot-overlay" id="boot" aria-busy="true" aria-live="polite">
            <div class="boot-glow" aria-hidden="true"></div>
            <div class="boot-scanlines" aria-hidden="true"></div>
            <div class="boot-splash">
              <p class="boot-title">Pokédex</p>
              <p class="boot-copy">GAME BOY COLOR</p>
            </div>
          </div>
          <div class="search-bar">
            <label class="search-label" for="search">FIND</label>
            <input
              class="search-input"
              id="search"
              type="text"
              inputmode="search"
              name="find"
              autocomplete="off"
              spellcheck="false"
              enterkeyhint="go"
              placeholder="NAME / #"
              aria-label="Search Pokémon by name or number"
            />
            <span class="search-count" id="searchCount" aria-live="polite"></span>
          </div>
          <div class="list-pane" id="list"></div>
          <div class="detail-pane">
            <div>
              <h2 id="name">Loading…</h2>
              <p class="detail-meta" id="meta"></p>
              <p class="detail-desc" id="desc"></p>
            </div>
            <div class="stage-wrap" id="stage">
              <div class="stage-status" id="stageStatus"></div>
            </div>
            <div class="hint-bar">FIND · ↑↓ · ←→ rotate · A · B · START gen · CAM · hold SELECT mute</div>
          </div>
          <div class="scan-overlay" id="scan" hidden>
            <video id="scanVideo" playsinline muted autoplay></video>
            <div class="scan-panel">
              <p class="scan-status" id="scanStatus">Camera</p>
              <div class="scan-actions">
                <button type="button" class="scan-btn" id="scanCapture">Scan</button>
                <button type="button" class="scan-btn scan-btn-ghost" id="scanClose">Close</button>
              </div>
              <div class="scan-top5" id="scanTop5" hidden></div>
            </div>
          </div>
        </div>
      </div>
      <div class="controls">
        <div class="dpad" aria-label="D-pad">
          <button type="button" class="up" data-action="up">▲</button>
          <button type="button" class="left" data-action="left">◀</button>
          <div class="mid"></div>
          <button type="button" class="right" data-action="right">▶</button>
          <button type="button" class="down" data-action="down">▼</button>
        </div>
        <div class="mid-btns">
          <button type="button" class="pill" data-action="select">SELECT</button>
          <button type="button" class="pill pill-cam" id="camBtn" title="Scan Pokémon (Gen 1)">CAM</button>
          <button type="button" class="pill" data-action="start">START</button>
        </div>
        <div class="ab">
          <button type="button" class="b" data-action="b">B</button>
          <button type="button" class="a" data-action="a">A</button>
          <div class="speaker" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span></div>
        </div>
      </div>
      <div class="brand">codex pokédex</div>
    </div>
  </div>
`;

const consoleStage = document.querySelector<HTMLDivElement>("#consoleStage")!;
const consoleViewport = document.querySelector<HTMLDivElement>("#consoleViewport")!;
const inspectToggle = document.querySelector<HTMLButtonElement>("#inspectToggle")!;
const gbaEl = document.querySelector<HTMLDivElement>(".gba")!;
const bootEl = document.querySelector<HTMLDivElement>("#boot")!;
const listEl = document.querySelector<HTMLDivElement>("#list")!;
const nameEl = document.querySelector<HTMLHeadingElement>("#name")!;
const metaEl = document.querySelector<HTMLParagraphElement>("#meta")!;
const descEl = document.querySelector<HTMLParagraphElement>("#desc")!;
const stageHost = document.querySelector<HTMLDivElement>("#stage")!;
const stageStatus = document.querySelector<HTMLDivElement>("#stageStatus")!;
const searchEl = document.querySelector<HTMLInputElement>("#search")!;
const searchCountEl = document.querySelector<HTMLSpanElement>("#searchCount")!;
const camBtn = document.querySelector<HTMLButtonElement>("#camBtn")!;
const scanEl = document.querySelector<HTMLDivElement>("#scan")!;
const scanVideo = document.querySelector<HTMLVideoElement>("#scanVideo")!;
const scanStatus = document.querySelector<HTMLParagraphElement>("#scanStatus")!;
const scanCapture = document.querySelector<HTMLButtonElement>("#scanCapture")!;
const scanClose = document.querySelector<HTMLButtonElement>("#scanClose")!;
const scanTop5 = document.querySelector<HTMLDivElement>("#scanTop5")!;

const sfx = new Sfx();
sfx.installGestureUnlock();

const bus = new InputBus();
bus.bindKeyboard();
document.querySelectorAll<HTMLElement>("[data-action]").forEach((el) => {
  bus.bindButton(el, el.dataset.action as Action);
});

const stage = new PetStage(stageHost, stageStatus);
stage.onRotate = () => sfx.playRotateTick();
window.addEventListener("resize", () => stage.resize());
window.addEventListener("orientationchange", () => {
  requestAnimationFrame(() => stage.resize());
});
// Recalc WebGL size when the LCD flex layout settles (esp. mobile portrait).
if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => stage.resize()).observe(stageHost);
}

const consoleInspect = new ConsoleInspect(consoleStage, consoleViewport, gbaEl);
consoleInspect.onChange = (on) => {
  inspectToggle.setAttribute("aria-pressed", on ? "true" : "false");
  inspectToggle.classList.toggle("is-on", on);
};

function syncInspectToggleVisibility() {
  const ok = ConsoleInspect.canInspect();
  inspectToggle.hidden = !ok;
  if (!ok && consoleInspect.inspecting) consoleInspect.setInspecting(false);
}
syncInspectToggleVisibility();
window.addEventListener("resize", syncInspectToggleVisibility);

inspectToggle.addEventListener("click", (e) => {
  e.preventDefault();
  if (!ConsoleInspect.canInspect()) return;
  void sfx.unlock();
  sfx.play("tap");
  consoleInspect.toggle();
});

let pets: Pet[] = [];
let index = 0;
let filterGen: number | "all" = "all";
let query = "";
/** Blocks gameplay inputs until boot splash finishes (SFX still unlock on gesture). */
let inputReady = false;
let scanStream: MediaStream | null = null;
let scanning = false;

/** SELECT long-press (≥650ms) toggles mute without clearing the gen filter. */
let selectHoldTimer: number | null = null;
let selectWasLong = false;
let lastTypeAt = 0;

function matchesQuery(pet: Pet, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/^#/, "");
  if (/^\d+$/.test(digits)) {
    const idStr = String(pet.pokedex_id);
    const padded = padId(pet.pokedex_id);
    return idStr === digits || idStr.startsWith(digits) || padded.includes(digits);
  }
  return pet.name.toLowerCase().includes(q) || pet.slug.toLowerCase().includes(q);
}

function visiblePets() {
  let list = filterGen === "all" ? pets : pets.filter((p) => p.gen === filterGen);
  if (query.trim()) list = list.filter((p) => matchesQuery(p, query));
  return list;
}

function updateSearchCount(listLen: number) {
  if (!query.trim()) {
    searchCountEl.textContent = "";
    return;
  }
  searchCountEl.textContent = `${listLen}`;
}

function renderList() {
  const list = visiblePets();
  updateSearchCount(list.length);

  if (!list.length) {
    listEl.innerHTML = `<div class="list-empty">NO DATA</div>`;
    return;
  }

  listEl.innerHTML = list
    .map(
      (p, i) => `
      <div class="list-item ${i === index ? "is-active" : ""}" data-i="${i}">
        <span class="num">#${padId(p.pokedex_id)}</span>
        <span>${p.name}</span>
      </div>`,
    )
    .join("");
  listEl.querySelectorAll<HTMLElement>(".list-item").forEach((el) => {
    el.addEventListener("click", () => {
      if (!inputReady) return;
      index = Number(el.dataset.i);
      sfx.play("tap");
      void sync(true);
    });
  });
  const active = listEl.querySelector(".is-active");
  active?.scrollIntoView({ block: "nearest" });
}

async function sync(reloadSprite: boolean) {
  const list = visiblePets();
  updateSearchCount(list.length);

  if (!list.length) {
    nameEl.textContent = query.trim() ? "Not found" : "Empty";
    metaEl.textContent = query.trim() ? `FIND “${query.trim()}”` : "";
    descEl.textContent = "Try another name or Pokédex number.";
    renderList();
    return;
  }

  index = Math.max(0, Math.min(index, list.length - 1));
  const pet = list[index];
  nameEl.textContent = pet.name;
  metaEl.textContent = `#${padId(pet.pokedex_id)} · Gen ${pet.gen} · ${pet.style.toUpperCase()} · ${pet.category}`;
  descEl.textContent = pet.description;
  renderList();
  if (reloadSprite) {
    await stage.show(pet);
    stage.resize();
  }
}

function clearGenFilter() {
  filterGen = "all";
  index = 0;
  void sync(true);
}

function applySearch(next: string, opts?: { confirm?: boolean; playType?: boolean }) {
  const prevList = visiblePets();
  const current = prevList[index];
  const prev = query;
  query = next;
  if (opts?.playType && next !== prev) {
    const now = performance.now();
    if (now - lastTypeAt > 55) {
      lastTypeAt = now;
      try {
        sfx.play("type");
      } catch {
        /* audio locked / unavailable */
      }
    }
  }
  const list = visiblePets();
  if (current) {
    const kept = list.findIndex((p) => p.pokedex_id === current.pokedex_id);
    index = kept >= 0 ? kept : 0;
  } else {
    index = 0;
  }
  if (opts?.confirm) {
    try {
      sfx.play("search");
    } catch {
      /* ignore */
    }
  }
  void sync(true);
}

/** Jump selection to first match; Enter confirms current filtered pick. */
function confirmSearch() {
  if (!inputReady) return;
  const list = visiblePets();
  if (!list.length) {
    try {
      sfx.play("b");
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    sfx.play("search");
  } catch {
    /* ignore */
  }
  void sync(true);
  searchEl.blur();
}

searchEl.addEventListener("input", () => {
  applySearch(searchEl.value, { playType: true });
});

searchEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    confirmSearch();
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    if (searchEl.value) {
      searchEl.value = "";
      applySearch("", { confirm: true });
    } else {
      searchEl.blur();
    }
    return;
  }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    e.stopPropagation();
    if (!inputReady) return;
    const list = visiblePets();
    if (!list.length) return;
    try {
      sfx.play(e.key === "ArrowDown" ? "down" : "up");
    } catch {
      /* ignore */
    }
    if (e.key === "ArrowDown") index = (index + 1) % list.length;
    else index = (index - 1 + list.length) % list.length;
    void sync(true);
  }
});

searchEl.addEventListener("focus", () => {
  void sfx.unlock();
});

async function jumpToPet(pet: Pet) {
  const { indexOfPet } = await import("./vision/match");
  filterGen = "all";
  query = "";
  searchEl.value = "";
  const list = visiblePets();
  const i = indexOfPet(list, pet);
  if (i < 0) {
    scanStatus.textContent = `No entry for ${pet.name}`;
    return false;
  }
  index = i;
  void sync(true);
  return true;
}

function stopScanCamera() {
  if (scanStream) {
    scanStream.getTracks().forEach((t) => t.stop());
    scanStream = null;
  }
  scanVideo.srcObject = null;
}

function closeScan() {
  scanning = false;
  stopScanCamera();
  scanEl.hidden = true;
  scanTop5.hidden = true;
  scanTop5.innerHTML = "";
  scanStatus.textContent = "Camera";
  scanCapture.disabled = false;
}

function renderTop5(top5: Prediction[]) {
  scanTop5.hidden = false;
  scanTop5.innerHTML = top5
    .map((p, i) => {
      const pct = Math.round(p.prob * 100);
      return `<button type="button" class="scan-guess" data-label="${p.label}" data-i="${i}">${p.label} · ${pct}%</button>`;
    })
    .join("");
  scanTop5.querySelectorAll<HTMLButtonElement>(".scan-guess").forEach((btn) => {
    btn.addEventListener("click", () => {
      const label = btn.dataset.label;
      if (!label) return;
      sfx.play("tap");
      void applyLabel(label);
    });
  });
}

async function applyLabel(label: string) {
  const { findPetForLabel } = await import("./vision/match");
  const pet = findPetForLabel(pets, label);
  if (!pet) {
    scanStatus.textContent = `Unmapped: ${label}`;
    return;
  }
  if (await jumpToPet(pet)) {
    scanStatus.textContent = `Found ${pet.name}`;
    sfx.play("a");
    window.setTimeout(() => closeScan(), 350);
  }
}

async function openScan() {
  if (!inputReady || scanning) return;
  if (consoleInspect.inspecting) consoleInspect.setInspecting(false);
  scanning = true;
  scanEl.hidden = false;
  scanTop5.hidden = true;
  scanTop5.innerHTML = "";
  scanStatus.textContent = "Starting camera…";
  scanCapture.disabled = true;
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    scanVideo.srcObject = scanStream;
    await scanVideo.play();
    scanStatus.textContent = "Point at a Gen 1 Pokémon";
    scanCapture.disabled = false;
    void import("./vision/recognize")
      .then((m) => m.loadCosmidexModel())
      .catch(() => {
        /* shown on capture */
      });
  } catch (e) {
    scanStatus.textContent = `Camera denied: ${e instanceof Error ? e.message : String(e)}`;
    scanCapture.disabled = true;
  }
}

async function captureScan() {
  if (!scanStream || !scanVideo.videoWidth) {
    scanStatus.textContent = "Camera not ready";
    return;
  }
  scanCapture.disabled = true;
  scanStatus.textContent = "Loading model…";
  try {
    const { CONFIDENCE_THRESHOLD, loadCosmidexModel, recognizeFrame } =
      await import("./vision/recognize");
    const model = await loadCosmidexModel();
    scanStatus.textContent = "Recognizing…";
    const { top, top5 } = await recognizeFrame(model, scanVideo);
    const pct = Math.round(top.prob * 100);
    if (top.prob >= CONFIDENCE_THRESHOLD) {
      scanStatus.textContent = `${top.label} (${pct}%)`;
      await applyLabel(top.label);
    } else {
      scanStatus.textContent = `Low confidence (${pct}%) — pick one`;
      renderTop5(top5);
      scanCapture.disabled = false;
    }
  } catch (e) {
    scanStatus.textContent = `Scan failed: ${e instanceof Error ? e.message : String(e)}`;
    scanCapture.disabled = false;
  }
}

camBtn.addEventListener("click", (e) => {
  e.preventDefault();
  if (!inputReady) return;
  void sfx.unlock();
  sfx.play("tap");
  void openScan();
});
scanClose.addEventListener("click", (e) => {
  e.preventDefault();
  sfx.play("b");
  closeScan();
});
scanCapture.addEventListener("click", (e) => {
  e.preventDefault();
  sfx.play("a");
  void captureScan();
});

bus.on((action, pressed) => {
  // SELECT: short press = clear filter (on release); long press = mute toggle
  if (action === "select") {
    if (!scanEl.hidden) return;
    if (pressed) {
      void sfx.unlock();
      selectWasLong = false;
      if (selectHoldTimer != null) window.clearTimeout(selectHoldTimer);
      selectHoldTimer = window.setTimeout(() => {
        selectWasLong = true;
        selectHoldTimer = null;
        sfx.toggleMute();
      }, 650);
      return;
    }
    if (selectHoldTimer != null) {
      window.clearTimeout(selectHoldTimer);
      selectHoldTimer = null;
    }
    if (!selectWasLong && inputReady) {
      sfx.playAction("select");
      clearGenFilter();
    }
    return;
  }

  if (!pressed) return;
  void sfx.unlock();
  sfx.playAction(action);

  if (!inputReady) return;

  // While the scan overlay is open, only B / Esc closes it
  if (!scanEl.hidden) {
    if (action === "b") closeScan();
    return;
  }

  // In inspect mode, gameplay pad is paused (orbit via drag)
  if (consoleInspect.inspecting) {
    if (action === "b") consoleInspect.setInspecting(false);
    return;
  }

  const list = visiblePets();
  if (!list.length && action !== "b" && action !== "start") return;

  if (action === "up") {
    if (!list.length) return;
    index = (index - 1 + list.length) % list.length;
    void sync(true);
  } else if (action === "down") {
    if (!list.length) return;
    index = (index + 1) % list.length;
    void sync(true);
  } else if (action === "left") {
    stage.nudge("left");
  } else if (action === "right") {
    stage.nudge("right");
  } else if (action === "a") {
    void sync(true);
  } else if (action === "b") {
    if (query.trim()) {
      searchEl.value = "";
      applySearch("");
      return;
    }
    index = 0;
    void sync(true);
  } else if (action === "start") {
    if (filterGen === "all") filterGen = 1;
    else if (filterGen >= 3) filterGen = "all";
    else filterGen = (filterGen as number) + 1;
    index = 0;
    void sync(true);
  }
});

function finishBootSequence() {
  bootEl.classList.add("is-done");
  bootEl.setAttribute("aria-busy", "false");
  gbaEl.classList.remove("is-booting");
  inputReady = true;
  sfx.play("boot");
  window.setTimeout(() => bootEl.remove(), 600);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function boot() {
  const reduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  const minSplash = reduced ? 200 : 1800;

  try {
    await Promise.all([
      loadPets().then((data) => {
        pets = data;
        index = 0;
        return sync(true);
      }),
      wait(minSplash),
    ]);
  } catch (e) {
    nameEl.textContent = "Load failed";
    descEl.textContent = String(e);
    await wait(reduced ? 100 : 900);
  }

  finishBootSequence();
}

boot();
