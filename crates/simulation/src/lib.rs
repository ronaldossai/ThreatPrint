//! ThreatPrint simulation engine.
//!
//! This crate is deliberately independent of any UI or desktop framework. It
//! accepts scenario state and returns structured results; rendering is the
//! caller's concern.
//!
//! All values produced here are **heuristic estimates** from an explicit,
//! hand-designed model. They are not calibrated probabilities and not a
//! statistically validated xT / EPV model. See `docs/MODEL_NOTES.md`.

pub mod geometry;
pub mod scenario;
pub mod threat;

pub use geometry::{Pitch, Point, Pos};
pub use scenario::{Ball, Player, Scenario, ScenarioError, Team};
pub use threat::{ThreatGrid, ThreatParams, location_threat, threat_grid};
