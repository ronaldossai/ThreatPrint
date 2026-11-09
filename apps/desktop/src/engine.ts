// Typed wrappers around the Tauri commands in `src-tauri/src/lib.rs`.
// All modelling happens in Rust; this file only crosses the boundary.

import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Pitch, Pos, ThreatGrid } from "./types";

/** False when the UI is opened in a plain browser (e.g. `npm run dev`) rather than the desktop app. */
export const engineAvailable = isTauri();

export function fetchThreatGrid(pitch: Pitch, cols: number, rows: number): Promise<ThreatGrid> {
  return invoke<ThreatGrid>("threat_grid", { pitch, cols, rows });
}

export function fetchLocationThreat(pitch: Pitch, pos: Pos): Promise<number> {
  return invoke<number>("location_threat", { pitch, pos });
}
