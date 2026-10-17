import type { Cell, PieceType } from './pieces';

/** `grid[row][col]`, row 0 is the top of the board. */
export type Grid = (PieceType | null)[][];

export function createGrid(width: number, height: number): Grid {
  return Array.from({ length: height }, () => Array<PieceType | null>(width).fill(null));
}

export function isInside(grid: Grid, { x, y }: Cell): boolean {
  return y >= 0 && y < grid.length && x >= 0 && x < grid[0]!.length;
}

export function isFree(grid: Grid, cells: Cell[]): boolean {
  return cells.every((cell) => isInside(grid, cell) && grid[cell.y]![cell.x] === null);
}

export function placeCells(grid: Grid, cells: Cell[], type: PieceType): Grid {
  const next = grid.map((row) => [...row]);
  for (const { x, y } of cells) next[y]![x] = type;
  return next;
}

/** Removes full rows and pushes the rest down. */
export function clearFullRows(grid: Grid): { grid: Grid; cleared: number[] } {
  const width = grid[0]!.length;
  const cleared: number[] = [];
  const kept = grid.filter((row, index) => {
    const full = row.every((cell) => cell !== null);
    if (full) cleared.push(index);
    return !full;
  });
  const empty = Array.from({ length: cleared.length }, () =>
    Array<PieceType | null>(width).fill(null),
  );
  return { grid: [...empty, ...kept], cleared };
}

/** One block falling from `fromRow` to `toRow` after the board was flipped. */
export interface FallingBlock {
  col: number;
  fromRow: number;
  toRow: number;
  type: PieceType;
}

/**
 * Turns the board upside down like an hourglass: rows are reversed, then every
 * block falls straight down in its column until it lands on something.
 */
export function flipHourglass(grid: Grid): { grid: Grid; falls: FallingBlock[] } {
  const height = grid.length;
  const width = grid[0]!.length;
  const flipped = [...grid].reverse();
  const result = createGrid(width, height);
  const falls: FallingBlock[] = [];

  for (let col = 0; col < width; col++) {
    let landing = height - 1;
    for (let row = height - 1; row >= 0; row--) {
      const type = flipped[row]![col];
      if (!type) continue;
      result[landing]![col] = type;
      falls.push({ col, fromRow: row, toRow: landing, type });
      landing--;
    }
  }
  return { grid: result, falls };
}
