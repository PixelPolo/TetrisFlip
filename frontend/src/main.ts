import './style.css';
import { currentUser, fetchScores, login, logout, register, startGame, submitScore } from './api';
import { Game } from './game/game';
import { GUEST_TRIAL_MS, loadPlayedMs, savePlayedMs } from './guest';
import { BoardView } from './render/board-view';
import { THEMES, type ThemeId } from './render/themes';
import { loadSettings, saveSettings, type Difficulty } from './settings';
import { bindInput } from './ui/input';
import { drawPieces } from './ui/previews';
import { bindSwipe } from './ui/swipe';

function el<T extends HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing element: ${selector}`);
  return found;
}

const app = el<HTMLElement>('#app');
const overlay = el<HTMLElement>('#overlay');
const overlayText = el<HTMLElement>('#overlay-text');
const banner = el<HTMLElement>('#banner');
const scoreForm = el<HTMLFormElement>('#score-form');
const accountStatus = el<HTMLElement>('#account-status');
const authForm = el<HTMLFormElement>('#auth-form');
const authUsername = el<HTMLInputElement>('#auth-username');
const authPassword = el<HTMLInputElement>('#auth-password');
const authError = el<HTMLElement>('#auth-error');
const logoutButton = el<HTMLButtonElement>('#auth-logout');
const startButton = el<HTMLButtonElement>('#start');
const boards = {
  easy: el<HTMLOListElement>('#leaderboard-easy'),
  hard: el<HTMLOListElement>('#leaderboard-hard'),
};
const themeButton = el<HTMLButtonElement>('#theme');
const pauseButton = el<HTMLButtonElement>('#pause');
const nextCanvas = el<HTMLCanvasElement>('#next');
const holdCanvas = el<HTMLCanvasElement>('#hold');

function loadTheme(): ThemeId {
  try {
    return localStorage.getItem('theme') === 'gameboy' ? 'gameboy' : 'color';
  } catch {
    return 'color';
  }
}

let theme = THEMES[loadTheme()];
const game = new Game();
const view = new BoardView(el('#stage'), game.config.width, game.config.height, theme);

function applyTheme(id: ThemeId): void {
  theme = THEMES[id];
  document.documentElement.dataset.theme = id;
  view.setTheme(theme);
  themeButton.textContent = id === 'gameboy' ? 'Colors' : 'Game Boy';
  try {
    localStorage.setItem('theme', id);
  } catch {
    // Storage can be blocked (private mode): the theme just won't persist.
  }
}
applyTheme(theme.id);

const settings = loadSettings();
const difficultyOptions = document.querySelectorAll<HTMLInputElement>("input[name='difficulty']");
const swipeOption = el<HTMLInputElement>('#opt-swipe');

function applySettings(): void {
  difficultyOptions.forEach((option) => (option.checked = option.value === settings.difficulty));
  swipeOption.checked = settings.swipe;
  // The stylesheet hides the button pad while swipe controls are on.
  if (settings.swipe) document.documentElement.dataset.swipe = '';
  else delete document.documentElement.dataset.swipe;
  saveSettings(settings);
}
difficultyOptions.forEach((option) =>
  option.addEventListener('change', () => {
    settings.difficulty = option.value as Difficulty;
    applySettings();
  }),
);
swipeOption.addEventListener('change', () => {
  settings.swipe = swipeOption.checked;
  applySettings();
});
applySettings();

let bannerTimer = 0;
function showBanner(text: string, ms: number): void {
  banner.textContent = text;
  banner.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => (banner.hidden = true), ms);
}

game.on((event) => {
  if (event.kind === 'flip') {
    view.playFlip(event.falls, game.config.flipDurationMs);
    showBanner('Flip!', game.config.flipDurationMs);
  } else if (event.kind === 'cameraTurn') {
    view.turnCamera(event.turns, game.config.cameraTurnDurationMs);
    showBanner('Bullet time · controls mirrored', game.config.cameraTurnDurationMs);
  } else if (event.kind === 'gameOver') {
    showGameOver();
  }
});

// Accounts: guests get a short free trial, then must sign up or log in. Only signed-in
// players can save scores (the server enforces that; the trial timer is a client-side nicety).
let user: string | null = null;
let guestPlayedMs = loadPlayedMs();
let lastSavedMs = guestPlayedMs;

const trialOver = (): boolean => user === null && guestPlayedMs >= GUEST_TRIAL_MS;

function renderAccount(): void {
  authForm.hidden = user !== null;
  logoutButton.hidden = user === null;
  if (user !== null) {
    accountStatus.textContent = `Signed in as ${user}`;
  } else if (trialOver()) {
    accountStatus.textContent = 'Free trial over. Sign up or log in to keep playing.';
  } else {
    const seconds = Math.ceil((GUEST_TRIAL_MS - guestPlayedMs) / 1000);
    accountStatus.textContent = `Guest mode: ${seconds} s of free play left. Sign up to keep playing and save scores.`;
  }
  startButton.disabled = trialOver();
}

function setUser(name: string | null): void {
  user = name;
  authPassword.value = '';
  authError.hidden = true;
  renderAccount();
}

async function submitAuth(action: typeof login): Promise<void> {
  if (!authForm.reportValidity()) return;
  const result = await action(authUsername.value.trim(), authPassword.value);
  if (result.ok) setUser(result.username);
  else {
    authPassword.value = '';
    authError.textContent = result.message;
    authError.hidden = false;
  }
}
authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void submitAuth(login);
});
el('#auth-register').addEventListener('click', () => {
  // Lets password managers offer to generate and save a new password.
  authPassword.autocomplete = 'new-password';
  void submitAuth(register).finally(() => (authPassword.autocomplete = 'current-password'));
});
logoutButton.addEventListener('click', async () => {
  await logout();
  setUser(null);
});
renderAccount();
const authReady = currentUser().then(setUser);

/** Counts a guest's play time and ends the game when the free trial runs out. */
function trackGuestTime(dt: number): void {
  if (user !== null || game.phase !== 'playing') return;
  guestPlayedMs = Math.min(GUEST_TRIAL_MS, guestPlayedMs + dt);
  if (guestPlayedMs - lastSavedMs >= 1000 || guestPlayedMs >= GUEST_TRIAL_MS) {
    savePlayedMs(guestPlayedMs);
    lastSavedMs = guestPlayedMs;
    renderAccount();
  }
  if (trialOver()) {
    game.abort();
    overlayText.textContent = 'Free trial over. Sign up or log in to keep playing.';
    scoreForm.hidden = true;
    overlay.hidden = false;
  }
}

async function refreshLeaderboard(): Promise<void> {
  await Promise.all(
    (['easy', 'hard'] as const).map(async (difficulty) => {
      const scores = await fetchScores(difficulty);
      boards[difficulty].replaceChildren(
        ...scores.map((entry) => {
          const item = document.createElement('li');
          item.textContent = `${entry.name} — ${entry.score}`;
          return item;
        }),
      );
    }),
  );
}

function showGameOver(): void {
  overlayText.textContent = `Game over (${gameDifficulty}) — ${game.score} points`;
  scoreForm.hidden = game.score === 0 || user === null;
  if (user === null) overlayText.textContent += ' · sign up to save your scores';
  overlay.hidden = false;
  el('#start').textContent = 'Play again';
  void refreshLeaderboard();
}

// The difficulty is locked when the game starts: it decides the ghost piece and the leaderboard.
let gameDifficulty: Difficulty = settings.difficulty;

startButton.addEventListener('click', async () => {
  await authReady;
  if (trialOver()) return;
  gameDifficulty = settings.difficulty;
  if (user !== null && !(await startGame(gameDifficulty))) {
    // Most likely the session expired: fall back to guest mode rather than a silent failure.
    setUser(await currentUser());
    if (trialOver()) return;
  }
  view.showGhost = gameDifficulty === 'easy';
  view.resetCamera();
  game.start();
  overlay.hidden = true;
});

scoreForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const saved = await submitScore({
    difficulty: gameDifficulty,
    score: game.score,
    lines: game.lines,
    level: game.level,
  });
  overlayText.textContent = saved ? 'Score saved!' : 'Could not save the score.';
  scoreForm.hidden = saved;
  await refreshLeaderboard();
});

themeButton.addEventListener('click', () =>
  applyTheme(theme.id === 'gameboy' ? 'color' : 'gameboy'),
);
function togglePause(): void {
  game.togglePause();
  pauseButton.textContent = game.phase === 'paused' ? 'Resume' : 'Pause';
}
pauseButton.addEventListener('click', togglePause);
pauseButton.addEventListener('pointerup', () => pauseButton.blur());

function startOrPause(): void {
  if (overlay.hidden) togglePause();
  else el<HTMLButtonElement>('#start').click();
}

bindInput(app, (action) => game.input(action), togglePause, startOrPause);
bindSwipe(
  el('#stage'),
  (action) => game.input(action),
  () => settings.swipe && game.phase === 'playing',
);

// Pause automatically when the tab is hidden.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.phase === 'playing') togglePause();
});

const stats = {
  score: el('#score'),
  lines: el('#lines'),
  level: el('#level'),
};

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(now - last, 100);
  last = now;
  game.tick(dt);
  trackGuestTime(dt);
  view.render(game, dt);
  stats.score.textContent = String(game.score);
  stats.lines.textContent = String(game.lines);
  stats.level.textContent = String(game.level);
  drawPieces(nextCanvas, game.preview, theme);
  drawPieces(holdCanvas, game.hold ? [game.hold] : [], theme);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
void refreshLeaderboard();
