import { describe, expect, it } from 'vitest';
import { clearFullRows, createGrid, flipHourglass, isFree, type Grid } from '../src/game/board';

/** Builds a grid from strings, '.' is empty, any other letter is a block. */
function grid(rows: string[]): Grid {
  return rows.map((row) => [...row].map((c) => (c === '.' ? null : (c as 'I'))));
}

function render(g: Grid): string[] {
  return g.map((row) => row.map((c) => c ?? '.').join(''));
}

describe('board', () => {
  it('creates an empty grid', () => {
    const g = createGrid(10, 20);
    expect(g).toHaveLength(20);
    expect(g.every((row) => row.length === 10 && row.every((c) => c === null))).toBe(true);
  });

  it('detects walls, floor and blocks', () => {
    const g = grid(['...', '.I.', '...']);
    expect(isFree(g, [{ x: 0, y: 0 }])).toBe(true);
    expect(isFree(g, [{ x: 1, y: 1 }])).toBe(false);
    expect(isFree(g, [{ x: -1, y: 0 }])).toBe(false);
    expect(isFree(g, [{ x: 0, y: 3 }])).toBe(false);
  });

  it('clears full rows and drops the rest', () => {
    const { grid: next, cleared } = clearFullRows(grid(['T..', 'III', 'S.S', 'OOO']));
    expect(cleared).toEqual([1, 3]);
    expect(render(next)).toEqual(['...', '...', 'T..', 'S.S']);
  });

  it('flips like an hourglass: upside down, then blocks fall', () => {
    const { grid: next, falls } = flipHourglass(grid(['....', '....', 'T...', 'TT.S']));
    // Reversed: TT.S on top, T... below it; then everything falls to the floor.
    expect(render(next)).toEqual(['....', '....', 'T...', 'TT.S']);
    expect(falls).toContainEqual({ col: 3, fromRow: 0, toRow: 3, type: 'S' });
    expect(falls).toContainEqual({ col: 0, fromRow: 1, toRow: 3, type: 'T' });
    expect(falls).toContainEqual({ col: 0, fromRow: 0, toRow: 2, type: 'T' });
  });

  it('closes holes when flipping', () => {
    const { grid: next } = flipHourglass(grid(['...', 'I.I', '.I.', 'I.I']));
    expect(render(next)).toEqual(['...', '...', 'I.I', 'III']);
  });
});
