import './style.css';
import { fetchScores, submitScore } from './api';
import { Game } from './game/game';
import { BoardView } from './render/board-view';
import { THEMES, type ThemeId } from './render/themes';
import { bindInput } from './ui/input';
import { drawPieces } from './ui/previews';

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
const nameInput = el<HTMLInputElement>('#name');
const leaderboard = el<HTMLOListElement>('#leaderboard');
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
    showBanner('Other side · controls mirrored', game.config.cameraTurnDurationMs + 800);
  } else if (event.kind === 'gameOver') {
    showGameOver();
  }
});

async function refreshLeaderboard(): Promise<void> {
  const scores = await fetchScores();
  leaderboard.replaceChildren(
    ...scores.map((entry) => {
      const item = document.createElement('li');
      item.textContent = `${entry.name} — ${entry.score}`;
      return item;
    }),
  );
}

function showGameOver(): void {
  overlayText.textContent = `Game over — ${game.score} points`;
  scoreForm.hidden = game.score === 0;
  overlay.hidden = false;
  el('#start').textContent = 'Play again';
  void refreshLeaderboard();
}

el('#start').addEventListener('click', () => {
  view.resetCamera();
  game.start();
  overlay.hidden = true;
});

scoreForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const saved = await submitScore({
    name: nameInput.value.trim(),
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

bindInput(app, (action) => game.input(action), togglePause);

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
