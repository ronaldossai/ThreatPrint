// Typed wrappers around the Tauri commands in `src-tauri/src/lib.rs`.
// All modelling happens in Rust; this file only crosses the boundary.

import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Pos, ThreatGrid } from "./types";

/** False when the UI is opened in a plain browser (e.g. `npm run dev`) rather than the desktop app. */
export const engineAvailable = isTauri();

export function fetchThreatGrid(cols: number, rows: number): Promise<ThreatGrid> {
  return invoke<ThreatGrid>("threat_grid", { cols, rows });
}

export function fetchLocationThreat(pos: Pos): Promise<number> {
  return invoke<number>("location_threat", { pos });
}
