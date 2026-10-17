const LINE_POINTS = [0, 100, 300, 500, 800];

/** Guideline points for clearing `lines` rows at once. */
export function linePoints(lines: number, level: number): number {
  const base = LINE_POINTS[Math.min(lines, 4)]!;
  // Lines cleared by an hourglass flip can exceed four: each extra row is a bonus.
  const extra = Math.max(0, lines - 4) * 300;
  return (base + extra) * level;
}

export function levelForLines(lines: number, linesPerLevel: number): number {
  return Math.floor(lines / linesPerLevel) + 1;
}

/** Milliseconds per row of gravity, following the Tetris guideline curve. */
export function gravityMs(level: number): number {
  const seconds = Math.pow(0.8 - (level - 1) * 0.007, level - 1);
  return Math.max(seconds * 1000, 1);
}
