import './style.css';
import { currentUser, fetchScores, login, logout, register, startGame, submitScore } from './api';
import { Sound } from './audio/sound';
import { Game, type Action } from './game/game';
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
const muteButton = el<HTMLButtonElement>('#mute');
const mirrorTimer = el<HTMLElement>('#mirror-timer');

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

// Sound only starts after a click or key press (browsers forbid autoplay); mute is remembered.
const sound = new Sound();
function renderMute(): void {
  muteButton.textContent = sound.muted ? 'Sound off' : 'Sound on';
  muteButton.setAttribute('aria-label', muteButton.textContent);
  muteButton.setAttribute('aria-pressed', String(sound.muted));
}
muteButton.addEventListener('click', () => {
  sound.unlock();
  sound.setMuted(!sound.muted);
  renderMute();
  muteButton.blur();
});
renderMute();
// Touch screens only count some events as a gesture, so listen to several; unlock() is cheap.
for (const type of ['pointerup', 'touchend', 'click', 'keydown'] as const) {
  window.addEventListener(type, () => sound.unlock(), { passive: true });
}

game.on((event) => {
  if (event.kind === 'lock') {
    sound.play('lock');
  } else if (event.kind === 'clear') {
    sound.play(event.rows.length >= game.config.flipOnLines ? 'tetris' : 'clear');
  } else if (event.kind === 'flip') {
    sound.play('flip');
    view.playFlip(event.falls, game.config.flipDurationMs);
    showBanner('Flip!', game.config.flipDurationMs);
  } else if (event.kind === 'cameraTurn') {
    sound.play('bullet');
    view.turnCamera(event.turns, game.config.cameraTurnDurationMs);
    showBanner(
      event.mirrored ? 'Bullet time · controls mirrored' : 'Bullet time · controls back to normal',
      game.config.cameraTurnDurationMs,
    );
  } else if (event.kind === 'gameOver') {
    sound.play('gameOver');
    showGameOver();
  }
});

/** Plays the matching sound when a player action actually did something. */
function playerInput(action: Action): void {
  const before = game.active;
  game.input(action);
  const after = game.active;
  if (action === 'hardDrop') sound.play('hardDrop');
  else if (action === 'hold') sound.play('hold');
  else if (before && after && before.type === after.type) {
    if (action === 'rotateCW' || action === 'rotateCCW') {
      if (before.rotation !== after.rotation) sound.play('rotate');
    } else if (action === 'left' || action === 'right') {
      if (before.x !== after.x) sound.play('move');
    }
  }
}

/** The countdown to the next bullet time is a hint of the easy mode only. */
function renderTimer(): void {
  const showing = game.phase !== 'ready' && game.phase !== 'over' && !game.inBulletTime;
  const seconds = game.secondsToBulletTime;
  if (!showing || seconds === null) {
    mirrorTimer.hidden = true;
    return;
  }
  const countdown = Math.ceil(seconds);
  let text: string;
  if (game.mirrored) {
    text = gameDifficulty === 'easy' ? `Mirrored · normal in ${countdown} s` : 'Mirrored';
  } else {
    text = gameDifficulty === 'easy' ? `Bullet time in ${countdown} s` : '';
  }
  mirrorTimer.textContent = text;
  mirrorTimer.dataset.mirrored = String(game.mirrored);
  mirrorTimer.hidden = text === '';
}

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

bindInput(app, playerInput, togglePause, startOrPause);
bindSwipe(el('#swipe-zone'), playerInput, () => settings.swipe && game.phase === 'playing');

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
  sound.setLevel(game.level);
  sound.setMusic(game.phase === 'playing' || game.phase === 'flipping');
  renderTimer();
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
