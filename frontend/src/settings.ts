/** Easy shows the ghost piece (where the piece will land), hard does not. */
export type Difficulty = 'easy' | 'hard';

export interface Settings {
  difficulty: Difficulty;
  /** Control the game by swiping on the board instead of using the on-screen buttons. */
  swipe: boolean;
}

const KEY = 'settings';

function prefersTouch(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export function loadSettings(): Settings {
  // Touch screens default to swipe controls; a saved choice always wins.
  const settings: Settings = { difficulty: 'easy', swipe: prefersTouch() };
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (stored && typeof stored === 'object') {
      const { difficulty, swipe } = stored as Partial<Settings>;
      if (difficulty === 'easy' || difficulty === 'hard') settings.difficulty = difficulty;
      if (typeof swipe === 'boolean') settings.swipe = swipe;
    }
  } catch {
    // Missing or blocked storage: fall back to the defaults.
  }
  return settings;
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage can be blocked (private mode): settings just won't persist.
  }
}
