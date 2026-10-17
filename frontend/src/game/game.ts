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
  | { kind: 'cameraTurn'; turns: number; mirrored: boolean }
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

  private flipMilestone = 0;
  /** Normal play time left before the next bullet time. */
  private bulletCountdown = 0;
  private flipPending = false;
  /** Time left in the mirrored phase, counted once the camera has finished turning. */
  private mirrorRemaining = 0;
  private readonly random: Random;
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
    this.random = options.random ?? Math.random;
    this.randomizer = new BagRandomizer(this.random);
    this.grid = createGrid(this.config.width, this.config.height);
  }

  /**
   * True when the camera is behind the board. Controls are deliberately NOT compensated: seen
   * from behind, a move to the board's right goes to the screen's left, so left/right (and the
   * rotations) feel inverted. That is the bullet-time challenge.
   */
  get mirrored(): boolean {
    return this.cameraTurns % 2 === 1;
  }

  get inBulletTime(): boolean {
    return this.bulletTimeRemaining > 0;
  }

  /** Seconds left before the controls return to normal, or null when they are normal. */
  get mirrorSecondsLeft(): number | null {
    return this.mirrored && !this.inBulletTime ? this.mirrorRemaining / 1000 : null;
  }

  /** Seconds before the next bullet time (mirror on or off), or null during one. */
  get secondsToBulletTime(): number | null {
    if (this.inBulletTime) return null;
    return (this.mirrored ? this.mirrorRemaining : this.bulletCountdown) / 1000;
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
    this.flipMilestone = 0;
    this.bulletCountdown = this.randomBetween(this.config.bulletEveryMs);
    this.flipPending = false;
    this.mirrorRemaining = 0;
    this.flipRemaining = 0;
    this.bulletTimeRemaining = 0;
    this.phase = 'playing';
    this.spawn();
  }

  /** Ends the game without a game-over event (used when a guest's trial runs out). */
  abort(): void {
    this.active = null;
    this.phase = 'over';
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
    } else if (this.mirrored) {
      scaled = dt * this.config.mirroredSpeedScale;
      this.mirrorRemaining -= dt;
      if (this.mirrorRemaining <= 0) this.turnCamera();
    } else {
      this.bulletCountdown -= dt;
      if (this.bulletCountdown <= 0) this.turnCamera();
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

  /** Direction on the player's screen (+1 right, -1 left) of a move of `dx` on the board. */
  screenDirection(dx: number): number {
    return this.mirrored ? -dx : dx;
  }

  /** Applies a player action. Moves are in board terms, so they look inverted from behind. */
  input(action: Action): void {
    if (this.phase !== 'playing' || !this.active) return;
    switch (action) {
      case 'left':
        this.shift(-1);
        break;
      case 'right':
        this.shift(1);
        break;
      case 'rotateCW':
        this.rotate(1);
        break;
      case 'rotateCCW':
        this.rotate(-1);
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

    const cleared = this.clearRows();
    if (this.flipPending || cleared >= this.config.flipOnLines) {
      this.startFlip();
    } else {
      this.spawn();
    }
  }

  /** Removes full rows, scores them and returns how many there were. */
  private clearRows(): number {
    const { grid, cleared } = clearFullRows(this.grid);
    if (cleared.length === 0) return 0;
    this.grid = grid;
    this.addScore(linePoints(cleared.length, this.level));
    this.lines += cleared.length;
    this.level = levelForLines(this.lines, this.config.linesPerLevel);
    this.emit({ kind: 'clear', rows: cleared });
    return cleared.length;
  }

  private startFlip(): void {
    const { grid, falls } = flipHourglass(this.grid);
    this.grid = grid;
    this.flipPending = false;
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

    // The flip waits for the piece to lock. Crossing several milestones at once flips once.
    const flipMilestone = Math.floor(this.score / this.config.flipEveryPoints);
    if (flipMilestone > this.flipMilestone) {
      this.flipMilestone = flipMilestone;
      this.flipPending = true;
    }
  }

  /** Half turn of the camera: bullet time, then the controls are mirrored or back to normal. */
  private turnCamera(): void {
    this.cameraTurns++;
    this.bulletTimeRemaining = this.config.cameraTurnDurationMs;
    if (this.mirrored) {
      this.mirrorRemaining = this.randomMirrorMs();
    } else {
      this.mirrorRemaining = 0;
      this.bulletCountdown = this.randomBetween(this.config.bulletEveryMs);
    }
    this.emit({ kind: 'cameraTurn', turns: this.cameraTurns, mirrored: this.mirrored });
  }

  private randomMirrorMs(): number {
    const { early, later } = this.config.mirrorDurationMs;
    return this.randomBetween(this.level <= this.config.earlyUntilLevel ? early : later);
  }

  private randomBetween([min, max]: readonly [number, number]): number {
    return min + this.random() * (max - min);
  }
}
