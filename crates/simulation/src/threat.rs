//! Baseline spatial threat: how dangerous a location is for the team in
//! possession, ignoring all players.
//!
//! This is a **hand-designed heuristic**, not a fitted xT model. It blends two
//! interpretable terms:
//!
//! - **Goal-mouth angle**: how much of the goal is visible from the location,
//!   relative to the view from the penalty spot (capped at 1).
//! - **Proximity**: exponential decay with distance to the goal centre.
//!
//! `threat = angle_weight * min(1, angle / reference_angle)
//!         + distance_weight * exp(-distance / distance_decay_m)`
//!
//! With non-negative weights summing to 1 the result lies in `[0, 1]`. Scores
//! are only meaningful relative to each other under the same parameters.

use serde::{Deserialize, Serialize};

use crate::geometry::{Pitch, Pos};

/// Tunable parameters for [`location_threat`]. All assumptions live here.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreatParams {
    /// Weight of the goal-mouth angle term.
    pub angle_weight: f64,
    /// Weight of the proximity term.
    pub distance_weight: f64,
    /// Angle (radians) at which the angle term saturates to 1.
    pub reference_angle_rad: f64,
    /// Distance (metres) over which proximity decays by a factor of e.
    pub distance_decay_m: f64,
}

impl Default for ThreatParams {
    fn default() -> Self {
        Self {
            angle_weight: 0.6,
            distance_weight: 0.4,
            // Goal-mouth angle from the penalty spot: 2·atan(3.66 / 11) ≈ 0.642 rad.
            reference_angle_rad: 0.642,
            distance_decay_m: 18.0,
        }
    }
}

/// Baseline threat of holding the ball at `pos`, in `[0, 1]` for default-style
/// parameters. Positions beyond the attacking goal line score 0.
pub fn location_threat(pitch: &Pitch, params: &ThreatParams, pos: Pos) -> f64 {
    if pos.x > 1.0 {
        return 0.0;
    }
    let angle = pitch.goal_mouth_angle(pos);
    let angle_term = (angle / params.reference_angle_rad).min(1.0);
    let dist = pitch.to_metres(pos).distance(pitch.attacking_goal_centre());
    let proximity_term = (-dist / params.distance_decay_m).exp();
    params.angle_weight * angle_term + params.distance_weight * proximity_term
}

/// Threat sampled at the centres of a `cols × rows` grid covering the pitch.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreatGrid {
    pub cols: usize,
    pub rows: usize,
    /// Row-major values; index `row * cols + col`. Row 0 is the top touchline.
    pub values: Vec<f64>,
}

impl ThreatGrid {
    pub fn get(&self, col: usize, row: usize) -> Option<f64> {
        (col < self.cols && row < self.rows).then(|| self.values[row * self.cols + col])
    }
}

pub fn threat_grid(pitch: &Pitch, params: &ThreatParams, cols: usize, rows: usize) -> ThreatGrid {
    let mut values = Vec::with_capacity(cols * rows);
    for row in 0..rows {
        let y = (row as f64 + 0.5) / rows as f64;
        for col in 0..cols {
            let x = (col as f64 + 0.5) / cols as f64;
            values.push(location_threat(pitch, params, Pos::new(x, y)));
        }
    }
    ThreatGrid { cols, rows, values }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::geometry::Point;

    fn threat(x: f64, y: f64) -> f64 {
        location_threat(&Pitch::default(), &ThreatParams::default(), Pos::new(x, y))
    }

    #[test]
    fn bounded_in_unit_interval_across_pitch() {
        let g = threat_grid(&Pitch::default(), &ThreatParams::default(), 105, 68);
        assert!(g.values.iter().all(|v| (0.0..=1.0).contains(v)));
    }

    #[test]
    fn increases_toward_goal_along_centre_line() {
        let mut prev = threat(0.0, 0.5);
        for i in 1..=99 {
            let t = threat(i as f64 / 100.0, 0.5);
            assert!(t > prev, "threat should strictly increase at x = {}", i as f64 / 100.0);
            prev = t;
        }
    }

    #[test]
    fn central_beats_wide_at_same_depth() {
        assert!(threat(0.85, 0.5) > threat(0.85, 0.15));
    }

    #[test]
    fn symmetric_about_long_axis() {
        for &(x, y) in &[(0.9, 0.1), (0.7, 0.3), (0.95, 0.45)] {
            assert!((threat(x, y) - threat(x, 1.0 - y)).abs() < 1e-12);
        }
    }

    #[test]
    fn own_half_is_low_and_box_is_high() {
        let pitch = Pitch::default();
        let spot = pitch.to_normalised(Point::new(94.0, 34.0));
        assert!(threat(0.25, 0.5) < 0.1);
        assert!(threat(spot.x, spot.y) > 0.7);
    }

    #[test]
    fn beyond_goal_line_is_zero() {
        assert_eq!(threat(1.05, 0.5), 0.0);
    }

    #[test]
    fn deterministic() {
        assert_eq!(threat(0.83, 0.27).to_bits(), threat(0.83, 0.27).to_bits());
    }

    #[test]
    fn weights_are_respected() {
        let pitch = Pitch::default();
        let p = Pos::new(0.8, 0.3);
        let angle_only = ThreatParams { angle_weight: 1.0, distance_weight: 0.0, ..Default::default() };
        let expected = (pitch.goal_mouth_angle(p) / angle_only.reference_angle_rad).min(1.0);
        assert!((location_threat(&pitch, &angle_only, p) - expected).abs() < 1e-12);
    }

    #[test]
    fn grid_indexing_matches_direct_evaluation() {
        let pitch = Pitch::default();
        let params = ThreatParams::default();
        let g = threat_grid(&pitch, &params, 10, 4);
        assert_eq!(g.values.len(), 40);
        // Cell (col 7, row 1) has centre (0.75, 0.375).
        let direct = location_threat(&pitch, &params, Pos::new(0.75, 0.375));
        assert_eq!(g.get(7, 1), Some(direct));
        assert_eq!(g.get(10, 0), None);
    }
}
