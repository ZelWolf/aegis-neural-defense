import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameEngine } from '../game/engine';
import { THREAT_ORDER, THREATS, formatTime } from '../game/types';
import type { EventCategory, GameSnapshot, Phase } from '../game/types';
import { Icon } from './Icon';

export function Header({ openArchive, openHelp }: { openArchive: () => void; openHelp: () => void }) {
  return <header className="app-header">
    <a className="brand" href="#terminal" aria-label="AEGIS terminal"><span className="brand-symbol"><Icon name="shield" size={23} /></span><span className="brand-name">AEGIS<span className="brand-slashes">//</span></span><span className="brand-descriptor">NEURAL DEFENSE<br />TERMINAL</span></a>
    <nav className="primary-nav" aria-label="Main navigation"><a href="#terminal" className="nav-link active"><Icon name="terminal" size={15} /> Terminal</a><button className="nav-link" onClick={openArchive}><Icon name="trophy" size={15} /> Mission archive</button></nav>
    <div className="header-end"><span className="system-online"><span className="status-dot" />SYSTEM ONLINE</span><span className="version">v1.0.0</span><button className="icon-button header-help" onClick={openHelp} aria-label="How to play"><Icon name="help" size={18} /></button></div>
  </header>;
}

const statusLabels: Record<Phase, string> = { ready: 'Awaiting deployment', running: 'Firewall active', paused: 'Simulation paused', intermission: 'Perimeter secured', gameover: 'Core compromised' };

export function CommandBar({ state, engine }: { state: GameSnapshot; engine: GameEngine }) {
  const isPlaying = state.phase === 'running';
  const label = isPlaying ? 'Pause simulation' : state.phase === 'paused' ? 'Resume simulation' : state.phase === 'gameover' ? 'New mission' : `Deploy wave ${String(state.wave + 1).padStart(2, '0')}`;
  return <section className="command-bar" aria-label="Mission status and controls">
    <div className="metric metric-status"><span className="eyebrow">SYSTEM STATUS</span><span className={`operation-status ${state.phase}`}><span className="status-dot" />{statusLabels[state.phase]}</span><span className="metric-footnote">PROMPT FIREWALL / ACTIVE</span></div>
    <div className="metric metric-score"><span className="eyebrow">THREAT SCORE</span><span className="metric-number">{String(state.score).padStart(6, '0')}<span className="number-unit">PTS</span></span></div>
    <div className="metric metric-integrity"><span className="eyebrow">CORE INTEGRITY<Icon name="shield" size={12} /></span><div className={`metric-number ${state.integrity <= 30 ? 'danger-text' : ''}`}>{state.integrity}<span className="number-unit">/ 100</span></div><div className={`integrity-track ${state.integrity <= 30 ? 'critical' : ''}`}><span style={{ width: `${state.integrity}%` }} /></div></div>
    <div className="metric metric-credits"><span className="eyebrow">COMPUTE CREDITS</span><span className="metric-number credits"><Icon name="cpu" size={20} />{state.credits.toLocaleString()}<span className="number-unit">CR</span></span></div>
    <div className="mission-controls"><button className={`icon-button sound-button ${state.muted ? 'is-muted' : ''}`} onClick={() => engine.toggleMuted()} aria-label={state.muted ? 'Unmute sound' : 'Mute sound'} title={state.muted ? 'Unmute sound' : 'Mute sound'}><Icon name={state.muted ? 'muted' : 'volume'} size={17} /></button><button className={`speed-button ${state.speed === 2 ? 'accelerated' : ''}`} onClick={() => engine.toggleSpeed()} aria-label={`Speed ${state.speed}x. Switch to ${state.speed === 1 ? 2 : 1}x`} title="Toggle simulation speed"><span>{state.speed}×</span><span className="speed-chevron">››</span></button><button className={`button primary play-button ${isPlaying ? 'playing' : ''}`} onClick={() => engine.primaryAction()}><Icon name={isPlaying ? 'pause' : state.phase === 'gameover' ? 'reset' : 'play'} size={16} />{label}</button></div>
  </section>;
}

function TrafficChart({ values }: { values: number[] }) {
  const max = Math.max(12, ...values);
  const points = values.map((value, i) => `${i / (values.length - 1) * 270},${44 - value / max * 37}`).join(' ');
  return <svg viewBox="0 0 270 50" className="traffic-chart" role="img" aria-label={`Network traffic history. Currently ${values[values.length - 1]} active threats.`} preserveAspectRatio="none"><defs><linearGradient id="traffic-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#65e6b2" stopOpacity=".2"/><stop offset="100%" stopColor="#65e6b2" stopOpacity="0"/></linearGradient></defs><path d="M0 13H270M0 30H270M0 46H270" stroke="#26332d" strokeWidth=".6" strokeDasharray="2 4"/><polygon points={`0,50 ${points} 270,50`} fill="url(#traffic-fill)"/><polyline points={points} fill="none" stroke="#65e6b2" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/><circle cx="270" cy={44 - (values[values.length - 1] ?? 0) / max * 37} r="2.5" fill="#8df6ce"/></svg>;
}

export function Telemetry({ state }: { state: GameSnapshot }) {
  const total = state.blocked + state.leaked;
  const blockRate = total ? Math.round(state.blocked / total * 100) : 100;
  return <section className="panel telemetry-panel" aria-label="Live telemetry">
    <div className="panel-heading"><h2><Icon name="activity" size={16} />Live telemetry</h2><span className="live-label"><span className="status-dot" />LIVE</span></div>
    <div className="performance-row"><span className="eyebrow">RENDER PERFORMANCE</span><span className={`fps ${state.fps < 40 ? 'warning-text' : ''}`}><span className="fps-bars"><i/><i/><i/><i/></span>{state.fps}<small>FPS</small></span></div>
    <TrafficChart values={state.traffic} />
    <div className="telemetry-grid"><div><span className="eyebrow">CURRENT WAVE</span><strong>{String(state.wave).padStart(2, '0')}<small>/ ∞</small></strong></div><div><span className="eyebrow">THREAT LATENCY</span><strong>{state.latency.toLocaleString()}<small>ms</small></strong></div><div><span className="eyebrow"><span className="tiny-square emerald"/>BLOCKED</span><strong className="emerald-text">{String(state.blocked).padStart(3, '0')}</strong></div><div><span className="eyebrow"><span className="tiny-square crimson"/>LEAKED</span><strong className={state.leaked ? 'danger-text' : 'muted-text'}>{String(state.leaked).padStart(3, '0')}</strong></div></div>
    <div className="block-rate"><span>Interception rate</span><strong className={blockRate < 75 ? 'warning-text' : ''}>{blockRate}%</strong><div className="block-track"><span style={{ width: `${blockRate}%` }} /></div></div>
    <div className="threat-heading"><span className="eyebrow">ACTIVE THREAT SIGNATURES</span><span>{state.activeThreats} TOTAL</span></div>
    <div className="threat-list">{THREAT_ORDER.map(kind => <div className="threat-row" key={kind}><span className="threat-symbol" style={{ color: THREATS[kind].color }}>◆</span><span>{THREATS[kind].name}</span><div className="threat-meter"><span style={{ width: `${state.activeThreats ? state.counts[kind] / state.activeThreats * 100 : 0}%`, backgroundColor: THREATS[kind].color }} /></div><span className="threat-count">{String(state.counts[kind]).padStart(2, '0')}</span></div>)}</div>
  </section>;
}

export function EventLog({ state, engine }: { state: GameSnapshot; engine: GameEngine }) {
  const [filter, setFilter] = useState<EventCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const events = useMemo(() => state.events.filter(event => (filter === 'all' || event.category === filter) && `${event.message} ${event.category} ${event.severity}`.toLowerCase().includes(query.toLowerCase())), [state.events, filter, query]);
  useEffect(() => { if (autoScroll && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [events, autoScroll]);
  return <section className="panel event-panel" aria-label="Event stream">
    <div className="panel-heading"><h2><Icon name="terminal" size={16} />Event stream<span className="event-count">{state.events.length}</span></h2><button className="icon-button small" onClick={() => engine.clearEvents()} aria-label="Clear event log" title="Clear event log"><Icon name="trash" size={14}/></button></div>
    <div className="event-toolbar"><div className="log-filters">{(['all', 'threat', 'defense'] as const).map(value => <button className={filter === value ? 'active' : ''} key={value} onClick={() => setFilter(value)} aria-pressed={filter === value}>{value === 'all' ? 'All events' : value === 'threat' ? 'Threats' : 'Defense'}</button>)}</div><button className={`autoscroll ${autoScroll ? 'active' : ''}`} onClick={() => setAutoScroll(!autoScroll)} title={autoScroll ? 'Pause auto-scroll' : 'Enable auto-scroll'} aria-label={autoScroll ? 'Pause log auto-scroll' : 'Enable log auto-scroll'} aria-pressed={autoScroll}><Icon name={autoScroll ? 'pause' : 'play'} size={11}/></button></div>
    <div className="event-list" ref={logRef} tabIndex={0} aria-label="Security event messages">{events.length ? events.map(event => <div className={`event ${event.severity}`} key={event.id}><div className="event-meta"><time>{event.time}</time><span>{event.category === 'system' ? 'SYS' : event.category === 'threat' ? 'THREAT' : 'DEFENSE'}</span></div><p><span className="event-prompt">›</span>{event.message}</p></div>) : <div className="empty-log">{query ? 'No events match your filter.' : 'Listening for matching events…'}</div>}<span className="terminal-cursor" /></div>
    <label className="event-search"><Icon name="search" size={13}/><input aria-label="Filter event messages" value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter event stream…" spellCheck={false}/><span>{autoScroll ? 'LIVE' : 'HOLD'}</span></label>
  </section>;
}

export function Footer({ state }: { state: GameSnapshot }) {
  return <footer className="app-footer"><span><span className="status-dot" />ALL SYSTEMS LOCAL<span className="footer-separator">/</span>NO API CONNECTION REQUIRED</span><div className="keyboard-hints"><span><kbd>SPACE</kbd>Pause / resume</span><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>Select defense</span><span><kbd>ESC</kbd>Cancel</span></div><span className="session-time"><Icon name="clock" size={12}/>{formatTime(state.elapsed)}</span></footer>;
}
