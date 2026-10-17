import type { Difficulty } from './settings';

export interface ScoreEntry {
  name: string;
  difficulty: Difficulty;
  score: number;
  lines: number;
  level: number;
}

function isScoreEntry(value: unknown): value is ScoreEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.name === 'string' && Number.isFinite(entry.score);
}

/** The leaderboard is optional: the game stays playable if the backend is down. */
export async function fetchScores(difficulty: Difficulty): Promise<ScoreEntry[]> {
  try {
    const response = await fetch(`/api/scores?difficulty=${difficulty}`);
    if (!response.ok) return [];
    const data: unknown = await response.json();
    return Array.isArray(data) ? data.filter(isScoreEntry).slice(0, 10) : [];
  } catch {
    return [];
  }
}

/** Spring Security's double-submit CSRF token, mirrored by the server in a readable cookie. */
function csrfHeaders(): Record<string, string> {
  const match = /(?:^|;\s*)XSRF-TOKEN=([^;]+)/.exec(document.cookie);
  return match?.[1] ? { 'X-XSRF-TOKEN': decodeURIComponent(match[1]) } : {};
}

async function post(path: string, body?: unknown): Promise<Response | null> {
  try {
    return await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

/** Fetches the CSRF cookie once, before the first state-changing request. */
async function ensureCsrfCookie(): Promise<void> {
  if (!csrfHeaders()['X-XSRF-TOKEN']) await currentUser();
}

/** The signed-in username, or null for guests (or when the backend is unreachable). */
export async function currentUser(): Promise<string | null> {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    const username = (data as { username?: unknown } | null)?.username;
    return typeof username === 'string' ? username : null;
  } catch {
    return null;
  }
}

export type AuthResult = { ok: true; username: string } | { ok: false; message: string };

async function authenticate(path: string, username: string, password: string): Promise<AuthResult> {
  await ensureCsrfCookie();
  const response = await post(path, { username, password });
  if (!response) return { ok: false, message: 'Server unreachable.' };
  if (response.ok) {
    const data = (await response.json()) as { username: string };
    return { ok: true, username: data.username };
  }
  const messages: Record<number, string> = {
    400: 'Username: 3-16 letters, digits, _ or -. Password: 10-128 characters.',
    401: 'Wrong username or password.',
    409: 'This username is taken.',
    429: 'Too many attempts. Try again later.',
  };
  return { ok: false, message: messages[response.status] ?? 'Something went wrong.' };
}

export const register = (username: string, password: string): Promise<AuthResult> =>
  authenticate('/api/auth/register', username, password);

export const login = (username: string, password: string): Promise<AuthResult> =>
  authenticate('/api/auth/login', username, password);

export async function logout(): Promise<void> {
  await post('/api/auth/logout');
}

/** Tells the server a game started: a score can only be saved for a game it has seen begin. */
export async function startGame(difficulty: Difficulty): Promise<boolean> {
  await ensureCsrfCookie();
  return (await post('/api/games', { difficulty }))?.ok === true;
}

export async function submitScore(entry: Omit<ScoreEntry, 'name'>): Promise<boolean> {
  return (await post('/api/scores', entry))?.ok === true;
}
