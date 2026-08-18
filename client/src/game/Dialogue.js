/** Plays a list of {speaker, text} lines one at a time, advanced by calling next(). */
export class DialogueSequencer {
  constructor({ onLine, onDone }) {
    this.onLine = onLine;
    this.onDone = onDone;
    this.lines = [];
    this.index = -1;
  }

  get active() {
    return this.index >= 0 && this.index < this.lines.length;
  }

  play(lines) {
    this.lines = lines || [];
    this.index = -1;
    this.next();
  }

  next() {
    this.index += 1;
    if (this.index >= this.lines.length) {
      this.lines = [];
      this.index = -1;
      this.onDone?.();
      return;
    }
    this.onLine?.(this.lines[this.index], this.index === this.lines.length - 1);
  }
}
