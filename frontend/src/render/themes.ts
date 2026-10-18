import type { PieceType } from '../game/pieces';

export interface Theme {
  id: ThemeId;
  background: string;
  frame: string;
  /** Frame colour while the camera is behind the board (same intensity as `frame`). */
  frameBehind: string;
  gridLines: string;
  text: string;
  panel: string;
  accent: string;
  pieces: Record<PieceType, string>;
}

export type ThemeId = 'color' | 'gameboy';

/** Modern guideline colours. */
const COLOR: Theme = {
  id: 'color',
  background: '#0b1020',
  frame: '#3b4a7a',
  frameBehind: '#7a3b3b',
  gridLines: '#1f2a4d',
  text: '#e8ecff',
  panel: 'rgba(20, 28, 56, 0.85)',
  accent: '#7aa2ff',
  pieces: {
    I: '#22d3ee',
    O: '#facc15',
    T: '#a855f7',
    S: '#22c55e',
    Z: '#ef4444',
    J: '#3b82f6',
    L: '#f97316',
  },
};

/** The original four-shade green of the Game Boy screen. */
const GAMEBOY: Theme = {
  id: 'gameboy',
  background: '#9bbc0f',
  frame: '#0f380f',
  frameBehind: '#380f0f',
  gridLines: '#8bac0f',
  text: '#0f380f',
  panel: 'rgba(139, 172, 15, 0.9)',
  accent: '#306230',
  pieces: {
    I: '#306230',
    O: '#0f380f',
    T: '#306230',
    S: '#0f380f',
    Z: '#306230',
    J: '#0f380f',
    L: '#306230',
  },
};

export const THEMES: Record<ThemeId, Theme> = { color: COLOR, gameboy: GAMEBOY };
