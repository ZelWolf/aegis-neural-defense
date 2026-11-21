import { THREATS, formatTime } from './types';
import type { EventCategory, EventSeverity, GameSnapshot, Phase, Point, TerminalEvent, Threat, ThreatKind } from './types';

export const BOARD = { width: 1120, height: 610, cell: 60, cols: 17, rows: 9, x: 80, y: 65 };
const PATH: Point[] = [
  { x: 18, y: 305 }, { x: 260, y: 305 }, { x: 260, y: 125 },
  { x: 560, y: 125 }, { x: 560, y: 425 }, { x: 800, y: 425 },
  { x: 800, y: 245 }, { x: 1065, y: 245 },
];
const SEGMENTS = PATH.slice(1).map((point, index) => ({ from: PATH[index], to: point, length: Math.hypot(point.x - PATH[index].x, point.y - PATH[index].y) }));
const PATH_LENGTH = SEGMENTS.reduce((sum, segment) => sum + segment.length, 0);
const gridPoint = (col: number, row: number): Point => ({ x: BOARD.x + col * BOARD.cell, y: BOARD.y + row * BOARD.cell });


function pointOnPath(value: number): Point {
  let remaining = Math.max(0, value);
  for (const segment of SEGMENTS) {
    if (remaining <= segment.length) {
      const ratio = remaining / segment.length;
      return { x: segment.from.x + (segment.to.x - segment.from.x) * ratio, y: segment.from.y + (segment.to.y - segment.from.y) * ratio };
    }
    remaining -= segment.length;
  }
  return PATH[PATH.length - 1];
}

function isPathSlot(point: Point) {
  return SEGMENTS.some(({ from, to }) => point.x >= Math.min(from.x, to.x) - 22 && point.x <= Math.max(from.x, to.x) + 22 && point.y >= Math.min(from.y, to.y) - 22 && point.y <= Math.max(from.y, to.y) + 22);
}

/** Owns the simulation and renderer. React receives bounded telemetry snapshots. */
export class GameEngine {
  private canvas: HTMLCanvasElement | null = null;

  private context: CanvasRenderingContext2D | null = null;

  private resizeObserver: ResizeObserver | null = null;

  private animationId = 0;

  private listeners = new Set<() => void>();

  private snapshot!: GameSnapshot;

  private sessionId = '';

  private phase: Phase = 'ready';

  private wave = 0;

  private score = 0;

  private integrity = 100;

  private credits = 620;

  private speed: 1 | 2 = 1;

  private threats: Threat[] = [];

  private events: TerminalEvent[] = [];

  private traffic = Array<number>(40).fill(0);

  private showGrid = true;

  private blocked = 0;

  private leaked = 0;

  private latency = 0;

  private remainingSpawns = 0;

  private spawnedThisWave = 0;

  private spawnTimer = 0;

  private elapsed = 0;

  private animationTime = 0;

  private fps = 60;

  private shake = 0;

  private nextId = 1;

  private lastFrame = 0;

  private lastPublish = 0;

  private trafficTimer = 0;

  private message = 'Perimeter initialized. Deploy your first wave.';

  private messageUntil = 0;

  constructor() {
    this.initialize();
  }

  private initialize() {
    this.sessionId = globalThis.crypto?.randomUUID?.() ?? `aegis-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.log('system', 'info', 'AEGIS neural defense protocol initialized.');
    this.log('system', 'info', 'Awaiting operator. Deploy your first wave.');
    this.publish();
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  getSnapshot = () => this.snapshot;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: false });
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    this.resize();
    this.lastFrame = 0;
    this.animationId = requestAnimationFrame(this.frame);
  }

  detach() {
    cancelAnimationFrame(this.animationId);
    this.resizeObserver?.disconnect();
    this.canvas = null;
    this.context = null;
  }

  private resize = () => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
  };

  toggleGrid() { this.showGrid = !this.showGrid; this.publish(); }

  toggleSpeed() { this.speed = this.speed === 1 ? 2 : 1; this.publish(); }

  primaryAction() {
    if (this.phase === 'ready' || this.phase === 'intermission') this.startWave();
    else if (this.phase === 'running') this.pause();
    else if (this.phase === 'paused') { this.phase = 'running'; this.publish(); }
    else if (this.phase === 'gameover') this.reset();
  }

  pause() { if (this.phase === 'running') { this.phase = 'paused'; this.publish(); } }

  private startWave() {
    this.wave++;
    this.phase = 'running';
    this.remainingSpawns = 10 + this.wave * 3 + (this.wave % 5 === 0 ? 1 : 0);
    this.spawnedThisWave = 0;
    this.spawnTimer = 0;
    this.log('system', 'warning', `Wave ${String(this.wave).padStart(2, '0')} inbound. ${this.remainingSpawns} threat signatures detected.`);
    if (this.wave % 5 === 0) this.log('threat', 'danger', 'CRITICAL · Zero-day boss signature approaching.');
    this.publish();
  }

  stressTest() {
    if (this.phase === 'gameover') return;
    if (this.wave === 0) this.wave = 1;
    this.phase = 'running';
    const kinds: ThreatKind[] = ['injection', 'swarm', 'swarm', 'exfiltrator', 'injection', 'swarm', 'exfiltrator', 'injection', 'swarm', 'zeroday'];
    for (let index = 0; index < 40; index++) this.spawn(kinds[index % kinds.length], Math.random() * 280);
    this.log('system', 'danger', 'STRESS TEST · 40 mixed threats injected simultaneously.');
    this.notify('Stress test active. 40 hostile packets in the perimeter.');
    this.shake = 3;
    this.publish();
  }

  clearEvents() { this.events = []; this.publish(); }

  reset() {
    this.phase = 'ready'; this.wave = 0; this.score = 0; this.integrity = 100; this.credits = 620;
    this.threats = []; this.events = []; this.traffic = Array<number>(40).fill(0);
    this.blocked = 0; this.leaked = 0; this.latency = 0; this.remainingSpawns = 0;
    this.spawnedThisWave = 0; this.spawnTimer = 0; this.elapsed = 0; this.trafficTimer = 0; this.shake = 0;
    this.message = 'Perimeter initialized. Deploy your first wave.'; this.messageUntil = 0;
    this.initialize();
  }

  private log(category: EventCategory, severity: EventSeverity, message: string) {
    this.events = [...this.events.slice(-99), { id: this.nextId++, time: formatTime(this.elapsed), category, severity, message }];
  }

  private notify(message: string) { this.message = message; this.messageUntil = this.animationTime + 4; this.publish(); }

  private spawn(kind: ThreatKind, initialDistance = 0) {
    const spec = THREATS[kind];
    const health = Math.round(spec.health * (1 + Math.max(0, this.wave - 1) * 0.24));
    this.threats.push({ id: this.nextId++, kind, ...pointOnPath(initialDistance), distance: initialDistance, health, maxHealth: health, armor: spec.armor, speed: spec.speed * (1 + Math.min(this.wave - 1, 25) * 0.025), slowUntil: 0, born: this.elapsed, wobble: Math.random() * Math.PI * 2 });
  }

  private frame = (now: number) => {
    const rawDelta = this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 60;
    this.lastFrame = now;
    const dt = Math.min(rawDelta, 0.05);
    if (rawDelta > 0 && rawDelta < 0.15) this.fps = this.fps * 0.94 + (1 / rawDelta) * 0.06;
    this.animationTime += dt;
    if (this.phase === 'running') this.update(dt * this.speed);
    this.updateEffects(dt);
    this.draw();
    if (now - this.lastPublish >= 125) { this.publish(); this.lastPublish = now; }
    this.animationId = requestAnimationFrame(this.frame);
  };

  private update(dt: number) {
    this.elapsed += dt;
    this.trafficTimer += dt;
    if (this.trafficTimer >= 0.5) { this.trafficTimer = 0; this.traffic = [...this.traffic.slice(1), this.threats.length]; }
    this.spawnTimer -= dt;
    while (this.spawnTimer <= 0 && this.remainingSpawns > 0) {
      let kind: ThreatKind = 'injection';
      if (this.wave % 5 === 0 && this.remainingSpawns === 1) kind = 'zeroday';
      else if (this.wave >= 2 && this.spawnedThisWave % 5 === 3) kind = 'exfiltrator';
      else if (this.spawnedThisWave % 4 === 2) kind = 'swarm';
      this.spawn(kind);
      if (this.spawnedThisWave === 0 || this.spawnedThisWave % 6 === 5) this.log('threat', 'warning', `${THREATS[kind].name} detected at ingress. Interception active.`);
      this.spawnedThisWave++;
      this.remainingSpawns--;
      this.spawnTimer += Math.max(0.2, 0.85 - this.wave * 0.035);
    }

    for (const threat of this.threats) {
      if (threat.health <= 0) continue;
      threat.distance += threat.speed * (threat.slowUntil > this.elapsed ? 0.47 : 1) * dt;
      Object.assign(threat, pointOnPath(threat.distance));
      if (threat.distance >= PATH_LENGTH) {
        this.integrity = Math.max(0, this.integrity - THREATS[threat.kind].damage);
        threat.health = -1;
        this.leaked++;
        this.shake = threat.kind === 'zeroday' ? 13 : 7;
        this.log('threat', 'danger', `BREACH · ${THREATS[threat.kind].name} reached core. −${THREATS[threat.kind].damage} integrity.`);
        if (this.integrity <= 0) { this.endGame(); return; }
      }
    }



    this.threats = this.threats.filter(threat => threat.health > 0);
    if (!this.threats.length && this.remainingSpawns === 0) {
      this.phase = 'intermission';
      const bonus = 60 + this.wave * 20;
      this.credits += bonus;
      this.score += this.wave * 100;
      this.log('system', 'success', `Wave ${String(this.wave).padStart(2, '0')} neutralized. Perimeter secure. +${bonus} CR`);
      this.notify(`Wave ${String(this.wave).padStart(2, '0')} secured. +${bonus} CR. Fortify, then deploy the next wave.`);
    }
  }

  private endGame() {
    this.phase = 'gameover';
    this.integrity = 0;
    this.log('system', 'danger', 'CORE COMPROMISED · Session terminated. Mission archived.');
    this.publish();
  }

  private updateEffects(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 19);
  }

  private publish() {
    const counts = { injection: 0, exfiltrator: 0, swarm: 0, zeroday: 0 };
    for (const threat of this.threats) if (threat.health > 0) counts[threat.kind]++;
    const defaultMessage = this.phase === 'ready' ? 'Perimeter initialized. Deploy your first wave.' : this.phase === 'paused' ? 'Simulation paused.' : this.phase === 'intermission' ? 'Wave completed. Deploy the next wave.' : this.phase === 'gameover' ? 'Core compromised. Reinitialize to restore the perimeter.' : 'Threat wave active.';
    this.snapshot = {
      sessionId: this.sessionId, phase: this.phase, wave: this.wave, score: this.score, integrity: this.integrity, credits: this.credits,
      fps: Math.round(this.fps), latency: Math.round(this.latency), blocked: this.blocked, leaked: this.leaked, activeThreats: this.threats.filter(threat => threat.health > 0).length,
      queuedThreats: this.remainingSpawns, speed: this.speed, muted: false, elapsed: this.elapsed,
      selectedDefense: null, inspectedDefense: null, defenseCount: 0,
      events: this.events, traffic: this.traffic, counts, message: this.animationTime < this.messageUntil ? this.message : defaultMessage,
      showGrid: this.showGrid, storageAvailable: false,
    };
    for (const listener of this.listeners) listener();
  }

  private tracePath(context: CanvasRenderingContext2D) {
    context.beginPath();
    context.moveTo(PATH[0].x, PATH[0].y);
    for (let index = 1; index < PATH.length; index++) context.lineTo(PATH[index].x, PATH[index].y);
  }

  private polygon(context: CanvasRenderingContext2D, x: number, y: number, radius: number, sides: number, rotation = -Math.PI / 2) {
    context.beginPath();
    for (let index = 0; index < sides; index++) {
      const angle = rotation + index / sides * Math.PI * 2;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (index === 0) context.moveTo(px, py); else context.lineTo(px, py);
    }
    context.closePath();
  }

  private draw() {
    const context = this.context;
    const canvas = this.canvas;
    if (!context || !canvas) return;
    context.setTransform(canvas.width / BOARD.width, 0, 0, canvas.height / BOARD.height, 0, 0);
    context.fillStyle = '#0b0f10';
    context.fillRect(0, 0, BOARD.width, BOARD.height);
    context.save();
    if (this.shake > 0) context.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    const glow = context.createRadialGradient(550, 300, 10, 550, 300, 580);
    glow.addColorStop(0, '#10201a55'); glow.addColorStop(1, '#0b0f1000');
    context.fillStyle = glow; context.fillRect(0, 0, BOARD.width, BOARD.height);
    this.drawGrid(context);

    context.lineJoin = 'round'; context.lineCap = 'round';
    this.tracePath(context); context.lineWidth = 38; context.strokeStyle = '#1e342b'; context.stroke();
    this.tracePath(context); context.lineWidth = 35; context.strokeStyle = '#101d18'; context.stroke();
    this.tracePath(context); context.lineWidth = 1; context.strokeStyle = '#487c6059'; context.setLineDash([4, 9]); context.lineDashOffset = -this.animationTime * 15; context.stroke(); context.setLineDash([]);

    for (let index = 0; index < 13; index++) {
      const point = pointOnPath((this.animationTime * 27 + index * 143) % PATH_LENGTH);
      context.fillStyle = '#74d9a85c'; context.shadowBlur = 8; context.shadowColor = '#66e8b5';
      context.fillRect(point.x - 1.5, point.y - 1.5, 3, 3); context.shadowBlur = 0;
    }

    context.font = '10px "IBM Plex Mono", monospace';
    context.textAlign = 'left'; context.fillStyle = '#6c7c73'; context.fillText('UNTRUSTED INPUT', 40, 264);
    context.fillStyle = '#d79b74'; context.font = '10px "IBM Plex Mono", monospace'; context.fillText('INGRESS', 40, 280);
    context.strokeStyle = '#b9815b'; context.lineWidth = 1.5;
    context.strokeRect(17, 295, 20, 20); context.beginPath(); context.moveTo(22, 305); context.lineTo(31, 305); context.moveTo(27, 301); context.lineTo(31, 305); context.lineTo(27, 309); context.stroke();

    for (const threat of this.threats) if (threat.health > 0) this.drawThreat(context, threat);
    this.drawCore(context);

    context.strokeStyle = '#324238'; context.lineWidth = 1;
    for (const [x, y, sx, sy] of [[22, 22, 1, 1], [1098, 22, -1, 1], [22, 588, 1, -1], [1098, 588, -1, -1]]) {
      context.beginPath(); context.moveTo(x, y + sy * 12); context.lineTo(x, y); context.lineTo(x + sx * 12, y); context.stroke();
    }
    context.restore();
  }

  private drawGrid(context: CanvasRenderingContext2D) {
    if (!this.showGrid) return;
    context.lineWidth = 0.65;
    context.strokeStyle = '#8fb2a108';
    for (let col = 0; col <= BOARD.cols; col++) { const x = BOARD.x - 30 + col * 60; context.beginPath(); context.moveTo(x, 35); context.lineTo(x, 575); context.stroke(); }
    for (let row = 0; row <= BOARD.rows; row++) { const y = BOARD.y - 30 + row * 60; context.beginPath(); context.moveTo(50, y); context.lineTo(1070, y); context.stroke(); }
    for (let col = 1; col < BOARD.cols - 1; col++) for (let row = 1; row < BOARD.rows - 1; row++) {
      const point = gridPoint(col, row);
      if (isPathSlot(point)) continue;
      const active = false;
      context.strokeStyle = active ? '#507c6250' : '#779c8324';
      context.lineWidth = 1;
      context.beginPath(); context.moveTo(point.x - 3, point.y); context.lineTo(point.x + 3, point.y); context.moveTo(point.x, point.y - 3); context.lineTo(point.x, point.y + 3); context.stroke();
      if (active) { context.strokeStyle = '#66e8b514'; context.strokeRect(point.x - 19, point.y - 19, 38, 38); }
    }
    context.font = '9px "IBM Plex Mono", monospace'; context.fillStyle = '#435149'; context.textAlign = 'center';
    for (let col = 1; col < BOARD.cols - 1; col++) context.fillText(String.fromCharCode(65 + col), BOARD.x + col * 60, 49);
    context.textAlign = 'left';
    for (let row = 1; row < BOARD.rows - 1; row++) context.fillText(String(row + 1).padStart(2, '0'), 32, BOARD.y + row * 60 + 3);
  }

  private drawThreat(context: CanvasRenderingContext2D, threat: Threat) {
    const spec = THREATS[threat.kind];
    const slowed = threat.slowUntil > this.elapsed;
    context.save(); context.translate(threat.x, threat.y + Math.sin(this.animationTime * 6 + threat.wobble) * 2);
    context.shadowBlur = threat.kind === 'zeroday' ? 18 : 10; context.shadowColor = spec.color;
    context.fillStyle = `${spec.color}28`; context.strokeStyle = spec.color; context.lineWidth = 1.5;
    this.polygon(context, 0, 0, spec.size, threat.kind === 'exfiltrator' ? 3 : threat.kind === 'zeroday' ? 6 : 4, threat.kind === 'swarm' ? Math.PI / 4 : -Math.PI / 2); context.fill(); context.stroke();
    context.shadowBlur = 0; context.fillStyle = spec.color; context.fillRect(-2, -2, 4, 4);
    if (threat.kind === 'zeroday') { this.polygon(context, 0, 0, 23, 6, this.animationTime * 0.5); context.strokeStyle = `${spec.color}55`; context.stroke(); }
    if (slowed) { context.strokeStyle = '#74c5f877'; context.lineWidth = 1; context.beginPath(); context.arc(0, 0, spec.size + 5, 0, Math.PI * 2); context.stroke(); }
    if (threat.health < threat.maxHealth || threat.kind === 'zeroday') {
      const width = threat.kind === 'zeroday' ? 38 : 22;
      context.fillStyle = '#39403b'; context.fillRect(-width / 2, -spec.size - 9, width, 2);
      context.fillStyle = spec.color; context.fillRect(-width / 2, -spec.size - 9, width * Math.max(0, threat.health / threat.maxHealth), 2);
    }
    context.restore();
  }

  private drawCore(context: CanvasRenderingContext2D) {
    const x = 1065, y = 245;
    const color = this.integrity > 30 ? '#66e8b5' : '#f17985';
    const pulse = Math.sin(this.animationTime * 2) * 0.15 + 0.85;
    const gradient = context.createRadialGradient(x, y, 10, x, y, 90);
    gradient.addColorStop(0, `${color}1b`); gradient.addColorStop(1, `${color}00`); context.fillStyle = gradient; context.beginPath(); context.arc(x, y, 90, 0, Math.PI * 2); context.fill();
    this.polygon(context, x, y, 34, 6); context.fillStyle = '#0c1c16'; context.fill(); context.strokeStyle = `${color}50`; context.lineWidth = 1; context.stroke();
    this.polygon(context, x, y, 27, 6); context.strokeStyle = color; context.globalAlpha = pulse; context.shadowColor = color; context.shadowBlur = 13; context.stroke(); context.shadowBlur = 0; context.globalAlpha = 1;
    context.strokeStyle = color; context.lineWidth = 1.5;
    context.beginPath(); context.moveTo(x, y - 13); context.lineTo(x + 10, y - 8); context.lineTo(x + 9, y + 3); context.quadraticCurveTo(x + 6, y + 10, x, y + 13); context.quadraticCurveTo(x - 6, y + 10, x - 9, y + 3); context.lineTo(x - 10, y - 8); context.closePath(); context.stroke();
    context.beginPath(); context.moveTo(x - 4, y); context.lineTo(x - 1, y + 3); context.lineTo(x + 5, y - 4); context.stroke();
    context.textAlign = 'right'; context.font = '10px "IBM Plex Mono", monospace'; context.fillStyle = '#859c8e'; context.fillText('CORE MODEL', 1090, 187);
    context.font = '9px "IBM Plex Mono", monospace'; context.fillStyle = color; context.fillText(`${String(this.integrity).padStart(3, '0')}% INTEGRITY`, 1090, 203);
    context.fillStyle = '#274334'; context.fillRect(1035, 292, 60, 3); context.fillStyle = color; context.fillRect(1035, 292, 60 * this.integrity / 100, 3);
  }
}
