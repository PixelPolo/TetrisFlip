import type { Difficulty } from './settings';

export interface ScoreEntry {
  name: string;
  difficulty: Difficulty;
  score: number;
  lines: number;
  level: number;
}

/** The leaderboard is optional: the game stays playable if the backend is down. */
export async function fetchScores(difficulty: Difficulty): Promise<ScoreEntry[]> {
  try {
    const response = await fetch(`/api/scores?difficulty=${difficulty}`);
    return response.ok ? ((await response.json()) as ScoreEntry[]) : [];
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
