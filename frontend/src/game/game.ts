import {
  clearFullRows,
  createGrid,
  flipHourglass,
  isFree,
  placeCells,
  type FallingBlock,
  type Grid,
} from './board';
import { CONFIG, type GameConfig } from './config';
import {
  boxSize,
  kickOffsets,
  shapeCells,
  type Cell,
  type PieceType,
  type Rotation,
} from './pieces';
import { BagRandomizer, type Random } from './randomizer';
import { gravityMs, levelForLines, linePoints } from './scoring';

export type Phase = 'ready' | 'playing' | 'paused' | 'flipping' | 'over';

export type Action = 'left' | 'right' | 'rotateCW' | 'rotateCCW' | 'softDrop' | 'hardDrop' | 'hold';

export interface ActivePiece {
  type: PieceType;
  rotation: Rotation;
  x: number;
  y: number;
}

export type GameEvent =
  | { kind: 'lock' }
  | { kind: 'clear'; rows: number[] }
  | { kind: 'flip'; falls: FallingBlock[] }
  | { kind: 'cameraTurn'; turns: number }
  | { kind: 'gameOver' };

export interface GameOptions {
  random?: Random;
  config?: Partial<GameConfig>;
}

export class Game {
  readonly config: GameConfig;
  phase: Phase = 'ready';
  grid: Grid;
  active: ActivePiece | null = null;
  hold: PieceType | null = null;
  score = 0;
  lines = 0;
  level = 1;
  /** How many times the camera has orbited half way around the board. */
  cameraTurns = 0;

  private milestone = 0;
  private canHold = true;
  private readonly queue: PieceType[] = [];
  private readonly randomizer: BagRandomizer;
  private readonly listeners = new Set<(event: GameEvent) => void>();
  private gravityClock = 0;
  private lockClock = 0;
  private lockResets = 0;
  private flipRemaining = 0;
  private bulletTimeRemaining = 0;

  constructor(options: GameOptions = {}) {
    this.config = { ...CONFIG, ...options.config };
    this.randomizer = new BagRandomizer(options.random);
    this.grid = createGrid(this.config.width, this.config.height);
  }

  /** True when the camera is behind the board: controls are mirrored to match the screen. */
  get mirrored(): boolean {
    return this.cameraTurns % 2 === 1;
  }

  get inBulletTime(): boolean {
    return this.bulletTimeRemaining > 0;
  }

  get preview(): PieceType[] {
    return this.queue.slice(0, this.config.previewCount);
  }

  on(listener: (event: GameEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    this.grid = createGrid(this.config.width, this.config.height);
    this.queue.length = 0;
    this.hold = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.cameraTurns = 0;
    this.milestone = 0;
    this.flipRemaining = 0;
    this.bulletTimeRemaining = 0;
    this.phase = 'playing';
    this.spawn();
  }

  togglePause(): void {
    if (this.phase === 'playing') this.phase = 'paused';
    else if (this.phase === 'paused') this.phase = 'playing';
  }

  /** Advances the simulation by `dt` milliseconds. */
  tick(dt: number): void {
    if (this.phase === 'flipping') {
      this.flipRemaining -= dt;
      if (this.flipRemaining <= 0) this.finishFlip();
      return;
    }
    if (this.phase !== 'playing' || !this.active) return;

    let scaled = dt;
    if (this.bulletTimeRemaining > 0) {
      scaled = dt * this.config.bulletTimeScale;
      this.bulletTimeRemaining = Math.max(0, this.bulletTimeRemaining - dt);
    }

    this.gravityClock += scaled;
    const interval = gravityMs(this.level);
    while (this.gravityClock >= interval) {
      this.gravityClock -= interval;
      if (!this.tryMove(0, 1)) break;
    }

    if (this.isGrounded()) {
      this.lockClock += scaled;
      if (this.lockClock >= this.config.lockDelayMs) this.lock();
    } else {
      this.lockClock = 0;
    }
  }

  /** Applies a player action. Left/right and rotations are mirrored when the camera is behind. */
  input(action: Action): void {
    if (this.phase !== 'playing' || !this.active) return;
    const flip = this.mirrored;
    switch (action) {
      case 'left':
        this.shift(flip ? 1 : -1);
        break;
      case 'right':
        this.shift(flip ? -1 : 1);
        break;
      case 'rotateCW':
        this.rotate(flip ? -1 : 1);
        break;
      case 'rotateCCW':
        this.rotate(flip ? 1 : -1);
        break;
      case 'softDrop':
        if (this.tryMove(0, 1)) {
          this.gravityClock = 0;
          this.addScore(1);
        }
        break;
      case 'hardDrop': {
        let rows = 0;
        while (this.tryMove(0, 1)) rows++;
        this.addScore(rows * 2);
        this.lock();
        break;
      }
      case 'hold':
        this.swapHold();
        break;
    }
  }

  /** Absolute cells of the falling piece. */
  activeCells(): Cell[] {
    return this.active ? this.cellsOf(this.active) : [];
  }

  /** Where the falling piece would land with a hard drop. */
  ghostCells(): Cell[] {
    if (!this.active) return [];
    const ghost = { ...this.active };
    while (isFree(this.grid, this.cellsOf({ ...ghost, y: ghost.y + 1 }))) ghost.y++;
    return this.cellsOf(ghost);
  }

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private cellsOf(piece: ActivePiece): Cell[] {
    return shapeCells(piece.type, piece.rotation).map(({ x, y }) => ({
      x: x + piece.x,
      y: y + piece.y,
    }));
  }

  private nextFromQueue(): PieceType {
    while (this.queue.length <= this.config.previewCount) this.queue.push(this.randomizer.next());
    return this.queue.shift()!;
  }

  private spawn(type: PieceType = this.nextFromQueue()): void {
    const cells = shapeCells(type, 0);
    const piece: ActivePiece = {
      type,
      rotation: 0,
      x: Math.floor((this.config.width - boxSize(type)) / 2),
      // Some shapes start on the second row of their box: lift them to the top row.
      y: -Math.min(...cells.map((c) => c.y)),
    };
    this.active = piece;
    this.gravityClock = 0;
    this.lockClock = 0;
    this.lockResets = 0;
    if (!isFree(this.grid, this.cellsOf(piece))) {
      this.active = null;
      this.phase = 'over';
      this.emit({ kind: 'gameOver' });
    }
  }

  private tryMove(dx: number, dy: number): boolean {
    const piece = this.active!;
    const moved = { ...piece, x: piece.x + dx, y: piece.y + dy };
    if (!isFree(this.grid, this.cellsOf(moved))) return false;
    this.active = moved;
    return true;
  }

  private isGrounded(): boolean {
    const piece = this.active!;
    return !isFree(this.grid, this.cellsOf({ ...piece, y: piece.y + 1 }));
  }

  private resetLockDelay(): void {
    if (this.lockResets < this.config.maxLockResets) {
      this.lockClock = 0;
      this.lockResets++;
    }
  }

  private shift(dx: number): void {
    if (this.tryMove(dx, 0)) this.resetLockDelay();
  }

  private rotate(direction: 1 | -1): void {
    const piece = this.active!;
    const to = ((piece.rotation + direction + 4) % 4) as Rotation;
    for (const kick of kickOffsets(piece.type, piece.rotation, to)) {
      const candidate = { ...piece, rotation: to, x: piece.x + kick.x, y: piece.y + kick.y };
      if (isFree(this.grid, this.cellsOf(candidate))) {
        this.active = candidate;
        this.resetLockDelay();
        return;
      }
    }
  }

  private swapHold(): void {
    if (!this.canHold) return;
    const current = this.active!.type;
    const held = this.hold;
    this.hold = current;
    this.canHold = false;
    this.spawn(held ?? undefined);
  }

  private lock(): void {
    const piece = this.active!;
    this.grid = placeCells(this.grid, this.cellsOf(piece), piece.type);
    this.active = null;
    this.canHold = true;
    this.emit({ kind: 'lock' });

    const linesBefore = this.lines;
    this.clearRows();
    const every = this.config.flipEveryLines;
    if (Math.floor(linesBefore / every) < Math.floor(this.lines / every)) {
      this.startFlip();
    } else {
      this.spawn();
    }
  }

  private clearRows(): void {
    const { grid, cleared } = clearFullRows(this.grid);
    if (cleared.length === 0) return;
    this.grid = grid;
    this.addScore(linePoints(cleared.length, this.level));
    this.lines += cleared.length;
    this.level = levelForLines(this.lines, this.config.linesPerLevel);
    this.emit({ kind: 'clear', rows: cleared });
  }

  private startFlip(): void {
    const { grid, falls } = flipHourglass(this.grid);
    this.grid = grid;
    this.phase = 'flipping';
    this.flipRemaining = this.config.flipDurationMs;
    this.emit({ kind: 'flip', falls });
  }

  private finishFlip(): void {
    this.phase = 'playing';
    // Sand settling can complete rows: they count, but never trigger another flip.
    this.clearRows();
    this.spawn();
  }

  private addScore(points: number): void {
    if (points <= 0) return;
    this.score += points;
    // Crossing one or several milestones at once always gives a single half turn.
    const milestone = Math.floor(this.score / this.config.cameraTurnEveryPoints);
    if (milestone > this.milestone) {
      this.milestone = milestone;
      this.cameraTurns++;
      this.bulletTimeRemaining = this.config.cameraTurnDurationMs;
      this.emit({ kind: 'cameraTurn', turns: this.cameraTurns });
    }
  }
}
