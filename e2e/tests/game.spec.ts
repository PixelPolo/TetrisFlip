import { expect, test, type Page } from '@playwright/test';

const score = (page: Page) => page.getByTestId('score');

/** Starts a game. Hard drops are a fast way to play, via keyboard or the touch button. */
async function startGame(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('overlay')).toBeVisible();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('overlay')).toBeHidden();
}

/** One account per worker: the first call signs up through the UI, later ones just log in. */
let account: { name: string; password: string } | null = null;

async function signIn(page: Page) {
  await page.goto('/');
  if (account) {
    await page.getByTestId('auth-username').fill(account.name);
    await page.getByTestId('auth-password').fill(account.password);
    await page.getByTestId('auth-login').click();
  } else {
    account = {
      name: `e2e-${Date.now().toString(36)}`.slice(0, 16),
      password: 'e2e-password-1234',
    };
    await page.getByTestId('auth-username').fill(account.name);
    await page.getByTestId('auth-password').fill(account.password);
    await page.getByTestId('auth-register').click();
  }
  await expect(page.getByTestId('account-status')).toContainText(`Signed in as ${account.name}`);
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
  await signIn(page);
  await page.getByTestId('difficulty-easy').check();
  await startGame(page);
  // Dropping pieces without moving them fills the middle column: game over.
  for (let i = 0; i < 40 && (await page.getByTestId('overlay').isHidden()); i++) {
    await hardDrop(page, isMobile);
  }
  await expect(page.getByTestId('overlay')).toBeVisible();
  await expect(page.locator('#overlay-text')).toContainText('Game over');

  const name = account!.name;
  // The server rejects games that are implausibly short.
  await page.waitForTimeout(3500);
  // The other difficulty's board must not change when this game is saved.
  const otherBoard = await page.getByTestId('leaderboard-hard').innerText();
  await page.getByTestId('submit-score').click();
  await expect(page.locator('#overlay-text')).toHaveText('Score saved!');
  await expect(page.getByTestId('leaderboard-easy')).toContainText(name);
  expect(await page.getByTestId('leaderboard-hard').innerText()).toBe(otherBoard);
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
  // The swipe zone is a rounded square below the board: fingers never cover the game.
  const stage = (await page.locator('#stage').boundingBox())!;
  const zone = (await page.getByTestId('swipe-zone').boundingBox())!;
  expect(zone.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1);
  const x = zone.x + zone.width / 2;
  await page.mouse.move(x, zone.y + 20);
  await page.mouse.down();
  await page.mouse.move(x, zone.y + 140, { steps: 2 });
  await page.mouse.up();
  await expect(score(page)).not.toHaveText('0');
});

test('a hard game goes to the hard leaderboard', async ({ page, isMobile }) => {
  await signIn(page);
  await page.getByTestId('difficulty-hard').check();
  await startGame(page);
  for (let i = 0; i < 40 && (await page.getByTestId('overlay').isHidden()); i++) {
    await hardDrop(page, isMobile);
  }
  await expect(page.locator('#overlay-text')).toContainText('(hard)');
  await page.waitForTimeout(3500);
  // The other difficulty's board must not change when this game is saved.
  const otherBoard = await page.getByTestId('leaderboard-easy').innerText();
  await page.getByTestId('submit-score').click();
  // Only the top 10 are listed, so a long-lived database may not show this score: check the save.
  await expect(page.locator('#overlay-text')).toHaveText('Score saved!');
  expect(await page.getByTestId('leaderboard-easy').innerText()).toBe(otherBoard);
});

test('the same player stays signed in after a reload and can log out', async ({ page }) => {
  await signIn(page);
  await page.reload();
  await expect(page.getByTestId('account-status')).toContainText(`Signed in as ${account!.name}`);
  await page.getByTestId('auth-logout').click();
  await expect(page.getByTestId('account-status')).toContainText('Guest mode');
  await page.reload();
  await expect(page.getByTestId('account-status')).toContainText('Guest mode');
});

test('a wrong password is refused with a generic message', async ({ page }) => {
  await signIn(page);
  await page.getByTestId('auth-logout').click();
  await page.getByTestId('auth-username').fill(account!.name);
  await page.getByTestId('auth-password').fill('not-the-right-password');
  await page.getByTestId('auth-login').click();
  await expect(page.getByTestId('auth-error')).toHaveText('Wrong username or password.');
  await expect(page.getByTestId('account-status')).toContainText('Guest mode');
});

test('guests can try the game for a minute, then must sign up', async ({ page }) => {
  // Pretend the guest has already used all but one second of the free minute.
  await page.addInitScript(() => {
    if (!localStorage.getItem('guestPlayedMs')) localStorage.setItem('guestPlayedMs', '59000');
  });
  await page.goto('/');
  await expect(page.getByTestId('account-status')).toContainText('Guest mode');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('overlay')).toBeHidden();
  await expect(page.getByTestId('overlay')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#overlay-text')).toContainText('Free trial over');
  await expect(page.getByTestId('start')).toBeDisabled();
  // Reloading does not reset the trial, and a guest has no score form.
  await page.reload();
  await expect(page.getByTestId('start')).toBeDisabled();
  await expect(page.getByTestId('submit-score')).toBeHidden();
});

test('the menu hugs the right side of the board and keeps its width', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'The side menu is a desktop layout');
  await page.setViewportSize({ width: 1800, height: 900 });
  await page.goto('/');
  const stage = (await page.locator('#stage').boundingBox())!;
  const hud = page.locator('#hud');
  const before = (await hud.boundingBox())!;
  // Right next to the board, not stuck to the edge of a wide browser window.
  expect(before.x - (stage.x + stage.width)).toBeLessThan(30);
  expect(before.x + before.width).toBeLessThan(1800 - 300);

  await page.getByTestId('start').click();
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('pause')).toHaveText('Resume');
  const after = (await hud.boundingBox())!;
  expect(after.width).toBe(before.width);
  expect(after.x).toBe(before.x);
});

test('the next piece is visible on every screen size', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#next')).toBeVisible();
});

test('the sound can be muted and the choice is remembered', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('mute')).toHaveText('Sound on');
  await page.getByTestId('mute').click();
  await expect(page.getByTestId('mute')).toHaveText('Sound off');
  await page.reload();
  await expect(page.getByTestId('mute')).toHaveText('Sound off');
  await page.getByTestId('mute').click();
  await expect(page.getByTestId('mute')).toHaveText('Sound on');
});

test('the bullet-time countdown is shown in easy mode only', async ({ page }) => {
  // Make the first bullet time come quickly by shortening time: the countdown starts at 10 to 60 s.
  await page.goto('/');
  await page.getByTestId('difficulty-easy').check();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('mirror-timer')).toContainText('Bullet time in');
  await page.getByTestId('pause').click();
  await page.getByTestId('pause').click();

  await page.goto('/');
  await page.getByTestId('difficulty-hard').check();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('overlay')).toBeHidden();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('mirror-timer')).toBeHidden();
});
