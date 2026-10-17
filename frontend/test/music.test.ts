import { describe, expect, it } from 'vitest';
import { BASS_ROOTS, BEATS_PER_BAR, MELODY, bassPitch, frequency, tempo } from '../src/audio/music';

describe('music', () => {
  it('converts pitch names to frequencies', () => {
    expect(frequency('A4')).toBeCloseTo(440);
    expect(frequency('A5')).toBeCloseTo(880);
    expect(frequency('C4')).toBeCloseTo(261.63, 1);
    expect(() => frequency('H9')).toThrow();
  });

  it('has a melody that fills whole bars and one bass root per bar', () => {
    const beats = MELODY.reduce((sum, note) => sum + note.beats, 0);
    expect(beats).toBe(BASS_ROOTS.length * BEATS_PER_BAR);
    for (const note of MELODY) if (note.pitch) expect(frequency(note.pitch)).toBeGreaterThan(0);
  });

  it('alternates the bass between the root and the fifth', () => {
    expect(bassPitch(0, 0)).toBe('A2');
    expect(bassPitch(0, 1)).toBe('E3');
    expect(bassPitch(4, 1)).toBe('A2'); // D2 + a fifth
    expect(bassPitch(2, 1)).toBe('B2'); // E2 + a fifth
  });

  it('speeds up with the level but stays bounded', () => {
    expect(tempo(5)).toBeGreaterThan(tempo(1));
    expect(tempo(99)).toBe(tempo(11));
  });
});
