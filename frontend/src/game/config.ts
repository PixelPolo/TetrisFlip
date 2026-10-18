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
  spinFromLevel: number;
  spinDegPerSecond: { base: number; perLevel: number; max: number };
  lockDelayMs: number;
  maxLockResets: number;
}

export const CONFIG: GameConfig = {
  width: 10,
  height: 20,
  /** Number of upcoming pieces shown in the preview (one only). */
  previewCount: 1,
  /** Lines needed to go up one level. */
  linesPerLevel: 10,
  /** The board flips upside down (hourglass) every N points... */
  flipEveryPoints: 1000,
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
    early: [6000, 10000],
    later: [10000, 20000],
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
  /**
   * From this level on, a bullet time is no longer a half turn and back: the camera turns round
   * the board non stop for a random time (same bounds as the mirrored phase), then stops in
   * front. The controls are inverted while it is behind the board.
   */
  spinFromLevel: 5,
  /** Average camera speed of a spin: grows with the level, up to a maximum. */
  spinDegPerSecond: { base: 15, perLevel: 3, max: 120 },
  lockDelayMs: 500,
  maxLockResets: 15,
};
