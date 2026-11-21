export type DefenseKind = 'regex' | 'semantic' | 'railgun';
export type ThreatKind = 'injection' | 'exfiltrator' | 'swarm' | 'zeroday';
export type Phase = 'ready' | 'running' | 'paused' | 'intermission' | 'gameover';
export type EventCategory = 'system' | 'threat' | 'defense';
export type EventSeverity = 'info' | 'success' | 'warning' | 'danger';
export interface Point { x: number; y: number }

export interface DefenseSpec {
  name: string;
  short: string;
  description: string;
  cost: number;
  damage: number;
  range: number;
  cooldown: number;
  color: string;
  key: string;
}

export const DEFENSES: Record<DefenseKind, DefenseSpec> = {
  regex: { name: 'Regex Filter', short: 'RGX', description: 'Rapid-fire packet interception', cost: 100, damage: 11, range: 158, cooldown: 0.24, color: '#66e8b5', key: '1' },
  semantic: { name: 'Semantic Shield', short: 'SEM', description: 'Area slow + armor disruption', cost: 175, damage: 6, range: 150, cooldown: 0.95, color: '#74c5f8', key: '2' },
  railgun: { name: 'Adversarial Railgun', short: 'ADV', description: 'Long-range, high-impact laser', cost: 250, damage: 90, range: 295, cooldown: 1.9, color: '#c3a5fc', key: '3' },
};
export const DEFENSE_ORDER: DefenseKind[] = ['regex', 'semantic', 'railgun'];

export const THREATS: Record<ThreatKind, { name: string; color: string; health: number; speed: number; armor: number; damage: number; reward: number; score: number; size: number }> = {
  injection: { name: 'Prompt injection', color: '#f17985', health: 55, speed: 76, armor: 0, damage: 8, reward: 9, score: 20, size: 9 },
  exfiltrator: { name: 'Data exfiltrator', color: '#f4c179', health: 85, speed: 90, armor: 5, damage: 12, reward: 15, score: 35, size: 10 },
  swarm: { name: 'DDoS swarm', color: '#a89af7', health: 24, speed: 104, armor: 0, damage: 3, reward: 5, score: 10, size: 6 },
  zeroday: { name: 'Zero-day boss', color: '#ff8b62', health: 850, speed: 40, armor: 13, damage: 30, reward: 100, score: 250, size: 17 },
};
export const THREAT_ORDER: ThreatKind[] = ['injection', 'exfiltrator', 'swarm', 'zeroday'];

export interface Defense extends Point {
  id: number;
  kind: DefenseKind;
  col: number;
  row: number;
  level: number;
  invested: number;
  cooldown: number;
  kills: number;
  pulse: number;
  angle: number;
}

export interface Threat extends Point {
  id: number;
  kind: ThreatKind;
  distance: number;
  health: number;
  maxHealth: number;
  armor: number;
  speed: number;
  slowUntil: number;
  born: number;
  wobble: number;
}

export interface TerminalEvent {
  id: number;
  time: string;
  category: EventCategory;
  severity: EventSeverity;
  message: string;
}

export interface GameSnapshot {
  sessionId: string;
  phase: Phase;
  wave: number;
  score: number;
  integrity: number;
  credits: number;
  fps: number;
  latency: number;
  blocked: number;
  leaked: number;
  activeThreats: number;
  queuedThreats: number;
  speed: 1 | 2;
  muted: boolean;
  elapsed: number;
  selectedDefense: DefenseKind | null;
  inspectedDefense: Defense | null;
  defenseCount: number;
  events: TerminalEvent[];
  traffic: number[];
  counts: Record<ThreatKind, number>;
  message: string;
  showGrid: boolean;
  storageAvailable: boolean;
}

export function defenseStats(kind: DefenseKind, level: number) {
  const spec = DEFENSES[kind];
  return {
    damage: Math.round(spec.damage * Math.pow(1.65, level - 1)),
    range: spec.range + (level - 1) * 22,
    cooldown: spec.cooldown * Math.pow(0.82, level - 1),
  };
}

export function upgradeCost(node: Defense) { return Math.round(DEFENSES[node.kind].cost * (0.7 + (node.level - 1) * 0.5) / 5) * 5; }
export function sellValue(node: Defense) { return Math.round(node.invested * 0.7); }
export function formatTime(seconds: number) {
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, Math.floor(seconds) % 60].map(n => String(n).padStart(2, '0')).join(':');
}
