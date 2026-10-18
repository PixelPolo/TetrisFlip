/** Elements that need the browser's own touch behaviour: taps, text fields, the scrollable menu. */
const NATIVE_TOUCH = 'input, textarea, select, button, a, label, #overlay';

interface MaybeElement {
  closest?: (selector: string) => unknown;
  parentElement?: MaybeElement | null;
}

/**
 * Whether a touch that starts on `target` must be cancelled. Cancelling `touchstart` is the only
 * way to stop iOS from starting its long-press gesture (text selection magnifier, callout) on the
 * board, the pad and the rest of the game screen. Pointer events still fire, so the controls keep
 * working.
 */
export function shouldBlockTouch(target: unknown): boolean {
  const node = target as MaybeElement | null;
  const element = typeof node?.closest === 'function' ? node : (node?.parentElement ?? null);
  if (!element?.closest) return false;
  return !element.closest(NATIVE_TOUCH);
}
