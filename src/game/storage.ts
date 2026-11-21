export interface HighScore {
  id: string;
  name: string;
  score: number;
  wave: number;
  blocked: number;
  date: string;
}

const SCORE_KEY = 'aegis.highscores.v1';
const ALIAS_KEY = 'aegis.operator.v1';
const MUTE_KEY = 'aegis.muted.v1';

export function storageAvailable() {
  try {
    localStorage.setItem('aegis.probe', '1');
    localStorage.removeItem('aegis.probe');
    return true;
  } catch { return false; }
}

export function readScores(): HighScore[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SCORE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is HighScore => value && typeof value.id === 'string' && typeof value.name === 'string' && Number.isFinite(value.score) && Number.isFinite(value.wave) && Number.isFinite(value.blocked) && typeof value.date === 'string').sort((a, b) => b.score - a.score || b.wave - a.wave).slice(0, 5);
  } catch { return []; }
}

export function saveScore(score: HighScore) {
  const scores = [...readScores().filter(s => s.id !== score.id), score].sort((a, b) => b.score - a.score || b.wave - a.wave).slice(0, 5);
  try { localStorage.setItem(SCORE_KEY, JSON.stringify(scores)); } catch { /* Keep the session playable if storage is unavailable. */ }
  return scores;
}

export function getAlias() { try { return localStorage.getItem(ALIAS_KEY)?.slice(0, 18) || 'OPERATOR'; } catch { return 'OPERATOR'; } }
export function setAlias(alias: string) { try { localStorage.setItem(ALIAS_KEY, alias); } catch { /* Optional preference. */ } }
export function getMuted() { try { return localStorage.getItem(MUTE_KEY) === 'true'; } catch { return false; } }
export function setMuted(muted: boolean) { try { localStorage.setItem(MUTE_KEY, String(muted)); } catch { /* Optional preference. */ } }
