/** Normalizes a KeyboardEvent to a `code`-like token, falling back to `key`
 * when `code`/`keyCode` are missing (some automation/CDP-driven input only sets `key`). */
export function codeFromEvent(e) {
  if (e.code) return e.code;
  const k = e.key;
  if (!k) return "";
  if (k === " ") return "Space";
  if (k.length === 1 && /[a-zA-Z]/.test(k)) return "Key" + k.toUpperCase();
  if (k.length === 1 && /[0-9]/.test(k)) return "Digit" + k;
  if (k === "Shift") return "ShiftLeft";
  return k;
}

export class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.pointerLocked = false;
    this.lookDX = 0;
    this.lookDY = 0;
    this.wheelDelta = 0;
    this.interactPressed = false;
    this.chatActive = false;

    this._onKeyDown = (e) => {
      if (this.chatActive) return;
      const code = codeFromEvent(e);
      this.keys.add(code);
      if (code === "KeyE") this.interactPressed = true;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(codeFromEvent(e));
    this._onMouseMove = (e) => {
      if (!this.pointerLocked) return;
      this.lookDX += e.movementX || 0;
      this.lookDY += e.movementY || 0;
    };
    this._onWheel = (e) => {
      this.wheelDelta += e.deltaY;
    };
    this._onPointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.dom;
    };
    this._onClick = () => {
      if (!this.pointerLocked && !this.chatActive) {
        const p = this.dom.requestPointerLock?.();
        p?.catch?.(() => {});
      }
    };

    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);
    document.addEventListener("mousemove", this._onMouseMove);
    document.addEventListener("pointerlockchange", this._onPointerLockChange);
    this.dom.addEventListener("wheel", this._onWheel, { passive: true });
    this.dom.addEventListener("click", this._onClick);
  }

  isDown(code) {
    return this.keys.has(code);
  }

  consumeLook() {
    const dx = this.lookDX;
    const dy = this.lookDY;
    this.lookDX = 0;
    this.lookDY = 0;
    return { dx, dy };
  }

  consumeWheel() {
    const w = this.wheelDelta;
    this.wheelDelta = 0;
    return w;
  }

  consumeInteract() {
    const v = this.interactPressed;
    this.interactPressed = false;
    return v;
  }

  releasePointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  setChatActive(v) {
    this.chatActive = v;
    if (v) {
      this.keys.clear();
      this.releasePointerLock();
    }
  }

  dispose() {
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("keyup", this._onKeyUp);
    document.removeEventListener("mousemove", this._onMouseMove);
    document.removeEventListener("pointerlockchange", this._onPointerLockChange);
    this.dom.removeEventListener("wheel", this._onWheel);
    this.dom.removeEventListener("click", this._onClick);
  }
}
