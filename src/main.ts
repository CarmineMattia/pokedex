import "./styles/gba.css";
import { Sfx } from "./audio/sfx";
import { loadPets, padId, type Pet } from "./data/pets";
import { InputBus, type Action } from "./input/bus";
import { PetStage } from "./scene/stage";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
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
          <div class="hint-bar">↑↓ list · ←→ / drag rotate · A open · B top · START gen · hold SELECT mute</div>
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
`;

const gbaEl = document.querySelector<HTMLDivElement>(".gba")!;
const bootEl = document.querySelector<HTMLDivElement>("#boot")!;
const listEl = document.querySelector<HTMLDivElement>("#list")!;
const nameEl = document.querySelector<HTMLHeadingElement>("#name")!;
const metaEl = document.querySelector<HTMLParagraphElement>("#meta")!;
const descEl = document.querySelector<HTMLParagraphElement>("#desc")!;
const stageHost = document.querySelector<HTMLDivElement>("#stage")!;
const stageStatus = document.querySelector<HTMLDivElement>("#stageStatus")!;

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

let pets: Pet[] = [];
let index = 0;
let filterGen: number | "all" = "all";
/** Blocks gameplay inputs until boot splash finishes (SFX still unlock on gesture). */
let inputReady = false;

/** SELECT long-press (≥650ms) toggles mute without clearing the gen filter. */
let selectHoldTimer: number | null = null;
let selectWasLong = false;

function visiblePets() {
  if (filterGen === "all") return pets;
  return pets.filter((p) => p.gen === filterGen);
}

function renderList() {
  const list = visiblePets();
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
  if (!list.length) return;
  index = Math.max(0, Math.min(index, list.length - 1));
  const pet = list[index];
  nameEl.textContent = pet.name;
  metaEl.textContent = `#${padId(pet.pokedex_id)} · Gen ${pet.gen} · ${pet.style.toUpperCase()} · ${pet.category}`;
  descEl.textContent = pet.description;
  renderList();
  if (reloadSprite) await stage.show(pet);
}

function clearGenFilter() {
  filterGen = "all";
  index = 0;
  void sync(true);
}

bus.on((action, pressed) => {
  // SELECT: short press = clear filter (on release); long press = mute toggle
  if (action === "select") {
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
  const list = visiblePets();
  if (!list.length) return;

  if (action === "up") {
    index = (index - 1 + list.length) % list.length;
    void sync(true);
  } else if (action === "down") {
    index = (index + 1) % list.length;
    void sync(true);
  } else if (action === "left") {
    stage.nudge("left");
  } else if (action === "right") {
    stage.nudge("right");
  } else if (action === "a") {
    void sync(true);
  } else if (action === "b") {
    index = 0;
    void sync(true);
  } else if (action === "start") {
    // cycle gen filter: all → 1 → 2 → 3 → all
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
