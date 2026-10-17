import { expect, test, type Page } from '@playwright/test';

const score = (page: Page) => page.getByTestId('score');

/** Starts a game. Hard drops are a fast way to play, via keyboard or the touch button. */
async function startGame(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('overlay')).toBeVisible();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('overlay')).toBeHidden();
}

async function hardDrop(page: Page, isMobile: boolean) {
  if (isMobile) await page.locator('#touch [data-action="hardDrop"]').tap();
  else await page.keyboard.press('Space');
}

test('the home page shows the title and a canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('TetrisFlip');
  await expect(page.locator('#stage canvas')).toBeVisible();
});

test('playing a piece scores points', async ({ page, isMobile }) => {
  await startGame(page);
  await expect(score(page)).toHaveText('0');
  await hardDrop(page, isMobile);
  await expect(score(page)).not.toHaveText('0');
});

test('the theme can be switched to Game Boy green and back', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'gameboy');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'gameboy');
  await page.getByTestId('theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'color');
});

test('pause freezes the game and resume restarts it', async ({ page }) => {
  await startGame(page);
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('pause')).toHaveText('Resume');
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('pause')).toHaveText('Pause');
});

test('a finished game is saved to its own leaderboard', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.getByTestId('difficulty-easy').check();
  await startGame(page);
  // Dropping pieces without moving them fills the middle column: game over.
  for (let i = 0; i < 40 && (await page.getByTestId('overlay').isHidden()); i++) {
    await hardDrop(page, isMobile);
  }
  await expect(page.getByTestId('overlay')).toBeVisible();
  await expect(page.locator('#overlay-text')).toContainText('Game over');

  const name = `e2e-${Date.now().toString(36)}`.slice(0, 16);
  await page.locator('#name').fill(name);
  await page.getByTestId('submit-score').click();
  await expect(page.locator('#overlay-text')).toHaveText('Score saved!');
  await expect(page.getByTestId('leaderboard-easy')).toContainText(name);
  await expect(page.getByTestId('leaderboard-hard')).not.toContainText(name);
});

test('the difficulty (ghost piece or not) is chosen before playing and remembered', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('difficulty-easy')).toBeChecked();
  await page.getByTestId('difficulty-hard').check();
  await page.reload();
  await expect(page.getByTestId('difficulty-hard')).toBeChecked();
});

test('mobile shows a Game Boy pad that plays the game', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The pad is only shown on touch screens');
  await page.goto('/');
  await expect(page.locator('#touch .dpad')).toBeVisible();
  await page.getByTestId('touch-start').tap();
  await expect(page.getByTestId('overlay')).toBeHidden();
  await page.locator('#touch .ab .a').tap();
  await page.locator('#touch [data-action="hardDrop"]').tap();
  await expect(score(page)).not.toHaveText('0');
  // Start doubles as pause while playing.
  await page.getByTestId('touch-start').tap();
  await expect(page.getByTestId('pause')).toHaveText('Resume');
});

test('swipe controls replace the on-screen buttons', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The pad is only shown on touch screens');
  await page.goto('/');
  await page.getByTestId('opt-swipe').check();
  await expect(page.locator('#touch')).toBeHidden();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('overlay')).toBeHidden();
  // A quick flick down is a hard drop.
  const box = (await page.locator('#stage').boundingBox())!;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(x, box.y + 300, { steps: 2 });
  await page.mouse.up();
  await expect(score(page)).not.toHaveText('0');
});

test('a hard game goes to the hard leaderboard', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.getByTestId('difficulty-hard').check();
  await startGame(page);
  for (let i = 0; i < 40 && (await page.getByTestId('overlay').isHidden()); i++) {
    await hardDrop(page, isMobile);
  }
  await expect(page.locator('#overlay-text')).toContainText('(hard)');
  const name = `h-${Date.now().toString(36)}`.slice(0, 16);
  await page.locator('#name').fill(name);
  await page.getByTestId('submit-score').click();
  await expect(page.getByTestId('leaderboard-hard')).toContainText(name);
  await expect(page.getByTestId('leaderboard-easy')).not.toContainText(name);
});
