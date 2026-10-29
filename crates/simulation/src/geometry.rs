//! Pitch geometry and the coordinate system.
//!
//! # Coordinate system
//!
//! Positions in scenarios use **normalised** coordinates ([`Pos`]):
//!
//! - `x ∈ [0, 1]`: along the pitch length. `0` is the attacking team's own
//!   goal line, `1` is the goal line they are attacking. **The team in
//!   possession always attacks toward `+x`.**
//! - `y ∈ [0, 1]`: across the pitch width. `0` is the top touchline and `1`
//!   the bottom touchline, as viewed with the attack going left to right.
//!   Facing the attacked goal, `y = 0` is therefore the attacking team's
//!   **left** touchline (and the defending team's right).
//!
//! Geometric calculations happen in **metres** ([`Point`]) using the same
//! axes, with the origin at the top-left corner (own goal line, top touchline).

use serde::{Deserialize, Serialize};

/// A normalised pitch position. See the module docs for axis conventions.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Pos {
    pub x: f64,
    pub y: f64,
}

impl Pos {
    pub const fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }

    /// True if the position lies on or inside the pitch boundary.
    pub fn is_on_pitch(&self) -> bool {
        (0.0..=1.0).contains(&self.x) && (0.0..=1.0).contains(&self.y)
    }

    /// Reflect across the pitch's long axis (top ↔ bottom touchline).
    pub fn mirrored_y(&self) -> Self {
        Self::new(self.x, 1.0 - self.y)
    }
}

/// A position in metres, origin at the own-goal-line / top-touchline corner.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

impl Point {
    pub const fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }

    pub fn distance(&self, other: Point) -> f64 {
        (self.x - other.x).hypot(self.y - other.y)
    }
}

/// Physical pitch dimensions in metres.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pitch {
    pub length_m: f64,
    pub width_m: f64,
    pub goal_width_m: f64,
}

impl Default for Pitch {
    /// A standard 105 m × 68 m pitch with a 7.32 m goal.
    fn default() -> Self {
        Self {
            length_m: 105.0,
            width_m: 68.0,
            goal_width_m: 7.32,
        }
    }
}

impl Pitch {
    pub fn to_metres(&self, p: Pos) -> Point {
        Point::new(p.x * self.length_m, p.y * self.width_m)
    }

    pub fn to_normalised(&self, p: Point) -> Pos {
        Pos::new(p.x / self.length_m, p.y / self.width_m)
    }

    /// Distance in metres between two normalised positions.
    pub fn distance_m(&self, a: Pos, b: Pos) -> f64 {
        self.to_metres(a).distance(self.to_metres(b))
    }

    /// Centre of the goal being attacked (on the `x = 1` goal line), in metres.
    pub fn attacking_goal_centre(&self) -> Point {
        Point::new(self.length_m, self.width_m / 2.0)
    }

    /// The two posts of the goal being attacked, in metres.
    pub fn attacking_goal_posts(&self) -> (Point, Point) {
        let c = self.attacking_goal_centre();
        let half = self.goal_width_m / 2.0;
        (Point::new(c.x, c.y - half), Point::new(c.x, c.y + half))
    }

    /// Angle (radians) subtended by the attacking goal mouth from `p`.
    ///
    /// Returns `0` for positions beyond the goal line, and `π` for a point on
    /// the goal line strictly between the posts.
    pub fn goal_mouth_angle(&self, p: Pos) -> f64 {
        let m = self.to_metres(p);
        if m.x > self.length_m {
            return 0.0;
        }
        let (a, b) = self.attacking_goal_posts();
        let (ax, ay) = (a.x - m.x, a.y - m.y);
        let (bx, by) = (b.x - m.x, b.y - m.y);
        let cross = ax * by - ay * bx;
        let dot = ax * bx + ay * by;
        cross.abs().atan2(dot)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const EPS: f64 = 1e-9;

    #[test]
    fn normalised_corners_map_to_pitch_dimensions() {
        let pitch = Pitch::default();
        assert_eq!(pitch.to_metres(Pos::new(0.0, 0.0)), Point::new(0.0, 0.0));
        assert_eq!(pitch.to_metres(Pos::new(1.0, 1.0)), Point::new(105.0, 68.0));
        assert_eq!(pitch.to_metres(Pos::new(0.5, 0.5)), Point::new(52.5, 34.0));
    }

    #[test]
    fn metres_round_trip() {
        let pitch = Pitch::default();
        let p = Pos::new(0.73, 0.21);
        let back = pitch.to_normalised(pitch.to_metres(p));
        assert!((back.x - p.x).abs() < EPS && (back.y - p.y).abs() < EPS);
    }

    #[test]
    fn distance_uses_physical_units() {
        let pitch = Pitch::default();
        // Full pitch length along the centre line.
        let d = pitch.distance_m(Pos::new(0.0, 0.5), Pos::new(1.0, 0.5));
        assert!((d - 105.0).abs() < EPS);
        // Full width is shorter than full length on a non-square pitch.
        let w = pitch.distance_m(Pos::new(0.5, 0.0), Pos::new(0.5, 1.0));
        assert!((w - 68.0).abs() < EPS);
    }

    #[test]
    fn on_pitch_bounds() {
        assert!(Pos::new(0.0, 1.0).is_on_pitch());
        assert!(!Pos::new(-0.01, 0.5).is_on_pitch());
        assert!(!Pos::new(0.5, 1.01).is_on_pitch());
    }

    #[test]
    fn goal_mouth_angle_matches_closed_form_on_centre_line() {
        let pitch = Pitch::default();
        // Penalty spot: 11 m from goal line, centred.
        let spot = pitch.to_normalised(Point::new(105.0 - 11.0, 34.0));
        let expected = 2.0 * (3.66_f64 / 11.0).atan();
        assert!((pitch.goal_mouth_angle(spot) - expected).abs() < 1e-9);
    }

    #[test]
    fn goal_mouth_angle_edge_cases() {
        let pitch = Pitch::default();
        // On the goal line between the posts the goal fills a straight angle.
        let on_line = Pos::new(1.0, 0.5);
        assert!((pitch.goal_mouth_angle(on_line) - std::f64::consts::PI).abs() < 1e-9);
        // Beyond the goal line nothing is visible.
        assert_eq!(pitch.goal_mouth_angle(Pos::new(1.01, 0.5)), 0.0);
        // On the goal line outside the posts, both posts are collinear: zero angle.
        assert!(pitch.goal_mouth_angle(Pos::new(1.0, 0.1)).abs() < 1e-9);
    }

    #[test]
    fn goal_mouth_angle_is_symmetric_about_long_axis() {
        let pitch = Pitch::default();
        let p = Pos::new(0.8, 0.2);
        let a = pitch.goal_mouth_angle(p);
        let b = pitch.goal_mouth_angle(p.mirrored_y());
        assert!((a - b).abs() < 1e-12);
    }
}
