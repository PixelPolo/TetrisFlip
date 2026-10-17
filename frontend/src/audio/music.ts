/**
 * "Korobeiniki", the 19th-century Russian folk song that everybody knows as the Tetris tune.
 * The melody is a public-domain folk tune. The synthesis (square lead, triangle bass), the bass
 * line and the tempo curve are our own and nothing here comes from any recording or console
 * score. Do not replace them with transcriptions of a commercial arrangement.
 */

export interface Note {
  /** Scientific pitch name such as "E5", or null for a rest. */
  pitch: string | null;
  /** Length in beats (a quarter note is 1). */
  beats: number;
}

const n = (pitch: string | null, beats: number): Note => ({ pitch, beats });

// prettier-ignore
export const MELODY: Note[] = [
  n('E5', 1), n('B4', 0.5), n('C5', 0.5), n('D5', 1), n('C5', 0.5), n('B4', 0.5),
  n('A4', 1), n('A4', 0.5), n('C5', 0.5), n('E5', 1), n('D5', 0.5), n('C5', 0.5),
  n('B4', 1.5), n('C5', 0.5), n('D5', 1), n('E5', 1),
  n('C5', 1), n('A4', 1), n('A4', 1), n(null, 1),
  n('D5', 1.5), n('F5', 0.5), n('A5', 1), n('G5', 0.5), n('F5', 0.5),
  n('E5', 1.5), n('C5', 0.5), n('E5', 1), n('D5', 0.5), n('C5', 0.5),
  n('B4', 1), n('B4', 0.5), n('C5', 0.5), n('D5', 1), n('E5', 1),
  n('C5', 1), n('A4', 1), n('A4', 2),
];

/** Root note of the bass for each of the eight bars. */
export const BASS_ROOTS = ['A2', 'A2', 'E2', 'A2', 'D2', 'C2', 'E2', 'A2'] as const;

export const BEATS_PER_BAR = 4;

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Frequency in Hz of a pitch name like "A4" (440 Hz). */
export function frequency(pitch: string): number {
  const match = /^([A-G])(#?)(\d)$/.exec(pitch);
  if (!match) throw new Error(`Bad pitch: ${pitch}`);
  const semitone = SEMITONES[match[1]!]! + (match[2] ? 1 : 0);
  const midi = 12 * (Number(match[3]) + 1) + semitone;
  return 440 * 2 ** ((midi - 69) / 12);
}

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Bass note for a given eighth note of a bar: the root, then the fifth above it, and so on. */
export function bassPitch(bar: number, eighth: number): string {
  const root = BASS_ROOTS[bar % BASS_ROOTS.length]!;
  if (eighth % 2 === 0) return root;
  const semitone = CHROMATIC.indexOf(root.slice(0, -1)) + 7;
  const octave = Number(root.slice(-1)) + Math.floor(semitone / 12);
  return `${CHROMATIC[semitone % 12]}${octave}`;
}

/** Beats per minute: the tune speeds up a little with the level. */
export function tempo(level: number): number {
  return 132 + Math.min(level - 1, 10) * 5;
}
