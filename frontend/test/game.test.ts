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
    const { game } = newGame({ flipOnLines: 1000 });
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

  /** Sets up a vertical I piece that completes four rows at once (a Tetris). */
  function setUpTetris(game: Game) {
    while (game.active!.type !== 'I') game.input('hardDrop');
    game.grid = game.grid.map(() => Array(10).fill(null));
    fillAllButLastColumn(game, 4);
    game.grid[10]![0] = 'T';
    game.input('rotateCW');
    for (let i = 0; i < 10; i++) game.input('right');
  }

  it('flips the board like an hourglass on a Tetris', () => {
    const { game, events } = newGame({ bulletEveryMs: [1e9, 1e9] as const, flipEveryPoints: 1e9 });
    setUpTetris(game);
    game.input('hardDrop');

    expect(game.lines).toBe(4);
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

  it('does not flip for fewer than four lines', () => {
    const { game, events } = newGame({ bulletEveryMs: [1e9, 1e9] as const, flipEveryPoints: 1e9 });
    while (game.active!.type !== 'I') game.input('hardDrop');
    game.grid = game.grid.map(() => Array(10).fill(null));
    fillAllButLastColumn(game, 3);
    game.input('rotateCW');
    for (let i = 0; i < 10; i++) game.input('right');
    game.input('hardDrop');
    expect(game.lines).toBe(3);
    expect(events.some((e) => e.kind === 'flip')).toBe(false);
  });

  it('flips when the score crosses a milestone, once the piece has locked', () => {
    const { game, events } = newGame({ bulletEveryMs: [1e9, 1e9] as const, flipEveryPoints: 10 });
    game.input('softDrop');
    expect(events.some((e) => e.kind === 'flip')).toBe(false);
    game.input('hardDrop');
    expect(events.some((e) => e.kind === 'flip')).toBe(true);
    expect(game.phase).toBe('flipping');
  });

  const NO_FLIP = { flipEveryPoints: 1e9 };

  it('turns the camera and mirrors the controls after a random delay', () => {
    const { game, events } = newGame({ ...NO_FLIP, bulletEveryMs: [1000, 1000] as const });
    const x = game.active!.x;
    game.input('right');
    expect(game.active!.x).toBe(x + 1);
    expect(game.secondsToBulletTime).toBeCloseTo(1, 1);

    game.tick(1001);
    expect(events).toContainEqual({ kind: 'cameraTurn', turns: 1, mirrored: true });
    expect(game.mirrored).toBe(true);
    expect(game.inBulletTime).toBe(true);
    expect(game.secondsToBulletTime).toBeNull();

    const x2 = game.active!.x;
    game.input('right');
    expect(game.active!.x).toBe(x2 - 1);
  });

  it('draws the delay between bullet times between the configured bounds', () => {
    for (const [random, expectedS] of [
      [0, 10],
      [0.999, 60],
    ] as const) {
      const game = new Game({ random: () => random });
      game.start();
      expect(game.secondsToBulletTime).toBeCloseTo(expectedS, 0);
    }
  });

  /** A game whose bullet time starts after 1 s and whose mirrored phase has a fixed length. */
  function mirroredGame(random: number, level = 1) {
    const game = new Game({
      random: () => random,
      config: { ...NO_FLIP, bulletEveryMs: [1000, 1000] as const, lockDelayMs: 1e9 },
    });
    game.start();
    game.level = level;
    game.tick(1001);
    expect(game.mirrored).toBe(true);
    expect(game.mirrorSecondsLeft).toBeNull(); // still in the bullet-time shot
    game.tick(game.config.cameraTurnDurationMs);
    return game;
  }

  it('returns to normal controls after a random 3 to 5 s early in the game', () => {
    for (const [random, expectedMs] of [
      [0, 3000],
      [0.999, 5000],
    ] as const) {
      const game = mirroredGame(random);
      expect(game.inBulletTime).toBe(false);
      expect(game.mirrorSecondsLeft).toBeCloseTo(expectedMs / 1000, 1);
      // The countdown to the next bullet time is the end of the mirrored phase.
      expect(game.secondsToBulletTime).toBeCloseTo(expectedMs / 1000, 1);

      game.tick(expectedMs - 100);
      expect(game.mirrored).toBe(true);
      game.tick(200);
      expect(game.mirrored).toBe(false);
      expect(game.inBulletTime).toBe(true); // the return trip is a bullet time too
    }
  });

  it('plays longer mirrored phases from level 4 on', () => {
    expect(mirroredGame(0, 4).mirrorSecondsLeft).toBeCloseTo(5, 1);
    expect(mirroredGame(0.999, 4).mirrorSecondsLeft).toBeCloseTo(10, 0);
  });

  it('starts a new random countdown once the controls are back to normal', () => {
    const game = mirroredGame(0);
    game.tick(3001);
    expect(game.mirrored).toBe(false);
    game.tick(game.config.cameraTurnDurationMs);
    expect(game.secondsToBulletTime).toBeCloseTo(1, 1);
  });

  it('halves the fall speed while the controls are mirrored', () => {
    const fallen = (mirrored: boolean) => {
      const game = mirrored ? mirroredGame(0.999) : newGame(NO_FLIP).game;
      const y = game.active!.y;
      game.tick(gravityMs(1) * 4);
      return game.active!.y - y;
    };
    expect(fallen(false)).toBe(4);
    expect(fallen(true)).toBe(2);
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
