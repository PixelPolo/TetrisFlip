/** Tunable game rules. Change these to tweak the feel of TetrisFlip. */
export const CONFIG = {
  width: 10,
  height: 20,
  /** Number of upcoming pieces shown in the preview. */
  previewCount: 3,
  /** Lines needed to go up one level. */
  linesPerLevel: 10,
  /** The board flips upside down (hourglass) every N cleared lines. */
  flipEveryLines: 5,
  /** The camera orbits to the other side of the board every N points. */
  cameraTurnEveryPoints: 5000,
  /** Duration of the hourglass flip, during which the game waits. */
  flipDurationMs: 1400,
  /** Bullet-time duration while the camera orbits around the board. */
  cameraTurnDurationMs: 3000,
  /** Gravity is multiplied by this factor during bullet time (slow motion). */
  bulletTimeScale: 0.08,
  lockDelayMs: 500,
  maxLockResets: 15,
} as const;

export type GameConfig = typeof CONFIG;
