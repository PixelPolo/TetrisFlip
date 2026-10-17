import type { Action } from '../game/game';

const STEP_PX = 28;
const TAP_MAX_MOVE_PX = 10;
const TAP_MAX_MS = 300;
const HOLD_SWIPE_PX = 60;
const FLICK_MIN_PX = 80;
const FLICK_MIN_SPEED = 0.8; // px per ms

/**
 * Swipe controls on the board:
 * tap = rotate, drag left/right = move, drag down = soft drop,
 * quick flick down = hard drop, swipe up = swap the piece (hold).
 */
export function bindSwipe(
  target: HTMLElement,
  onAction: (action: Action) => void,
  isEnabled: () => boolean,
): void {
  let start: { x: number; y: number; time: number } | null = null;
  let movedX = 0;
  let movedY = 0;

  target.addEventListener('pointerdown', (event) => {
    if (!isEnabled()) return;
    start = { x: event.clientX, y: event.clientY, time: performance.now() };
    movedX = 0;
    movedY = 0;
    target.setPointerCapture(event.pointerId);
  });

  target.addEventListener('pointermove', (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // Each STEP_PX of drag is one cell, so the piece follows the finger.
    while (dx - movedX >= STEP_PX) {
      onAction('right');
      movedX += STEP_PX;
    }
    while (movedX - dx >= STEP_PX) {
      onAction('left');
      movedX -= STEP_PX;
    }
    while (dy - movedY >= STEP_PX * 1.5) {
      onAction('softDrop');
      movedY += STEP_PX * 1.5;
    }
  });

  const end = (event: PointerEvent) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const elapsed = Math.max(performance.now() - start.time, 1);
    start = null;

    if (Math.abs(dx) < TAP_MAX_MOVE_PX && Math.abs(dy) < TAP_MAX_MOVE_PX && elapsed < TAP_MAX_MS) {
      onAction('rotateCW');
    } else if (dy < -HOLD_SWIPE_PX && Math.abs(dy) > Math.abs(dx) * 1.5) {
      onAction('hold');
    } else if (dy > FLICK_MIN_PX && dy / elapsed > FLICK_MIN_SPEED && Math.abs(dy) > Math.abs(dx)) {
      onAction('hardDrop');
    }
  };
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', () => (start = null));
}
