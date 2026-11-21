import { AudioSynth } from './audio';
import { getMuted, setMuted, storageAvailable } from './storage';
import { DEFENSES, THREATS, defenseStats, formatTime, sellValue, upgradeCost } from './types';
import type { Defense, DefenseKind, EventCategory, EventSeverity, GameSnapshot, Phase, Point, TerminalEvent, Threat, ThreatKind } from './types';

export const BOARD = { width: 1120, height: 610, cell: 60, cols: 17, rows: 9, x: 80, y: 65 };
const PATH: Point[] = [
  { x: 18, y: 305 }, { x: 260, y: 305 }, { x: 260, y: 125 },
  { x: 560, y: 125 }, { x: 560, y: 425 }, { x: 800, y: 425 },
  { x: 800, y: 245 }, { x: 1065, y: 245 },
];
const SEGMENTS = PATH.slice(1).map((point, index) => ({ from: PATH[index], to: point, length: Math.hypot(point.x - PATH[index].x, point.y - PATH[index].y) }));
const PATH_LENGTH = SEGMENTS.reduce((sum, segment) => sum + segment.length, 0);
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const gridPoint = (col: number, row: number): Point => ({ x: BOARD.x + col * BOARD.cell, y: BOARD.y + row * BOARD.cell });

interface Particle extends Point { vx: number; vy: number; life: number; maxLife: number; color: string; size: number }
interface Effect { kind: 'shot' | 'beam' | 'pulse' | 'text'; from: Point; to: Point; life: number; maxLife: number; color: string; radius?: number; text?: string }

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
  private audio = new AudioSynth();
  private storage = storageAvailable();
  private sessionId = '';
  private phase: Phase = 'ready';
  private wave = 0;
  private score = 0;
  private integrity = 100;
  private credits = 620;
  private speed: 1 | 2 = 1;
  private muted = getMuted();
  private defenses: Defense[] = [];
  private threats: Threat[] = [];
  private particles: Particle[] = [];
  private effects: Effect[] = [];
  private events: TerminalEvent[] = [];
  private traffic = Array<number>(40).fill(0);
  private selectedDefense: DefenseKind | null = null;
  private inspectedId: number | null = null;
  private hover: { col: number; row: number } | null = null;
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
  private message = 'Three starter nodes online. Your perimeter is ready.';
  private messageUntil = 0;

  constructor() {
    this.audio.setMuted(this.muted);
    this.initialize();
  }

  private initialize() {
    this.sessionId = globalThis.crypto?.randomUUID?.() ?? `aegis-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.addDefense('regex', 2, 3);
    this.addDefense('semantic', 7, 3);
    this.addDefense('railgun', 13, 4);
    this.log('system', 'info', 'AEGIS neural defense protocol initialized.');
    this.log('defense', 'success', '3 starter nodes online. Perimeter secured.');
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
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    this.resize();
    this.lastFrame = 0;
    this.animationId = requestAnimationFrame(this.frame);
  }

  detach() {
    cancelAnimationFrame(this.animationId);
    this.resizeObserver?.disconnect();
    this.canvas?.removeEventListener('pointermove', this.onPointerMove);
    this.canvas?.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas?.removeEventListener('pointerdown', this.onPointerDown);
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

  private pointerSlot(event: PointerEvent) {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * BOARD.width;
    const y = (event.clientY - rect.top) / rect.height * BOARD.height;
    const col = Math.round((x - BOARD.x) / BOARD.cell);
    const row = Math.round((y - BOARD.y) / BOARD.cell);
    if (col < 0 || col >= BOARD.cols || row < 0 || row >= BOARD.rows) return null;
    return { col, row };
  }

  private onPointerMove = (event: PointerEvent) => {
    this.hover = this.pointerSlot(event);
    if (this.canvas) {
      const tower = this.defenses.find(node => node.col === this.hover?.col && node.row === this.hover?.row);
      this.canvas.style.cursor = tower ? 'pointer' : this.selectedDefense ? 'crosshair' : 'default';
    }
  };
  private onPointerLeave = () => { this.hover = null; };
  private onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || this.phase === 'gameover') return;
    this.audio.unlock();
    const slot = this.pointerSlot(event);
    if (!slot) return;
    const existing = this.defenses.find(node => node.col === slot.col && node.row === slot.row);
    if (existing) {
      this.inspectedId = existing.id;
      this.selectedDefense = null;
      this.publish();
      return;
    }
    if (!this.selectedDefense) { this.inspectedId = null; this.publish(); return; }
    const point = gridPoint(slot.col, slot.row);
    if (isPathSlot(point) || slot.col === 0 || slot.col === BOARD.cols - 1 || slot.row === 0 || slot.row === BOARD.rows - 1) {
      this.notify('Choose an open slot beside the circuit path.');
      return;
    }
    const spec = DEFENSES[this.selectedDefense];
    if (this.credits < spec.cost) { this.notify(`Insufficient compute. ${spec.name} requires ${spec.cost} CR.`); return; }
    this.credits -= spec.cost;
    const node = this.addDefense(this.selectedDefense, slot.col, slot.row);
    this.burst(node, spec.color, 15);
    this.audio.play('place');
    this.log('defense', 'success', `${spec.name} deployed at ${String.fromCharCode(65 + slot.col)}${slot.row + 1}. −${spec.cost} CR`);
    this.notify(`${spec.name} deployed. Click another slot to build again.`);
  };

  selectDefense(kind: DefenseKind) {
    if (this.phase === 'gameover') return;
    this.audio.unlock();
    this.selectedDefense = this.selectedDefense === kind ? null : kind;
    this.inspectedId = null;
    this.publish();
  }

  cancelSelection() { this.selectedDefense = null; this.inspectedId = null; this.publish(); }
  toggleGrid() { this.showGrid = !this.showGrid; this.publish(); }
  toggleSpeed() { this.speed = this.speed === 1 ? 2 : 1; this.publish(); }
  toggleMuted() {
    this.audio.unlock();
    this.muted = !this.muted;
    this.audio.setMuted(this.muted);
    setMuted(this.muted);
    this.publish();
  }

  primaryAction() {
    this.audio.unlock();
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
    this.audio.play('start');
    this.publish();
  }

  stressTest() {
    if (this.phase === 'gameover') return;
    this.audio.unlock();
    if (this.wave === 0) this.wave = 1;
    this.phase = 'running';
    const kinds: ThreatKind[] = ['injection', 'swarm', 'swarm', 'exfiltrator', 'injection', 'swarm', 'exfiltrator', 'injection', 'swarm', 'zeroday'];
    for (let index = 0; index < 40; index++) this.spawn(kinds[index % kinds.length], Math.random() * 280);
    this.log('system', 'danger', 'STRESS TEST · 40 mixed threats injected simultaneously.');
    this.notify('Stress test active. 40 hostile packets in the perimeter.');
    this.audio.play('start');
    this.shake = 3;
    this.publish();
  }

  upgrade() {
    const node = this.defenses.find(defense => defense.id === this.inspectedId);
    if (!node || node.level >= 3 || this.phase === 'gameover') return;
    const cost = upgradeCost(node);
    if (this.credits < cost) { this.notify(`Upgrade requires ${cost} CR. Intercept threats to earn compute.`); return; }
    this.audio.unlock();
    this.credits -= cost;
    node.level++;
    node.invested += cost;
    node.pulse = 1;
    this.burst(node, DEFENSES[node.kind].color, 20);
    this.audio.play('place');
    this.log('defense', 'success', `${DEFENSES[node.kind].name} upgraded to level ${node.level}. −${cost} CR`);
    this.publish();
  }

  sell() {
    const node = this.defenses.find(defense => defense.id === this.inspectedId);
    if (!node || this.phase === 'gameover') return;
    const refund = sellValue(node);
    this.credits += refund;
    this.defenses = this.defenses.filter(defense => defense.id !== node.id);
    this.inspectedId = null;
    this.burst(node, '#8c9a96', 12);
    this.log('defense', 'info', `${DEFENSES[node.kind].name} decommissioned. +${refund} CR`);
    this.publish();
  }

  clearEvents() { this.events = []; this.publish(); }

  reset() {
    this.phase = 'ready'; this.wave = 0; this.score = 0; this.integrity = 100; this.credits = 620;
    this.defenses = []; this.threats = []; this.particles = []; this.effects = []; this.events = [];
    this.traffic = Array<number>(40).fill(0); this.selectedDefense = null; this.inspectedId = null;
    this.blocked = 0; this.leaked = 0; this.latency = 0; this.remainingSpawns = 0;
    this.spawnedThisWave = 0; this.spawnTimer = 0; this.elapsed = 0; this.trafficTimer = 0; this.shake = 0;
    this.message = 'Three starter nodes online. Your perimeter is ready.'; this.messageUntil = 0;
    this.initialize();
  }

  private addDefense(kind: DefenseKind, col: number, row: number) {
    const node: Defense = { id: this.nextId++, kind, col, row, ...gridPoint(col, row), level: 1, invested: DEFENSES[kind].cost, cooldown: 0, kills: 0, pulse: 0, angle: -Math.PI / 2 };
    this.defenses.push(node);
    return node;
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
        this.burst(threat, '#f17985', 22);
        this.audio.play('leak');
        this.log('threat', 'danger', `BREACH · ${THREATS[threat.kind].name} reached core. −${THREATS[threat.kind].damage} integrity.`);
        if (this.integrity <= 0) { this.endGame(); return; }
      }
    }

    for (const node of this.defenses) {
      node.cooldown = Math.max(0, node.cooldown - dt);
      node.pulse = Math.max(0, node.pulse - dt * 3);
      const stats = defenseStats(node.kind, node.level);
      const targets = this.threats.filter(threat => threat.health > 0 && distance(node, threat) <= stats.range);
      if (!targets.length || node.cooldown > 0) continue;
      const target = targets.reduce((a, b) => a.distance > b.distance ? a : b);
      node.angle = Math.atan2(target.y - node.y, target.x - node.x);
      node.cooldown = stats.cooldown;
      node.pulse = 1;
      const color = DEFENSES[node.kind].color;
      if (node.kind === 'semantic') {
        this.effects.push({ kind: 'pulse', from: node, to: node, radius: stats.range, life: 0.55, maxLife: 0.55, color });
        for (const enemy of targets) {
          enemy.slowUntil = this.elapsed + 1.6 + node.level * 0.2;
          enemy.armor = Math.max(0, enemy.armor - (3 + node.level * 2));
          this.hit(enemy, stats.damage, node);
        }
        this.audio.play('shield');
      } else {
        const railgun = node.kind === 'railgun';
        this.effects.push({ kind: railgun ? 'beam' : 'shot', from: { x: node.x, y: node.y }, to: { x: target.x, y: target.y }, life: railgun ? 0.25 : 0.12, maxLife: railgun ? 0.25 : 0.12, color });
        this.hit(target, stats.damage, node);
        this.audio.play(railgun ? 'railgun' : 'shot');
        if (railgun) {
          this.burst(target, color, 4);
          if (target.kind === 'zeroday') this.shake = Math.max(this.shake, 2.5);
        }
      }
    }

    this.threats = this.threats.filter(threat => threat.health > 0);
    if (!this.threats.length && this.remainingSpawns === 0) {
      this.phase = 'intermission';
      const bonus = 60 + this.wave * 20;
      this.credits += bonus;
      this.score += this.wave * 100;
      this.log('system', 'success', `Wave ${String(this.wave).padStart(2, '0')} neutralized. Perimeter secure. +${bonus} CR`);
      this.audio.play('clear');
      this.notify(`Wave ${String(this.wave).padStart(2, '0')} secured. +${bonus} CR. Fortify, then deploy the next wave.`);
    }
  }

  private hit(threat: Threat, rawDamage: number, node: Defense) {
    if (threat.health <= 0) return;
    threat.health -= Math.max(1, rawDamage - threat.armor);
    if (threat.health <= 0) {
      const spec = THREATS[threat.kind];
      this.blocked++;
      node.kills++;
      this.score += spec.score;
      this.credits += spec.reward;
      const age = (this.elapsed - threat.born) * 1000;
      this.latency = this.blocked === 1 ? age : this.latency * 0.85 + age * 0.15;
      this.burst(threat, spec.color, threat.kind === 'zeroday' ? 35 : 11);
      this.audio.play('impact');
      if (threat.kind === 'zeroday') {
        this.shake = 9;
        this.effects.push({ kind: 'text', from: { ...threat }, to: threat, life: 1.3, maxLife: 1.3, color: '#f4c179', text: 'ZERO-DAY NEUTRALIZED' });
        this.log('defense', 'success', `ZERO-DAY ELIMINATED · +${spec.score} score / +${spec.reward} CR`);
      } else if (this.blocked % 4 === 0) {
        this.log('defense', 'success', `Hostile packet blocked. ${this.blocked} total interceptions.`);
      }
    }
  }

  private endGame() {
    this.phase = 'gameover';
    this.integrity = 0;
    this.selectedDefense = null;
    this.inspectedId = null;
    this.log('system', 'danger', 'CORE COMPROMISED · Session terminated. Mission archived.');
    this.audio.play('over');
    this.publish();
  }

  private burst(point: Point, color: string, count: number) {
    for (let index = 0; index < count && this.particles.length < 850; index++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 25 + Math.random() * 110;
      const life = 0.25 + Math.random() * 0.5;
      this.particles.push({ x: point.x, y: point.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, color, size: 1 + Math.random() * 2.5 });
    }
  }

  private updateEffects(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 19);
    for (const particle of this.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= 0.97; particle.vy *= 0.97; particle.life -= dt; }
    this.particles = this.particles.filter(particle => particle.life > 0);
    for (const effect of this.effects) effect.life -= dt;
    this.effects = this.effects.filter(effect => effect.life > 0);
  }

  private publish() {
    const inspected = this.defenses.find(defense => defense.id === this.inspectedId);
    const counts = { injection: 0, exfiltrator: 0, swarm: 0, zeroday: 0 };
    for (const threat of this.threats) if (threat.health > 0) counts[threat.kind]++;
    const defaultMessage = this.phase === 'ready' ? 'Three starter nodes online. Your perimeter is ready.' : this.phase === 'paused' ? 'Simulation paused. Build, inspect, or resume when ready.' : this.phase === 'intermission' ? 'Perimeter secured. Fortify before deploying the next wave.' : this.phase === 'gameover' ? 'Core compromised. Reinitialize to restore the perimeter.' : 'Interception active. Click any defense to inspect or upgrade.';
    this.snapshot = {
      sessionId: this.sessionId, phase: this.phase, wave: this.wave, score: this.score, integrity: this.integrity, credits: this.credits,
      fps: Math.round(this.fps), latency: Math.round(this.latency), blocked: this.blocked, leaked: this.leaked, activeThreats: this.threats.filter(threat => threat.health > 0).length,
      queuedThreats: this.remainingSpawns, speed: this.speed, muted: this.muted, elapsed: this.elapsed,
      selectedDefense: this.selectedDefense, inspectedDefense: inspected ? { ...inspected } : null, defenseCount: this.defenses.length,
      events: this.events, traffic: this.traffic, counts, message: this.animationTime < this.messageUntil ? this.message : defaultMessage,
      showGrid: this.showGrid, storageAvailable: this.storage,
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

    const inspected = this.defenses.find(node => node.id === this.inspectedId);
    if (inspected) this.drawRange(context, inspected, defenseStats(inspected.kind, inspected.level).range, DEFENSES[inspected.kind].color);
    this.drawPlacement(context);
    for (const node of this.defenses) this.drawDefense(context, node);
    for (const threat of this.threats) if (threat.health > 0) this.drawThreat(context, threat);
    this.drawCore(context);
    this.drawEffects(context);

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
      const active = this.selectedDefense !== null;
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

  private drawRange(context: CanvasRenderingContext2D, point: Point, radius: number, color: string) {
    context.beginPath(); context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fillStyle = `${color}06`; context.fill(); context.strokeStyle = `${color}35`; context.lineWidth = 1; context.setLineDash([3, 5]); context.stroke(); context.setLineDash([]);
  }

  private drawPlacement(context: CanvasRenderingContext2D) {
    if (!this.hover || !this.selectedDefense || this.phase === 'gameover') return;
    const { col, row } = this.hover;
    const point = gridPoint(col, row);
    if (this.defenses.some(node => node.col === col && node.row === row)) return;
    const valid = col > 0 && col < BOARD.cols - 1 && row > 0 && row < BOARD.rows - 1 && !isPathSlot(point) && this.credits >= DEFENSES[this.selectedDefense].cost;
    const color = valid ? DEFENSES[this.selectedDefense].color : '#f17985';
    if (valid) this.drawRange(context, point, DEFENSES[this.selectedDefense].range, color);
    context.fillStyle = `${color}15`; context.fillRect(point.x - 25, point.y - 25, 50, 50);
    context.strokeStyle = `${color}b0`; context.lineWidth = 1; context.strokeRect(point.x - 25, point.y - 25, 50, 50);
    context.globalAlpha = 0.65;
    this.drawDefense(context, { ...point, id: -1, kind: this.selectedDefense, col, row, level: 1, invested: 0, cooldown: 0, kills: 0, pulse: 0, angle: 0 }, true);
    context.globalAlpha = 1;
  }

  private drawDefense(context: CanvasRenderingContext2D, node: Defense, ghost = false) {
    const spec = DEFENSES[node.kind];
    const selected = node.id === this.inspectedId;
    const hover = this.hover?.col === node.col && this.hover?.row === node.row;
    if (node.kind === 'semantic' && !ghost) {
      const gradient = context.createRadialGradient(node.x, node.y, 15, node.x, node.y, 72);
      gradient.addColorStop(0, '#74c5f80d'); gradient.addColorStop(1, '#74c5f800'); context.fillStyle = gradient; context.beginPath(); context.arc(node.x, node.y, 72, 0, Math.PI * 2); context.fill();
    }
    context.fillStyle = '#101a18'; context.strokeStyle = `${spec.color}35`; context.lineWidth = 1;
    context.beginPath(); context.roundRect(node.x - 26, node.y - 26, 52, 52, 8); context.fill(); context.stroke();
    if (selected || hover || node.pulse > 0) {
      context.shadowColor = spec.color; context.shadowBlur = selected ? 18 : node.pulse * 16; context.strokeStyle = `${spec.color}${selected ? 'cf' : '65'}`; context.stroke(); context.shadowBlur = 0;
    }
    context.fillStyle = `${spec.color}0c`; context.fillRect(node.x - 20, node.y - 20, 40, 40);
    context.strokeStyle = spec.color; context.fillStyle = spec.color; context.lineWidth = 1.6;
    if (node.kind === 'regex') {
      context.font = '500 23px "IBM Plex Mono", monospace'; context.textAlign = 'center'; context.fillText('.*', node.x - 1, node.y + 7);
    } else if (node.kind === 'semantic') {
      context.beginPath(); context.moveTo(node.x, node.y - 13); context.lineTo(node.x + 11, node.y - 8); context.lineTo(node.x + 10, node.y + 4); context.quadraticCurveTo(node.x + 7, node.y + 11, node.x, node.y + 14); context.quadraticCurveTo(node.x - 7, node.y + 11, node.x - 10, node.y + 4); context.lineTo(node.x - 11, node.y - 8); context.closePath(); context.stroke();
      context.beginPath(); context.moveTo(node.x - 5, node.y); context.lineTo(node.x - 1, node.y + 4); context.lineTo(node.x + 6, node.y - 5); context.stroke();
    } else {
      context.save(); context.translate(node.x, node.y); context.rotate(-Math.PI / 4);
      context.strokeRect(-5, -12, 10, 23); context.fillRect(-2, -18, 4, 13); context.beginPath(); context.moveTo(-10, 12); context.lineTo(10, 12); context.moveTo(-9, 4); context.lineTo(9, 4); context.stroke(); context.restore();
    }
    context.textAlign = 'center'; context.font = '9px "IBM Plex Mono", monospace'; context.fillStyle = '#7b8f83'; context.fillText(`${spec.short} / LV.${node.level}`, node.x, node.y + 42);
    for (let index = 0; index < node.level; index++) { context.fillStyle = spec.color; context.fillRect(node.x - (node.level * 5 - 2) + index * 10, node.y + 22, 5, 2); }
    if (!ghost && node.cooldown > 0 && node.kind === 'railgun') {
      const ratio = 1 - node.cooldown / defenseStats(node.kind, node.level).cooldown;
      context.fillStyle = '#c3a5fc20'; context.fillRect(node.x - 17, node.y + 49, 34, 2); context.fillStyle = '#c3a5fc88'; context.fillRect(node.x - 17, node.y + 49, 34 * ratio, 2);
    }
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

  private drawEffects(context: CanvasRenderingContext2D) {
    for (const effect of this.effects) {
      const alpha = effect.life / effect.maxLife;
      context.globalAlpha = alpha;
      if (effect.kind === 'shot' || effect.kind === 'beam') {
        context.beginPath(); context.moveTo(effect.from.x, effect.from.y); context.lineTo(effect.to.x, effect.to.y);
        context.strokeStyle = effect.color; context.shadowColor = effect.color; context.shadowBlur = effect.kind === 'beam' ? 20 : 8; context.lineWidth = effect.kind === 'beam' ? 5 * alpha : 1.8; context.stroke();
        if (effect.kind === 'beam') { context.shadowBlur = 0; context.strokeStyle = '#eef5ff'; context.lineWidth = 1.5 * alpha; context.stroke(); }
        context.shadowBlur = 0;
      } else if (effect.kind === 'pulse') {
        context.beginPath(); context.arc(effect.from.x, effect.from.y, (effect.radius ?? 100) * (1 - alpha), 0, Math.PI * 2);
        context.strokeStyle = effect.color; context.lineWidth = 1.5; context.stroke();
        context.fillStyle = `${effect.color}05`; context.fill();
      } else {
        context.font = '500 12px "IBM Plex Mono", monospace'; context.textAlign = 'center'; context.fillStyle = effect.color; context.fillText(effect.text ?? '', effect.from.x, effect.from.y - (1 - alpha) * 40 - 24);
      }
    }
    for (const particle of this.particles) {
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color; context.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    context.globalAlpha = 1;
  }
}
