/** Tunable game rules. Change these to tweak the feel of TetrisFlip. */
export interface GameConfig {
  width: number;
  height: number;
  previewCount: number;
  linesPerLevel: number;
  flipEveryPoints: number;
  flipOnLines: number;
  bulletEveryMs: readonly [number, number];
  mirrorDurationMs: { early: readonly [number, number]; later: readonly [number, number] };
  earlyUntilLevel: number;
  mirroredSpeedScale: number;
  flipDurationMs: number;
  cameraTurnDurationMs: number;
  bulletTimeScale: number;
  lockDelayMs: number;
  maxLockResets: number;
}

export const CONFIG: GameConfig = {
  width: 10,
  height: 20,
  /** Number of upcoming pieces shown in the preview. */
  previewCount: 3,
  /** Lines needed to go up one level. */
  linesPerLevel: 10,
  /** The board flips upside down (hourglass) every N points... */
  flipEveryPoints: 5000,
  /** ...and whenever a single drop clears this many lines (a Tetris). */
  flipOnLines: 4,
  /**
   * Bullet time: after a random stretch of normal play between these bounds (a new one is drawn
   * each time) the camera orbits and the controls get mirrored.
   */
  bulletEveryMs: [10000, 60000],
  /** How long the mirrored phase lasts before another bullet time restores normal controls. */
  mirrorDurationMs: {
    /** Up to `earlyUntilLevel`. */
    early: [3000, 5000],
    later: [5000, 10000],
  },
  earlyUntilLevel: 3,
  /** Gravity multiplier while the controls are mirrored (the game is easier to follow). */
  mirroredSpeedScale: 0.5,
  /** Duration of the hourglass flip, during which the game waits. */
  flipDurationMs: 1400,
  /** Duration of the camera orbit (the bullet-time shot itself). */
  cameraTurnDurationMs: 3000,
  /** Gravity is multiplied by this factor during the orbit (slow motion). */
  bulletTimeScale: 0.08,
  lockDelayMs: 500,
  maxLockResets: 15,
};
