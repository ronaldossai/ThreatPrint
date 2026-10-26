# ThreatPrint

An offline-first desktop tool for rehearsing football decisions in hypothetical
scenarios. Build a situation, explore alternative actions, and see how tactical
value shifts, with transparent reasoning instead of false certainty.

> **Status: foundation.** You can drag players and the ball on the pitch. The
> pitch shows a baseline spatial-threat heatmap computed by the Rust engine.
> Actions, comparisons and defensive responses come next.

## Layout

```text
apps/desktop/          Tauri 2 + React + TypeScript UI
  src/                 React app (pitch, panel, coordinate helpers)
  src-tauri/           Thin Tauri shell exposing typed commands
crates/simulation/     threatprint-sim: UI-independent Rust engine
fixtures/scenarios/    Example scenarios (JSON, shared by UI and engine tests)
docs/MODEL_NOTES.md    Coordinate system, model formulas, assumptions, limits
```

The engine (`threatprint-sim`) has no dependency on Tauri or the UI. The Tauri
crate only translates command arguments and delegates to the engine.

## Prerequisites

- Rust (stable). Developed with 1.99.
- Node.js 20 or later with npm. Developed with Node 24 / npm 11.
- macOS: Xcode Command Line Tools. For other platforms, see the
  [Tauri prerequisites](https://tauri.app/start/prerequisites/).

The Tauri CLI is installed as an npm dev dependency, so you don't need `cargo install tauri-cli`.

## Commands

Run all of these from the repository root.

```sh
npm install          # first time only
npm run app          # launch the desktop app (Vite dev server + Tauri, with hot reload)
npm test             # Rust tests (engine + fixtures) and frontend unit tests
npm run typecheck    # TypeScript check
npm run app:build    # release build and platform bundle
```

Engine-only tests: `cargo test -p threatprint-sim`.

Running `npm run dev -w @threatprint/desktop` opens the UI in a plain browser
without the Rust engine. The app shows a banner in this mode and the heatmap is
unavailable.

## Using the app

- Drag players to reposition them. The ball moves with its owner.
- Drag the ball and drop it within 2.5 m of an attacker to give them possession.
- Tab to a player and use the arrow keys to nudge them 0.5 m (hold Shift for 2 m).
- The side panel shows the baseline threat at the ball's location.

## Model honesty

All values are heuristic estimates from explicit, tunable parameters. They are
not calibrated probabilities or a validated xT/EPV model. See
[docs/MODEL_NOTES.md](docs/MODEL_NOTES.md).
