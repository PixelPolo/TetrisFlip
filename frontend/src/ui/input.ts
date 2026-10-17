import type { Action } from '../game/game';

const KEYS: Record<string, Action> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'rotateCW',
  x: 'rotateCW',
  z: 'rotateCCW',
  ArrowDown: 'softDrop',
  ' ': 'hardDrop',
  c: 'hold',
};

const REPEATABLE: Action[] = ['left', 'right', 'softDrop'];
const REPEAT_DELAY_MS = 150;
const REPEAT_INTERVAL_MS = 50;

type Handler = (action: Action) => void;

/** Keyboard and touch controls, with auto-repeat for movement. */
export function bindInput(root: HTMLElement, onAction: Handler, onPause: () => void): void {
  const timers = new Map<string, { delay: number; interval?: number }>();

  const press = (id: string, action: Action) => {
    if (timers.has(id)) return;
    onAction(action);
    if (!REPEATABLE.includes(action)) {
      timers.set(id, { delay: 0 });
      return;
    }
    const timer: { delay: number; interval?: number } = {
      delay: window.setTimeout(() => {
        timer.interval = window.setInterval(() => onAction(action), REPEAT_INTERVAL_MS);
      }, REPEAT_DELAY_MS),
    };
    timers.set(id, timer);
  };

  const release = (id: string) => {
    const timer = timers.get(id);
    if (!timer) return;
    clearTimeout(timer.delay);
    clearInterval(timer.interval);
    timers.delete(id);
  };

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'p' || key === 'Escape') return onPause();
    const action = KEYS[key];
    if (!action) return;
    event.preventDefault();
    press(key, action);
  });
  window.addEventListener('keyup', (event) => {
    release(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  });
  window.addEventListener('blur', () => [...timers.keys()].forEach(release));

  root.querySelectorAll<HTMLButtonElement>('#touch button').forEach((button) => {
    const action = button.dataset.action as Action;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      press(`touch-${action}`, action);
    });
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) {
      button.addEventListener(type, () => release(`touch-${action}`));
    }
  });
}
