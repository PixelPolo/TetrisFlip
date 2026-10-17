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

export async function submitScore(entry: ScoreEntry): Promise<boolean> {
  try {
    const response = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    return response.ok;
  } catch {
    return false;
  }
}
