import type { Action } from "../input/bus";

export type SfxCue = Action | "boot" | "mute" | "unmute" | "tap" | "type" | "search";

type Tone = {
  freq: number;
  dur: number;
  vol?: number;
  type?: OscillatorType;
  slide?: number;
  delay?: number;
};

/**
 * Lightweight Game Boy–style SFX via Web Audio (square blips, no assets).
 * Respects browser autoplay: call unlock() / installGestureUnlock() on first gesture.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;
  private lastRotateAt = 0;
  private unlockCleanups: Array<() => void> = [];

  /** Attach one-shot listeners so the first key/pointer gesture unlocks audio. */
  installGestureUnlock() {
    const unlock = () => {
      void this.unlock();
    };
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);
    this.unlockCleanups.push(() => {
      window.removeEventListener("pointerdown", unlock, opts);
      window.removeEventListener("keydown", unlock, opts);
      window.removeEventListener("touchstart", unlock, opts);
    });
  }

  async unlock() {
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* autoplay still blocked */
      }
    }
    if (ctx.state === "running") {
      for (const off of this.unlockCleanups.splice(0)) off();
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.play(this.muted ? "mute" : "unmute");
    return this.muted;
  }

  /** Map an InputBus action to its cue (same for keyboard + on-screen buttons). */
  playAction(action: Action) {
    this.play(action);
  }

  /** Throttled blip while dragging the sprite (←→ equivalent). */
  playRotateTick() {
    const now = performance.now();
    if (now - this.lastRotateAt < 90) return;
    this.lastRotateAt = now;
    this.play("left");
  }

  play(cue: SfxCue) {
    if (cue !== "mute" && cue !== "unmute" && this.muted) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") {
      // Schedule after resume so the first gesture still hears a blip
      void ctx.resume().then(() => {
        for (const off of this.unlockCleanups.splice(0)) off();
        this.playNow(cue);
      });
      return;
    }
    this.playNow(cue);
  }

  private playNow(cue: SfxCue) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;

    const tones = cues[cue];
    if (!tones) return;
    const t0 = ctx.currentTime + 0.001;
    for (const tone of tones) {
      this.beep(t0 + (tone.delay ?? 0), tone);
    }
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private beep(when: number, tone: Tone) {
    const ctx = this.ctx!;
    const master = this.master!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type ?? "square";
    osc.frequency.setValueAtTime(tone.freq, when);
    if (tone.slide) {
      osc.frequency.linearRampToValueAtTime(
        tone.freq + tone.slide,
        when + tone.dur,
      );
    }

    const peak = tone.vol ?? 0.55;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + tone.dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(when);
    osc.stop(when + tone.dur + 0.02);
  }
}

/** Classic handheld mapping: short square blips / two-note confirms. */
const cues: Record<SfxCue, Tone[]> = {
  up: [{ freq: 880, dur: 0.045, vol: 0.4 }],
  down: [{ freq: 660, dur: 0.045, vol: 0.4 }],
  left: [{ freq: 520, dur: 0.035, vol: 0.32 }],
  right: [{ freq: 580, dur: 0.035, vol: 0.32 }],
  a: [
    { freq: 784, dur: 0.05, vol: 0.5 },
    { freq: 1046, dur: 0.07, vol: 0.45, delay: 0.05 },
  ],
  b: [
    { freq: 392, dur: 0.055, vol: 0.45 },
    { freq: 294, dur: 0.08, vol: 0.4, delay: 0.05 },
  ],
  start: [
    { freq: 523, dur: 0.055, vol: 0.42 },
    { freq: 659, dur: 0.055, vol: 0.42, delay: 0.055 },
    { freq: 784, dur: 0.09, vol: 0.4, delay: 0.11 },
  ],
  select: [{ freq: 700, dur: 0.05, vol: 0.35 }],
  tap: [{ freq: 740, dur: 0.04, vol: 0.38 }],
  /** Soft key-click while typing in FIND */
  type: [{ freq: 920, dur: 0.022, vol: 0.18, type: "square" }],
  /** Confirm / jump-to-match from search */
  search: [
    { freq: 660, dur: 0.04, vol: 0.35 },
    { freq: 880, dur: 0.055, vol: 0.32, delay: 0.04 },
  ],
  boot: [
    { freq: 220, dur: 0.08, vol: 0.35 },
    { freq: 330, dur: 0.08, vol: 0.4, delay: 0.09 },
    { freq: 440, dur: 0.1, vol: 0.45, delay: 0.18 },
    { freq: 880, dur: 0.14, vol: 0.4, delay: 0.3 },
  ],
  mute: [
    { freq: 600, dur: 0.05, vol: 0.4 },
    { freq: 300, dur: 0.1, vol: 0.35, delay: 0.06 },
  ],
  unmute: [
    { freq: 300, dur: 0.05, vol: 0.4 },
    { freq: 600, dur: 0.1, vol: 0.35, delay: 0.06 },
  ],
};
