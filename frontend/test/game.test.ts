import { describe, expect, it } from 'vitest';
import { Game, type GameEvent } from '../src/game/game';
import { PIECE_TYPES } from '../src/game/pieces';
import { BagRandomizer } from '../src/game/randomizer';
import { gravityMs, linePoints } from '../src/game/scoring';

/** A deterministic random source so tests always get the same pieces. */
function seeded(seed = 42): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

function newGame(config = {}) {
  const game = new Game({ random: seeded(), config });
  const events: GameEvent[] = [];
  game.on((e) => events.push(e));
  game.start();
  return { game, events };
}

/** Fills the bottom rows except the last column, ready for a vertical I piece. */
function fillAllButLastColumn(game: Game, rows: number) {
  for (let r = game.config.height - rows; r < game.config.height; r++) {
    for (let c = 0; c < game.config.width - 1; c++) game.grid[r]![c] = 'O';
  }
}

describe('randomizer', () => {
  it('deals every piece once per bag of seven', () => {
    const bag = new BagRandomizer(seeded());
    const first = Array.from({ length: 7 }, () => bag.next()).sort();
    expect(first).toEqual([...PIECE_TYPES].sort());
  });
});

describe('scoring', () => {
  it('follows guideline points', () => {
    expect(linePoints(1, 1)).toBe(100);
    expect(linePoints(4, 2)).toBe(1600);
  });

  it('gets faster with levels', () => {
    expect(gravityMs(1)).toBe(1000);
    expect(gravityMs(10)).toBeLessThan(gravityMs(5));
  });
});

describe('game', () => {
  it('spawns a piece at the top centre', () => {
    const { game } = newGame();
    const cells = game.activeCells();
    expect(cells).toHaveLength(4);
    expect(Math.min(...cells.map((c) => c.y))).toBe(0);
    expect(Math.min(...cells.map((c) => c.x))).toBeGreaterThanOrEqual(3);
  });

  it('moves, stops at walls and falls with gravity', () => {
    const { game } = newGame();
    for (let i = 0; i < 20; i++) game.input('left');
    expect(Math.min(...game.activeCells().map((c) => c.x))).toBe(0);
    const before = game.active!.y;
    game.tick(1000);
    expect(game.active!.y).toBe(before + 1);
  });

  it('hard drops onto the floor and scores 2 points per row', () => {
    const { game, events } = newGame();
    const ghostBottom = Math.max(...game.ghostCells().map((c) => c.y));
    game.input('hardDrop');
    expect(ghostBottom).toBe(19);
    expect(game.grid[19]!.some((c) => c !== null)).toBe(true);
    expect(game.score).toBeGreaterThan(0);
    expect(events[0]).toEqual({ kind: 'lock' });
  });

  it('clears lines and updates the score', () => {
    const { game } = newGame({ flipEveryLines: 1000 });
    while (game.active!.type !== 'I') game.input('hardDrop');
    game.grid = game.grid.map(() => Array(10).fill(null));
    fillAllButLastColumn(game, 4);
    game.input('rotateCW');
    for (let i = 0; i < 10; i++) game.input('right');
    game.input('hardDrop');
    expect(game.lines).toBe(4);
    expect(game.score).toBeGreaterThanOrEqual(800);
  });

  it('swaps the piece with hold once per drop', () => {
    const { game } = newGame();
    const first = game.active!.type;
    game.input('hold');
    expect(game.hold).toBe(first);
    const second = game.active!.type;
    game.input('hold');
    expect(game.active!.type).toBe(second);
  });

  it('flips the board like an hourglass after enough lines', () => {
    const { game, events } = newGame({ flipEveryLines: 4 });
    while (game.active!.type !== 'I') game.input('hardDrop');
    game.grid = game.grid.map(() => Array(10).fill(null));
    fillAllButLastColumn(game, 4);
    game.grid[10]![0] = 'T';
    game.input('rotateCW');
    for (let i = 0; i < 10; i++) game.input('right');
    game.input('hardDrop');

    expect(game.phase).toBe('flipping');
    expect(events.some((e) => e.kind === 'flip')).toBe(true);
    // The lone block fell to the new floor.
    expect(game.grid[19]![0]).toBe('T');
    game.input('left');
    expect(game.active).toBeNull();

    game.tick(game.config.flipDurationMs);
    expect(game.phase).toBe('playing');
    expect(game.active).not.toBeNull();
  });

  it('turns the camera and mirrors the controls at score milestones', () => {
    const { game, events } = newGame({ cameraTurnEveryPoints: 10 });
    const x = game.active!.x;
    game.input('right');
    expect(game.active!.x).toBe(x + 1);

    game.input('hardDrop');
    expect(events).toContainEqual({ kind: 'cameraTurn', turns: 1 });
    expect(game.mirrored).toBe(true);
    expect(game.inBulletTime).toBe(true);

    const x2 = game.active!.x;
    game.input('right');
    expect(game.active!.x).toBe(x2 - 1);
  });

  it('ends the game when a new piece cannot spawn', () => {
    const { game, events } = newGame();
    for (let i = 0; i < 40 && game.phase === 'playing'; i++) game.input('hardDrop');
    expect(game.phase).toBe('over');
    expect(events.at(-1)).toEqual({ kind: 'gameOver' });
  });

  it('pauses and resumes', () => {
    const { game } = newGame();
    game.togglePause();
    const y = game.active!.y;
    game.tick(5000);
    expect(game.active!.y).toBe(y);
    game.togglePause();
    expect(game.phase).toBe('playing');
  });
});
