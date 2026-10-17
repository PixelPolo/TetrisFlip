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

test('a finished game can be saved to the leaderboard', async ({ page, isMobile }) => {
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
  await expect(page.getByTestId('leaderboard')).toContainText(name);
});
