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

/** On a phone the buttons live in the burger menu; opening it pauses a running game. */
async function openMenu(page: Page, isMobile: boolean) {
  if (!isMobile) return;
  const burger = page.getByTestId('menu-toggle');
  if ((await burger.getAttribute('aria-expanded')) !== 'true') await burger.tap();
  await expect(burger).toHaveAttribute('aria-expanded', 'true');
}

async function closeMenu(page: Page, isMobile: boolean) {
  if (!isMobile) return;
  const burger = page.getByTestId('menu-toggle');
  if ((await burger.getAttribute('aria-expanded')) === 'true') await burger.tap();
  await expect(burger).toHaveAttribute('aria-expanded', 'false');
}

async function hardDrop(page: Page, isMobile: boolean) {
  if (isMobile) {
    // Swipe is the phone default; switch to the pad once.
    const controls = page.getByTestId('controls');
    if ((await page.locator('html').getAttribute('data-swipe')) !== null) {
      await openMenu(page, true);
      await controls.tap();
      await closeMenu(page, true);
    }
    await page.locator('#touch [data-action="hardDrop"]').tap();
  } else await page.keyboard.press('Space');
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

test('the theme can be switched to Game Boy green and back', async ({ page, isMobile }) => {
  await page.goto('/');
  await openMenu(page, isMobile);
  await page.getByTestId('theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'gameboy');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'gameboy');
  await openMenu(page, isMobile);
  await page.getByTestId('theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'color');
});

test('pause freezes the game and resume restarts it', async ({ page, isMobile }) => {
  await startGame(page);
  // On a phone, opening the burger menu pauses by itself.
  if (isMobile) await openMenu(page, true);
  else await page.getByTestId('pause').click();
  await expect(page.getByTestId('pause')).toHaveText('Resume');
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('pause')).toHaveText('Pause');
});

test('the main menu has no difficulty explanations and no swipe option', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('difficulty-easy')).toBeVisible();
  await expect(page.getByText('ghost piece')).toHaveCount(0);
  await expect(page.getByTestId('opt-swipe')).toHaveCount(0);
});

test('the burger menu pauses on open and resumes on close', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The burger menu is the phone layout');
  await startGame(page);
  await expect(page.getByTestId('menu-toggle')).toBeVisible();
  await openMenu(page, true);
  await expect(page.getByTestId('pause')).toHaveText('Resume');
  for (const id of ['pause', 'theme', 'mute', 'controls']) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await closeMenu(page, true);
  await expect(page.getByTestId('pause')).toHaveText('Pause');
  await expect(page.getByTestId('pause')).toBeHidden();
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

  // The server rejects games that are implausibly short.
  await page.waitForTimeout(3500);
  // The other difficulty's board must not change when this game is saved.
  const otherBoard = await page.getByTestId('leaderboard-hard').innerText();
  await page.getByTestId('submit-score').click();
  await expect(page.locator('#overlay-text')).toHaveText('Score saved!');
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

test('mobile can switch to a Game Boy pad that plays the game', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The pad is only shown on touch screens');
  await page.goto('/');
  // Swipe is the default on a phone; the burger menu switches to the pad.
  await openMenu(page, true);
  await page.getByTestId('controls').tap();
  await closeMenu(page, true);
  await expect(page.locator('#touch .dpad')).toBeVisible();
  // The title screen covers the pad: it starts from its own Play button.
  await expect(page.getByTestId('touch-start')).toBeVisible();
  await page.getByTestId('start').tap();
  await expect(page.getByTestId('overlay')).toBeHidden();
  await page.locator('#touch .ab .a').tap();
  await page.locator('#touch [data-action="hardDrop"]').tap();
  await expect(score(page)).not.toHaveText('0');
  // Start doubles as pause while playing.
  await page.getByTestId('touch-start').tap();
  await openMenu(page, true);
  await expect(page.getByTestId('pause')).toHaveText('Resume');
});

test('swipe controls replace the on-screen buttons', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The pad is only shown on touch screens');
  await page.goto('/');
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
  await expect(page.getByTestId('account-status')).toHaveText('Sign up or log in to keep playing.');
  await expect(page.getByTestId('start')).toBeDisabled();
  // Reloading does not reset the trial, and a guest has no score form.
  await page.reload();
  await expect(page.getByTestId('start')).toBeDisabled();
  await expect(page.getByTestId('submit-score')).toBeHidden();
});

test('the board, title screen and menu form one tidy centered group', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'The side menu is a desktop layout');
  await page.setViewportSize({ width: 1800, height: 900 });
  await page.goto('/');
  const play = (await page.locator('#play').boundingBox())!;
  const hud = page.locator('#hud');
  const before = (await hud.boundingBox())!;

  // Right next to the board, not stuck to the edge of a wide browser window...
  expect(before.x - (play.x + play.width)).toBeLessThan(30);
  expect(before.x + before.width).toBeLessThan(1800 - 300);
  // ...level with the board frame (same top, same height), and the group is centered.
  const frame = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      top: parseFloat(style.getPropertyValue('--frame-top')),
      h: parseFloat(style.getPropertyValue('--frame-h')),
    };
  });
  expect(frame.h).toBeGreaterThan(900 * 0.6);
  expect(Math.abs(before.y - (play.y + frame.top))).toBeLessThan(1.5);
  expect(Math.abs(before.height - frame.h)).toBeLessThan(1.5);
  const groupCenter = (play.x + before.x + before.width) / 2;
  expect(Math.abs(groupCenter - 900)).toBeLessThan(40);

  // The title screen is centered on the board, not on the window.
  const overlay = (await page.getByTestId('overlay').boundingBox())!;
  expect(Math.abs(overlay.x + overlay.width / 2 - (play.x + play.width / 2))).toBeLessThan(2);

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

test('the sound can be muted and the choice is remembered', async ({ page, isMobile }) => {
  await page.goto('/');
  await openMenu(page, isMobile);
  await expect(page.locator('#mute .label')).toHaveText('Sound on');
  await page.getByTestId('mute').click();
  await expect(page.locator('#mute .label')).toHaveText('Sound off');
  await page.reload();
  await openMenu(page, isMobile);
  await expect(page.locator('#mute .label')).toHaveText('Sound off');
  await page.getByTestId('mute').click();
  await expect(page.locator('#mute .label')).toHaveText('Sound on');
});

test('the bullet-time countdown is shown in easy mode only', async ({ page, isMobile }) => {
  // Make the first bullet time come quickly by shortening time: the countdown starts at 10 to 60 s.
  await page.goto('/');
  await page.getByTestId('difficulty-easy').check();
  await page.getByTestId('start').click();
  // The countdown is in the side panel on desktop and a pill under the bar on a phone.
  const timer = page.locator('[data-testid="mirror-timer"], [data-testid="hud-timer"]').filter({
    visible: true,
  });
  await expect(timer).toContainText('Bullet time in');
  const easyHud = (await page.locator('#hud').boundingBox())!;

  await page.goto('/');
  await page.getByTestId('difficulty-hard').check();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('overlay')).toBeHidden();
  await page.waitForTimeout(500);
  await expect(timer).toHaveCount(0);

  // The side panel keeps the same size whether or not the countdown shows.
  if (!isMobile) {
    expect((await page.locator('#hud').boundingBox())!.height).toBe(easyHud.height);
  }
});

test('swipe is the default on a phone and can be switched during a game', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Touch screens only');
  await page.goto('/');
  await expect(page.locator('#touch')).toBeHidden();
  await expect(page.getByTestId('swipe-zone')).toBeVisible();

  await page.getByTestId('start').tap();
  await expect(page.getByTestId('overlay')).toBeHidden();
  // The button is in the burger menu while playing, and the choice is remembered.
  await openMenu(page, true);
  await page.getByTestId('controls').tap();
  await closeMenu(page, true);
  await expect(page.locator('#touch')).toBeVisible();
  await expect(page.getByTestId('swipe-zone')).toBeHidden();
  await page.reload();
  await expect(page.locator('#touch')).toBeVisible();
  await openMenu(page, true);
  await page.getByTestId('controls').tap();
  await closeMenu(page, true);
  await expect(page.getByTestId('swipe-zone')).toBeVisible();
});

test('on a phone nothing is cut off or overlapping', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch screens only');
  await page.goto('/');
  const { width } = page.viewportSize()!;
  // The page never scrolls sideways, and the burger is reachable in the bar.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
  const bar = (await page.locator('#hud').boundingBox())!;
  const button = (await page.getByTestId('menu-toggle').boundingBox())!;
  expect(button.x + button.width).toBeLessThanOrEqual(width);
  expect(button.y + button.height).toBeLessThanOrEqual(bar.y + bar.height);

  await page.getByTestId('start').tap();
  const stage = (await page.locator('#stage').boundingBox())!;
  const zone = (await page.getByTestId('swipe-zone').boundingBox())!;
  expect(zone.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1);
  // Short and not full width, centered.
  expect(zone.width).toBeLessThan(width * 0.8);
  expect(zone.width).toBeGreaterThan(width * 0.5);
  expect(zone.height).toBeLessThan(zone.width / 2);
  expect(Math.abs(zone.x + zone.width / 2 - width / 2)).toBeLessThan(2);

  // Hold and Next have their top edge level with the top edge of the board frame.
  const frameTop = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--frame-top-abs')),
  );
  for (const id of ['#hold', '#next']) {
    const box = (await page.locator(`.stat:has(${id})`).boundingBox())!;
    expect(Math.abs(box.y - frameTop)).toBeLessThan(1.5);
  }
});

test('a long press on the controls never selects text or opens a menu', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Touch screens only');
  await page.goto('/');
  await openMenu(page, true);
  await page.getByTestId('controls').tap();
  await closeMenu(page, true);
  await page.getByTestId('start').tap();
  const blocked = await page.evaluate(() => {
    const pad = document.querySelector('#touch .ab .a')!;
    const make = (type: string) => new Event(type, { bubbles: true, cancelable: true });
    const menu = make('contextmenu');
    const select = make('selectstart');
    pad.dispatchEvent(menu);
    pad.dispatchEvent(select);
    const style = getComputedStyle(pad);
    return {
      menu: menu.defaultPrevented,
      select: select.defaultPrevented,
      userSelect: style.userSelect,
      callout: style.getPropertyValue('-webkit-touch-callout'),
    };
  });
  // Text fields keep their normal behavior.
  const inputSelectable = await page.evaluate(() => {
    const event = new Event('selectstart', { bubbles: true, cancelable: true });
    document.querySelector('#auth-username')!.dispatchEvent(event);
    return !event.defaultPrevented;
  });
  expect(inputSelectable).toBe(true);
  expect(blocked.menu).toBe(true);
  expect(blocked.select).toBe(true);
  expect(blocked.userSelect).toBe('none');
});
