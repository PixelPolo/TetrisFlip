import { BASS_ROOTS, BEATS_PER_BAR, MELODY, bassPitch, frequency, tempo } from './music';

export type Sfx =
  | 'move'
  | 'rotate'
  | 'hold'
  | 'lock'
  | 'hardDrop'
  | 'clear'
  | 'tetris'
  | 'flip'
  | 'bullet'
  | 'gameOver';

const MUTE_KEY = 'muted';
const LOOKAHEAD_S = 0.4;

/**
 * Procedural sound: everything is synthesised with the Web Audio API (no audio files).
 * The audio context is only created by `unlock()`, which must run inside a user gesture.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer = 0;
  private level = 1;
  private musicWanted = false;
  /** Position in the song, in beats, and the audio-clock time of the next unscheduled note. */
  private noteIndex = 0;
  private bassStep = 0;
  private nextMelodyTime = 0;
  private nextBassTime = 0;
  muted = readMuted();

  /** Creates (or resumes) the audio context. Call it from a click or key handler. */
  unlock(): void {
    if (this.ctx?.state === 'running') return;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return; // Audio blocked or unavailable: the game just stays silent.
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume();
    if (this.musicWanted) this.startScheduler();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // Blocked storage: the choice just won't persist.
    }
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
  }

  setLevel(level: number): void {
    this.level = level;
  }

  /** Starts or stops the background tune (it restarts from the top after a stop). */
  setMusic(on: boolean): void {
    if (on === this.musicWanted) return;
    this.musicWanted = on;
    if (on) this.startScheduler();
    else this.stopScheduler();
  }

  play(sfx: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime;
    switch (sfx) {
      case 'move':
        this.blip(t, 330, 0.03, 'square', 0.05);
        break;
      case 'rotate':
        this.blip(t, 520, 0.04, 'square', 0.06);
        break;
      case 'hold':
        this.blip(t, 440, 0.05, 'triangle', 0.1);
        this.blip(t + 0.05, 660, 0.06, 'triangle', 0.1);
        break;
      case 'lock':
        this.blip(t, 160, 0.07, 'square', 0.08);
        break;
      case 'hardDrop':
        this.sweep(t, 220, 60, 0.12, 'square', 0.12);
        break;
      case 'clear':
        [523, 659, 784].forEach((f, i) => this.blip(t + i * 0.06, f, 0.1, 'square', 0.08));
        break;
      case 'tetris':
        [523, 659, 784, 1047, 1319].forEach((f, i) =>
          this.blip(t + i * 0.07, f, 0.14, 'square', 0.09),
        );
        break;
      case 'flip':
        this.sweep(t, 700, 120, 0.6, 'sawtooth', 0.07);
        this.sweep(t + 0.5, 120, 600, 0.5, 'sawtooth', 0.07);
        break;
      case 'bullet':
        this.sweep(t, 70, 500, 1.4, 'sawtooth', 0.08);
        this.sweep(t + 1.4, 500, 60, 1.5, 'sawtooth', 0.08);
        break;
      case 'gameOver':
        [440, 370, 311, 247, 196].forEach((f, i) =>
          this.blip(t + i * 0.16, f, 0.2, 'triangle', 0.12),
        );
        break;
    }
  }

  private startScheduler(): void {
    if (!this.ctx || this.timer) return;
    this.noteIndex = 0;
    this.bassStep = 0;
    this.nextMelodyTime = this.nextBassTime = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 100);
    this.schedule();
  }

  private stopScheduler(): void {
    clearInterval(this.timer);
    this.timer = 0;
  }

  /** Queues the notes that fall in the next fraction of a second, so timing stays exact. */
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const beat = 60 / tempo(this.level);
    // After a long stall (background tab), skip ahead instead of playing a burst of old notes.
    this.nextMelodyTime = Math.max(this.nextMelodyTime, ctx.currentTime + 0.05);
    this.nextBassTime = Math.max(this.nextBassTime, ctx.currentTime + 0.05);
    while (this.nextMelodyTime < ctx.currentTime + LOOKAHEAD_S) {
      const note = MELODY[this.noteIndex % MELODY.length]!;
      if (note.pitch)
        this.tone(
          this.nextMelodyTime,
          frequency(note.pitch),
          note.beats * beat * 0.92,
          'square',
          0.045,
        );
      this.nextMelodyTime += note.beats * beat;
      this.noteIndex++;
    }
    const eighth = beat / 2;
    const eighthsPerBar = BEATS_PER_BAR * 2;
    while (this.nextBassTime < ctx.currentTime + LOOKAHEAD_S) {
      const bar = Math.floor(this.bassStep / eighthsPerBar) % BASS_ROOTS.length;
      const pitch = bassPitch(bar, this.bassStep % eighthsPerBar);
      this.tone(this.nextBassTime, frequency(pitch), eighth * 0.8, 'triangle', 0.1);
      this.nextBassTime += eighth;
      this.bassStep++;
    }
  }

  /** One note with a short attack and a smooth release, so it never clicks. */
  private tone(
    start: number,
    freq: number,
    length: number,
    type: OscillatorType,
    volume: number,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.setValueAtTime(volume, start + Math.max(0.011, length - 0.04));
    gain.gain.linearRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(this.master!);
    osc.start(start);
    osc.stop(start + length + 0.02);
  }

  private blip(
    start: number,
    freq: number,
    length: number,
    type: OscillatorType,
    volume: number,
  ): void {
    this.tone(start, freq, length, type, volume);
  }

  private sweep(
    start: number,
    from: number,
    to: number,
    length: number,
    type: OscillatorType,
    volume: number,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(to, start + length);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.linearRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(this.master!);
    osc.start(start);
    osc.stop(start + length + 0.02);
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
