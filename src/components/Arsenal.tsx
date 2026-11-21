import { useEffect, useRef } from 'react';
import { BOARD } from '../game/engine';
import type { GameEngine } from '../game/engine';
import { DEFENSE_ORDER, DEFENSES, defenseStats, sellValue, upgradeCost } from '../game/types';
import type { GameSnapshot } from '../game/types';
import { DefenseGlyph, Icon } from './Icon';

export function Battlefield({ state, engine }: { state: GameSnapshot; engine: GameEngine }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) engine.attach(canvasRef.current);
    return () => engine.detach();
  }, [engine]);
  const selected = state.inspectedDefense;
  const spec = selected ? DEFENSES[selected.kind] : null;
  const stats = selected ? defenseStats(selected.kind, selected.level) : null;
  const cost = selected ? upgradeCost(selected) : 0;

  return <section className="panel battlefield-panel" aria-label="Interactive battlefield">
    <div className="panel-heading battlefield-heading"><h2><Icon name="crosshair" size={16}/><span>Neural perimeter</span><span className="sector-label">SECTOR 07</span></h2><div className="arena-controls"><span className={`simulation-badge ${state.phase === 'running' ? 'running' : ''}`}><span className="status-dot"/>{state.phase === 'running' ? 'SIMULATION LIVE' : state.phase === 'paused' ? 'SIMULATION PAUSED' : 'SIMULATION STANDBY'}</span><span className="arena-divider"/><button className={`icon-button small ${state.showGrid ? 'is-active' : ''}`} onClick={() => engine.toggleGrid()} aria-label={state.showGrid ? 'Hide placement grid' : 'Show placement grid'} aria-pressed={state.showGrid} title="Toggle placement grid"><Icon name="grid" size={14}/></button></div></div>
    <div className={`canvas-container ${state.selectedDefense ? 'placing' : ''}`}>
      <canvas ref={canvasRef} width={BOARD.width} height={BOARD.height} tabIndex={0} aria-label="Tower defense battlefield. Select Regex, Semantic Shield, or Railgun with keys 1, 2, or 3, then click an open grid slot to place it. Click a defense node to upgrade or sell it." />
      <div className="arena-topline"><span><span className="arena-cross">+</span>LIVE VECTOR FIELD<span className="coordinate-label">17 × 09</span></span><span className={state.activeThreats ? 'warning-text' : ''}><span className="status-dot"/>{String(state.activeThreats).padStart(2, '0')} HOSTILES IN FIELD</span></div>
      <div className="board-legend"><span><i className="legend-path"/>THREAT ROUTE</span><span><i className="legend-node"/>DEFENSE NODE</span><span><i className="legend-core"/>PROTECTED CORE</span></div>
      {state.phase === 'paused' && !selected && <button className="pause-overlay" onClick={() => engine.primaryAction()}><span><Icon name="pause" size={23}/></span><strong>Simulation paused</strong><small>Press SPACE to resume</small></button>}
      {selected && spec && stats && <div className="node-inspector" style={{ '--node-color': spec.color } as React.CSSProperties}>
        <div className="inspector-heading"><span className="defense-icon"><DefenseGlyph kind={selected.kind} size={18}/></span><div><strong>{spec.name}</strong><small>LEVEL {selected.level} / 3 <span>·</span> {selected.kills} INTERCEPTIONS</small></div><button className="icon-button small" onClick={() => engine.cancelSelection()} aria-label="Close defense inspector"><Icon name="close" size={14}/></button></div>
        <div className="inspector-stats"><span><small>DAMAGE</small><strong>{stats.damage}</strong></span><span><small>RANGE</small><strong>{stats.range}<em>u</em></strong></span><span><small>COOLDOWN</small><strong>{stats.cooldown.toFixed(2)}<em>s</em></strong></span></div>
        <div className="inspector-actions"><button className="button upgrade-button" disabled={selected.level >= 3 || state.credits < cost} onClick={() => engine.upgrade()}><Icon name={selected.level >= 3 ? 'check' : 'upgrade'} size={14}/>{selected.level >= 3 ? 'Max level reached' : `Upgrade · ${cost} CR`}</button><button className="button sell-button" onClick={() => engine.sell()}>Sell <span>+{sellValue(selected)}</span></button></div>
      </div>}
      {state.selectedDefense && <div className="placement-notice"><Icon name="plus" size={14}/><span>Placing <strong>{DEFENSES[state.selectedDefense].name}</strong></span><kbd>ESC</kbd><button className="icon-button small" aria-label="Cancel placement" onClick={() => engine.cancelSelection()}><Icon name="close" size={13}/></button></div>}
    </div>
    <div className="battlefield-status"><span className={`status-dot ${state.phase === 'gameover' ? 'red' : ''}`}/><p role="status">{state.message}</p><span className="node-counter"><Icon name="layers" size={13}/>{String(state.defenseCount).padStart(2, '0')} NODES ONLINE</span></div>
    <div className="arsenal"><div className="arsenal-heading"><h3>Defense arsenal<span>BUILD YOUR PERIMETER</span></h3><span>SELECT A NODE TO DEPLOY<Icon name="chevron" size={11}/></span></div><div className="defense-cards">{DEFENSE_ORDER.map(kind => {
      const defense = DEFENSES[kind];
      const active = state.selectedDefense === kind;
      return <button className={`defense-card ${active ? 'selected' : ''} ${state.credits < defense.cost ? 'unaffordable' : ''}`} key={kind} style={{ '--node-color': defense.color } as React.CSSProperties} onClick={() => engine.selectDefense(kind)} aria-label={`Select ${defense.name}, ${defense.cost} compute credits`} aria-pressed={active} disabled={state.phase === 'gameover'}><div className="defense-card-top"><span className="defense-icon"><DefenseGlyph kind={kind}/></span><kbd>{defense.key}</kbd></div><strong>{defense.name}</strong><p>{defense.description}</p><div className="defense-card-bottom"><span><Icon name="cpu" size={12}/>{defense.cost}<small>CR</small></span><span className="deploy-label">{active ? 'SELECTED' : 'DEPLOY'}<Icon name={active ? 'check' : 'plus'} size={13}/></span></div></button>;
    })}</div></div>
  </section>;
}
