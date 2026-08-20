/**
 * Lightweight procedural score: no external music asset or autoplay request is
 * needed. `start()` must be called from a player gesture (JACK IN / PLAY).
 */
export class CyberpunkMusic {
  constructor() {
    this.context = null;
    this.master = null;
    this.filter = null;
    this.timer = null;
    this.step = 0;
  }

  start() {
    if (!this.context) this._createGraph();
    if (this.context.state === "suspended") void this.context.resume();
    if (!this.timer) this._startSequencer();
  }

  setPaused(paused) {
    if (!this.context) return;
    if (paused) void this.context.suspend();
    else void this.context.resume();
  }

  _createGraph() {
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.13;
    this.filter = this.context.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 1200;
    this.filter.Q.value = 1.2;
    this.master.connect(this.filter).connect(this.context.destination);

    // A pair of slowly detuned synth pads makes the corridor feel occupied
    // without masking dialogue or interaction sounds.
    for (const [frequency, detune] of [[55, -7], [82.41, 7]]) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = detune;
      gain.gain.value = 0.055;
      oscillator.connect(gain).connect(this.master);
      oscillator.start();
    }
  }

  _startSequencer() {
    const notes = [110, 0, 130.81, 164.81, 146.83, 0, 130.81, 98];
    this.timer = window.setInterval(() => {
      const frequency = notes[this.step++ % notes.length];
      if (frequency) this._playNote(frequency);
    }, 420);
  }

  _playNote(frequency) {
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.34);
  }
}
