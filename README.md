# AEGIS // Neural Defense Terminal

A browser-based tower-defense simulation with an interactive Canvas battlefield and live security telemetry.
Rendering, audio, and score persistence run locally, with no backend, external services, or API keys.

## Features

- Canvas engine driven by `requestAnimationFrame`, with circuit-path movement, vector graphics, particles, and screen shake.
- Three defense nodes provide rapid fire, area slow and armor stripping, and long-range damage. Regex Filters, Semantic Shields, and Adversarial Railguns support upgrades through level 3 and sell refunds.
- Four threat classes include Prompt Injections, Data Exfiltrators, DDoS Swarms, and Zero-Day Bosses. A boss appears every fifth wave.
- Procedural Web Audio synthesizes shots, shield pulses, impacts, and wave-clear chimes using oscillators and gain envelopes.
- Live telemetry reports FPS, wave, threat latency, and blocked/leaked packets. The event stream supports category filters, text search, and auto-scroll.
- A 40-threat stress test injects mixed packets simultaneously into the current mission.
- A local mission archive stores the top five scores and their highest waves in `localStorage`.

## Local setup

Use Node.js 20.19+ in the 20.x release line, or Node.js 22.12+ and npm. Run these commands from the repository root.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

```sh
npm run build
```

The build runs TypeScript checks and writes production assets to `dist/`. Serve that directory with a static file server, or run `npm run preview` for a local production preview.

## Controls

Each mission starts with three defense nodes and 620 compute credits. Select a defense card, then click an open grid slot beside the route to build. Click a placed node to inspect, upgrade, or sell it for 70% of its total cost.

Launch each wave manually. Interceptions and wave clears earn credits. The speed control switches between 1× and 2×, and the speaker control persists your mute preference. Opening a dialog or hiding the tab pauses the simulation.

| Key | Action |
| --- | --- |
| `Space` | Start, pause, or resume the simulation |
| `1` | Select Regex Filter |
| `2` | Select Semantic Shield |
| `3` | Select Adversarial Railgun |
| `Esc` | Cancel placement or close the inspector/dialog |

The stress test uses the current mission's score and integrity. At zero integrity, the summary records the result and allows a new mission.

## Tech stack

- Vite 7, React 19, and TypeScript 5.9
- HTML5 Canvas 2D and the Web Audio API
- CSS with responsive grid layouts
- `localStorage` for scores and preferences
- Bundled Inter and IBM Plex Mono fonts

## Source layout

```text
src/
  App.tsx               Application state, dialogs, and keyboard shortcuts
  main.tsx              React entry point and bundled font imports
  components/           Battlefield, inspector, dashboard, logs, and dialogs
  game/
    engine.ts           Game loop, pathing, waves, combat, and rendering
    types.ts            Game models, defense stats, and threat definitions
    audio.ts            Procedural sound synthesizer
    storage.ts          Validated score and preference persistence
  styles.css            Responsive terminal styles
```

The game loop runs independently of React. Telemetry snapshots publish at most every 125 ms during rendering, with immediate updates for player actions. Canvas resolution follows the device pixel ratio, capped at 2×. If browser storage is unavailable, scores persist for the current session.
