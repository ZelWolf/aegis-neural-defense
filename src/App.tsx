import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Battlefield } from './components/Arsenal';
import { CommandBar, EventLog, Footer, Header, Telemetry } from './components/Dashboard';
import { Dialogs } from './components/Dialogs';
import type { ModalKind } from './components/Dialogs';
import { Icon } from './components/Icon';
import { GameEngine } from './game/engine';
import { getAlias, readScores, saveScore, setAlias as persistAlias } from './game/storage';
import type { HighScore } from './game/storage';

export function App() {
  const [engine] = useState(() => new GameEngine());
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const [modal, setModal] = useState<ModalKind>(null);
  const [scores, setScores] = useState<HighScore[]>(readScores);
  const [alias, updateAlias] = useState(getAlias);
  const recordedSession = useRef<string | null>(null);
  const runDate = useRef(new Date().toISOString());

  const openModal = (kind: ModalKind) => { engine.pause(); setModal(kind); };
  const closeModal = () => setModal(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, select') || target.isContentEditable || event.metaKey || event.ctrlKey || event.altKey) return;
      if (modal) { if (event.key === 'Escape') setModal(null); return; }
      if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) engine.primaryAction(); }
      if (event.key === '1') engine.selectDefense('regex');
      if (event.key === '2') engine.selectDefense('semantic');
      if (event.key === '3') engine.selectDefense('railgun');
      if (event.key === 'Escape') engine.cancelSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine, modal]);

  useEffect(() => {
    const onHidden = () => { if (document.hidden) engine.pause(); };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, [engine]);

  useEffect(() => {
    if (state.phase !== 'gameover' || recordedSession.current === state.sessionId) return;
    recordedSession.current = state.sessionId;
    runDate.current = new Date().toISOString();
    const record: HighScore = { id: state.sessionId, name: alias.trim() || 'OPERATOR', score: state.score, wave: state.wave, blocked: state.blocked, date: runDate.current };
    setScores(current => state.storageAvailable ? saveScore(record) : [...current, record].sort((a, b) => b.score - a.score || b.wave - a.wave).slice(0, 5));
    setModal('gameover');
  }, [state.phase, state.sessionId, state.score, state.wave, state.blocked, state.storageAvailable, alias]);

  const changeAlias = (value: string) => {
    updateAlias(value);
    persistAlias(value.trim() || 'OPERATOR');
    if (state.phase === 'gameover') {
      const record: HighScore = { id: state.sessionId, name: value.trim() || 'OPERATOR', score: state.score, wave: state.wave, blocked: state.blocked, date: runDate.current };
      setScores(current => state.storageAvailable ? saveScore(record) : current.map(score => score.id === record.id ? record : score));
    }
  };

  return <><Header openArchive={() => openModal('archive')} openHelp={() => openModal('help')}/><main id="terminal" className="main-shell"><div className="page-heading"><div><div className="page-eyebrow"><span className="page-eyebrow-line"/>OPERATIONS<span>/</span>PROMPT FIREWALL</div><h1>Intelligence meets defense<span>.</span></h1><p>Your perimeter. Your rules. Keep the core uncompromised.</p></div><div className="page-actions"><button className="button subtle help-action" onClick={() => openModal('help')}><Icon name="help" size={15}/>How to play</button><button className="button stress-button" onClick={() => engine.stressTest()} disabled={state.phase === 'gameover'} title="Inject 40 mixed threats into the current mission"><Icon name="flask" size={15}/>Stress test<span className="button-tag">40 PKTS</span></button></div></div><CommandBar state={state} engine={engine}/><div className="workspace"><Battlefield state={state} engine={engine}/><aside className="telemetry-sidebar"><Telemetry state={state}/><EventLog state={state} engine={engine}/></aside></div><Footer state={state}/></main><Dialogs modal={modal} state={state} scores={scores} alias={alias} setAlias={changeAlias} close={closeModal} restart={() => { setModal(null); engine.reset(); }} openArchive={() => setModal('archive')}/></>;
}
