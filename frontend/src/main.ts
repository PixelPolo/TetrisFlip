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
import { shouldBlockTouch } from './ui/touch-guard';

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
const muteIcon = el<HTMLElement>('#mute .icon');
const muteLabel = el<HTMLElement>('#mute .label');
const controlsButton = el<HTMLButtonElement>('#controls');
const mirrorTimer = el<HTMLElement>('#mirror-timer');
const hudTimer = el<HTMLElement>('#hud-timer');
const hudTimerLabel = el<HTMLElement>('#hud-timer-label');
const hudTimerValue = el<HTMLElement>('#hud-timer-value');

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

function applySettings(persist = true): void {
  difficultyOptions.forEach((option) => (option.checked = option.value === settings.difficulty));
  // The button toggles between swipe and the button pad, even in the middle of a game.
  controlsButton.setAttribute('aria-pressed', String(settings.swipe));
  controlsButton.setAttribute('aria-label', 'Swipe controls');
  // The stylesheet hides the button pad while swipe controls are on.
  if (settings.swipe) document.documentElement.dataset.swipe = '';
  else delete document.documentElement.dataset.swipe;
  if (persist) saveSettings(settings);
}
difficultyOptions.forEach((option) =>
  option.addEventListener('change', () => {
    settings.difficulty = option.value as Difficulty;
    applySettings();
  }),
);
controlsButton.addEventListener('click', () => {
  settings.swipe = !settings.swipe;
  applySettings();
  controlsButton.blur();
});
// The first call applies the defaults without storing them as a user choice.
applySettings(false);

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
  muteLabel.textContent = sound.muted ? 'Sound off' : 'Sound on';
  muteIcon.textContent = sound.muted ? '🔇' : '🔊';
  muteButton.setAttribute('aria-label', muteLabel.textContent);
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
    view.turnCamera(event.direction, game.config.cameraTurnDurationMs);
    showBanner('Bullet time', game.config.cameraTurnDurationMs);
  } else if (event.kind === 'cameraSpin') {
    sound.play('bullet');
    showBanner('Bullet time', 3000);
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

/**
 * The countdown to the next bullet time is a hint of the easy mode only. On a wide screen it
 * lives in the side panel (out of the play area); on a phone it is a small pill under the bar.
 */
function renderTimer(): void {
  const showing = game.phase !== 'ready' && game.phase !== 'over' && !game.inBulletTime;
  const seconds = game.secondsToBulletTime;
  let label = '';
  let value = '';
  if (showing && seconds !== null) {
    const easy = gameDifficulty === 'easy';
    if (easy) {
      label = game.mirrored ? 'Normal in' : 'Bullet time in';
      value = secondsText(seconds);
    }
  }
  const text = label ? `${label} ${value}` : '';
  mirrorTimer.textContent = text;
  mirrorTimer.dataset.mirrored = String(game.mirrored);
  mirrorTimer.hidden = text === '';
  // While hidden it keeps invisible placeholder text so the panel never changes height.
  hudTimerLabel.textContent = label || 'Bullet time in';
  hudTimerValue.textContent = value || '60 seconds';
  hudTimer.dataset.mirrored = String(game.mirrored);
  hudTimer.hidden = text === '';
}

// Accounts: guests get a short free trial, then must sign up or log in. Only signed-in
// players can save scores (the server enforces that; the trial timer is a client-side nicety).
let user: string | null = null;
let guestPlayedMs = loadPlayedMs();
let lastSavedMs = guestPlayedMs;

/** "1 second", "30 seconds": rounds up so a countdown never shows 0 while time remains. */
function secondsText(seconds: number): string {
  const n = Math.ceil(seconds);
  return `${n} ${n === 1 ? 'second' : 'seconds'}`;
}

const trialOver = (): boolean => user === null && guestPlayedMs >= GUEST_TRIAL_MS;

function renderAccount(): void {
  authForm.hidden = user !== null;
  logoutButton.hidden = user === null;
  if (user !== null) {
    accountStatus.textContent = `Signed in as ${user}`;
  } else if (trialOver()) {
    accountStatus.textContent = 'Sign up or log in to keep playing.';
  } else {
    const seconds = Math.ceil((GUEST_TRIAL_MS - guestPlayedMs) / 1000);
    accountStatus.textContent = `Guest mode: ${secondsText(seconds)} of free play left. Sign up to keep playing and save scores.`;
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
    overlayText.textContent = 'Free trial over.';
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
pauseButton.addEventListener('click', () => {
  togglePause();
  // Resuming from the phone menu closes it, and the game stays resumed.
  if (game.phase === 'playing') closeMenu();
});
pauseButton.addEventListener('pointerup', () => pauseButton.blur());

// Phone menu (burger): opening it pauses a running game, closing it resumes that game.
const root = document.documentElement;
const menuToggle = el<HTMLButtonElement>('#menu-toggle');
let menuPausedGame = false;
// A flip in progress cannot be paused: the pause waits for it to end (see the frame loop).
let menuPauseWaiting = false;
function pauseForMenu(): void {
  menuPauseWaiting = false;
  if (game.phase !== 'playing') return;
  togglePause();
  menuPausedGame = true;
}
function setMenu(open: boolean): void {
  root.toggleAttribute('data-menu', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuPauseWaiting = false;
  if (open && game.phase === 'flipping') menuPauseWaiting = true;
  else if (open) pauseForMenu();
  else {
    if (menuPausedGame && game.phase === 'paused') togglePause();
    menuPausedGame = false;
  }
}
// Leaving the phone layout (rotation) must not leave a hidden menu holding the game paused.
window.matchMedia('(max-width: 640px)').addEventListener('change', (event) => {
  if (!event.matches) closeMenu();
});
function closeMenu(): void {
  menuPausedGame = false;
  setMenu(false);
}
menuToggle.addEventListener('click', () => setMenu(!root.hasAttribute('data-menu')));
menuToggle.addEventListener('pointerup', () => menuToggle.blur());
startButton.addEventListener('click', closeMenu);

// Line the side panel (desktop) and the Next/Hold boxes (phone) up with the board frame.
function alignPanels(): void {
  const frame = view.frameRect();
  const stageTop = el('#stage').getBoundingClientRect().top;
  root.style.setProperty('--frame-top', `${frame.top}px`);
  root.style.setProperty('--frame-h', `${frame.bottom - frame.top}px`);
  root.style.setProperty('--frame-top-abs', `${stageTop + frame.top}px`);
}
view.onResize = alignPanels;
alignPanels();

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
  if (menuPauseWaiting && game.phase !== 'flipping') pauseForMenu();
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

// Some mobile browsers (iOS) ignore user-scalable=no: block double-tap and pinch zoom ourselves.
let lastTouchEnd = 0;
document.addEventListener(
  'touchend',
  (event) => {
    const now = Date.now();
    const onField =
      event.target instanceof HTMLElement &&
      event.target.closest('input, textarea, button, a, label, select');
    if (now - lastTouchEnd < 350 && !onField) event.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false },
);
// Long press and double tap must not open the selection magnifier or the context menu anywhere.
// Only form fields (login) keep normal text selection.
const outsideFields = (event: Event) => {
  const node = event.target instanceof Node ? event.target : null;
  const element = node instanceof Element ? node : (node?.parentElement ?? null);
  return !!element && !element.closest('input, textarea');
};
for (const type of ['contextmenu', 'selectstart'] as const) {
  document.addEventListener(type, (event) => {
    if (outsideFields(event)) event.preventDefault();
  });
}
// iOS only skips its long-press gesture (magnifier, callout) when touchstart is cancelled.
document.addEventListener(
  'touchstart',
  (event) => {
    if (shouldBlockTouch(event.target)) event.preventDefault();
  },
  { passive: false },
);
for (const type of ['gesturestart', 'gesturechange', 'dblclick'] as const) {
  document.addEventListener(type, (event) => event.preventDefault());
}
