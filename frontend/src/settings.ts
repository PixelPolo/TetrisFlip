/** Easy shows the ghost piece (where the piece will land), hard does not. */
export type Difficulty = 'easy' | 'hard';

export interface Settings {
  difficulty: Difficulty;
  /** Control the game by swiping on the board instead of using the on-screen buttons. */
  swipe: boolean;
}

const KEY = 'settings';

export function loadSettings(): Settings {
  const settings: Settings = { difficulty: 'easy', swipe: false };
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (stored && typeof stored === 'object') {
      const { difficulty, swipe } = stored as Partial<Settings>;
      if (difficulty === 'easy' || difficulty === 'hard') settings.difficulty = difficulty;
      settings.swipe = swipe === true;
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
