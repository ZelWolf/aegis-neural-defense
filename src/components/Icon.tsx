import type { CSSProperties } from 'react';

export type IconName = 'shield' | 'activity' | 'trophy' | 'help' | 'play' | 'pause' | 'volume' | 'muted' | 'chevron' | 'terminal' | 'flask' | 'arrow' | 'upgrade' | 'reset' | 'grid' | 'close' | 'plus' | 'search' | 'trash' | 'check' | 'cpu' | 'bolt' | 'target' | 'clock' | 'external' | 'layers' | 'crosshair';
const paths: Record<IconName, React.ReactNode> = {
  shield: <><path d="m12 3 8 3v6c0 5-5 8-8 10-3-2-8-5-8-10V6Z"/><path d="m8.5 12 2.5 2.5 5-6"/></>,
  activity: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
  trophy: <><path d="M8 3h8v6a4 4 0 0 1-8 0Z"/><path d="M8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v6m-4 2h8m-6-2h4"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1 .7-1.7 1-1.7 2.7m0 3h.01"/></>,
  play: <path d="m9 5 11 7-11 7Z"/>,
  pause: <><path d="M8 5v14M16 5v14" strokeWidth="3"/></>,
  volume: <><path d="m11 4-6 5H2v6h3l6 5Zm5 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
  muted: <><path d="m11 4-6 5H2v6h3l6 5ZM17 9l5 6m0-6-5 6"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>,
  terminal: <><path d="m4 6 6 6-6 6m9 0h7"/></>,
  flask: <><path d="M9 3h6m-5 0v6L4 19a1.3 1.3 0 0 0 1 2h14a1.3 1.3 0 0 0 1-2L14 9V3M7 15h10m-7 3h.01m3-2h.01"/></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  upgrade: <path d="M12 20V4m-6 6 6-6 6 6M5 20h14"/>,
  reset: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  trash: <><path d="M3 6h18M5 6l1 15h12l1-15M9 6V3h6v3m-5 4v7m4-7v7"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  cpu: <><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/></>,
  bolt: <path d="m13 2-9 12h7l-1 8 10-13h-8Z"/>,
  target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  external: <><path d="M14 3h7v7m0-7L11 13M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/></>,
  layers: <><path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5"/></>,
  crosshair: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M12 8v8m-4-4h8"/></>,
};

export function Icon({ name, size = 18, className = '', style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>{paths[name]}</svg>;
}

export function DefenseGlyph({ kind, size = 22 }: { kind: 'regex' | 'semantic' | 'railgun'; size?: number }) {
  return kind === 'regex' ? <span className="regex-glyph" style={{ fontSize: size + 2 }} aria-hidden="true">.*</span> : <Icon name={kind === 'semantic' ? 'shield' : 'crosshair'} size={size} />;
}
