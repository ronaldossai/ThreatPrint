//! Tauri shell: a thin, typed bridge between the UI and `threatprint-sim`.
//!
//! Commands here should only translate arguments and delegate to the engine.
//! No modelling logic belongs in this crate.

use threatprint_sim::{Pitch, Pos, ThreatGrid, ThreatParams};

/// Upper bound on heatmap resolution, to keep a bad request from allocating
/// an enormous grid.
const MAX_GRID_CELLS: usize = 250_000;

#[tauri::command]
fn location_threat(pos: Pos) -> f64 {
    threatprint_sim::location_threat(&Pitch::default(), &ThreatParams::default(), pos)
}

#[tauri::command]
fn threat_grid(cols: usize, rows: usize) -> Result<ThreatGrid, String> {
    if cols == 0 || rows == 0 || cols.saturating_mul(rows) > MAX_GRID_CELLS {
        return Err(format!("grid size {cols}×{rows} is out of range"));
    }
    Ok(threatprint_sim::threat_grid(&Pitch::default(), &ThreatParams::default(), cols, rows))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![location_threat, threat_grid])
        .run(tauri::generate_context!())
        .expect("error while running ThreatPrint");
}
