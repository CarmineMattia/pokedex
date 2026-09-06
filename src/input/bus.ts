export type Action =
  | "up"
  | "down"
  | "left"
  | "right"
  | "a"
  | "b"
  | "start"
  | "select";

type Handler = (action: Action, pressed: boolean) => void;

const keyMap: Record<string, Action> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
  Enter: "a",
  KeyZ: "a",
  Space: "a",
  Escape: "b",
  KeyX: "b",
  Backspace: "b",
  ShiftLeft: "start",
  ShiftRight: "start",
  ControlLeft: "select",
  ControlRight: "select",
  KeyC: "select",
};

export class InputBus {
  private handlers = new Set<Handler>();
  private held = new Set<Action>();
  private repeatTimers = new Map<Action, number>();

  on(handler: Handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  emit(action: Action, pressed: boolean) {
    if (pressed) {
      if (this.held.has(action)) return;
      this.held.add(action);
    } else {
      if (!this.held.has(action)) return;
      this.held.delete(action);
      const t = this.repeatTimers.get(action);
      if (t) {
        window.clearInterval(t);
        this.repeatTimers.delete(action);
      }
    }
    for (const h of this.handlers) h(action, pressed);
  }

  bindKeyboard() {
    const isTypingTarget = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable
      );
    };
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const action = keyMap[e.code];
      if (!action) return;
      e.preventDefault();
      this.emit(action, true);
      if (
        (action === "up" || action === "down") &&
        !this.repeatTimers.has(action)
      ) {
        const id = window.setInterval(() => {
          for (const h of this.handlers) h(action, true);
        }, 120);
        this.repeatTimers.set(action, id);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const action = keyMap[e.code];
      if (!action) return;
      e.preventDefault();
      this.emit(action, false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }

  bindButton(el: HTMLElement, action: Action) {
    const press = (e: PointerEvent) => {
      // Primary button / touch / pen only
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore unsupported capture */
      }
      this.emit(action, true);
      if (
        (action === "up" || action === "down") &&
        !this.repeatTimers.has(action)
      ) {
        const id = window.setInterval(() => {
          for (const h of this.handlers) h(action, true);
        }, 120);
        this.repeatTimers.set(action, id);
      }
    };
    const release = (e: Event) => {
      e.preventDefault();
      this.emit(action, false);
    };
    // Capture keeps press/release reliable when the finger slides off the hit target
    el.addEventListener("pointerdown", press);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("lostpointercapture", release);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }
}
