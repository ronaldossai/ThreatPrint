//! Scenario data model: the serialisable description of a tactical situation.
//!
//! Kept intentionally small. Add fields only when a concrete use case needs
//! them (see the product brief's scope notes).

use std::collections::HashSet;
use std::fmt;

use serde::{Deserialize, Serialize};

use crate::geometry::{Pitch, Pos};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Team {
    /// The team in possession, attacking toward `+x`.
    Attack,
    Defence,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Player {
    /// Stable identifier, unique within a scenario.
    pub id: String,
    pub team: Team,
    /// Short display label, e.g. a role ("RW", "CB") or shirt number.
    pub label: String,
    pub pos: Pos,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Ball {
    pub pos: Pos,
    /// ID of the player in possession, if any.
    #[serde(default)]
    pub owner: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Scenario {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub pitch: Pitch,
    pub players: Vec<Player>,
    pub ball: Ball,
}

#[derive(Clone, Debug, PartialEq)]
pub enum ScenarioError {
    DuplicatePlayerId(String),
    OffPitch(String),
    UnknownBallOwner(String),
    BallOwnedByDefence(String),
}

impl fmt::Display for ScenarioError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::DuplicatePlayerId(id) => write!(f, "duplicate player id `{id}`"),
            Self::OffPitch(what) => write!(f, "`{what}` is positioned off the pitch"),
            Self::UnknownBallOwner(id) => write!(f, "ball owner `{id}` is not a player in this scenario"),
            Self::BallOwnedByDefence(id) => write!(
                f,
                "ball owner `{id}` is on the defending team; the team in possession must be `attack`"
            ),
        }
    }
}

impl std::error::Error for ScenarioError {}

impl Scenario {
    pub fn player(&self, id: &str) -> Option<&Player> {
        self.players.iter().find(|p| p.id == id)
    }

    /// Check structural invariants the engine relies on.
    pub fn validate(&self) -> Result<(), ScenarioError> {
        let mut seen = HashSet::new();
        for p in &self.players {
            if !seen.insert(p.id.as_str()) {
                return Err(ScenarioError::DuplicatePlayerId(p.id.clone()));
            }
            if !p.pos.is_on_pitch() {
                return Err(ScenarioError::OffPitch(p.id.clone()));
            }
        }
        if !self.ball.pos.is_on_pitch() {
            return Err(ScenarioError::OffPitch("ball".into()));
        }
        if let Some(owner) = &self.ball.owner {
            match self.player(owner) {
                None => return Err(ScenarioError::UnknownBallOwner(owner.clone())),
                Some(p) if p.team == Team::Defence => {
                    return Err(ScenarioError::BallOwnedByDefence(owner.clone()));
                }
                Some(_) => {}
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn player(id: &str, team: Team, x: f64, y: f64) -> Player {
        Player { id: id.into(), team, label: id.into(), pos: Pos::new(x, y) }
    }

    fn base() -> Scenario {
        Scenario {
            id: "t".into(),
            name: "test".into(),
            description: String::new(),
            tags: vec![],
            pitch: Pitch::default(),
            players: vec![player("a", Team::Attack, 0.8, 0.2), player("d", Team::Defence, 0.85, 0.25)],
            ball: Ball { pos: Pos::new(0.8, 0.2), owner: Some("a".into()) },
        }
    }

    #[test]
    fn valid_scenario_passes() {
        assert_eq!(base().validate(), Ok(()));
    }

    #[test]
    fn rejects_duplicate_ids() {
        let mut s = base();
        s.players.push(player("a", Team::Attack, 0.5, 0.5));
        assert_eq!(s.validate(), Err(ScenarioError::DuplicatePlayerId("a".into())));
    }

    #[test]
    fn rejects_off_pitch_positions() {
        let mut s = base();
        s.players[1].pos = Pos::new(1.2, 0.5);
        assert_eq!(s.validate(), Err(ScenarioError::OffPitch("d".into())));
    }

    #[test]
    fn rejects_unknown_or_defending_owner() {
        let mut s = base();
        s.ball.owner = Some("nobody".into());
        assert_eq!(s.validate(), Err(ScenarioError::UnknownBallOwner("nobody".into())));
        s.ball.owner = Some("d".into());
        assert_eq!(s.validate(), Err(ScenarioError::BallOwnedByDefence("d".into())));
    }

    #[test]
    fn pitch_defaults_when_omitted_from_json() {
        let json = r#"{
            "id": "x", "name": "x",
            "players": [],
            "ball": { "pos": { "x": 0.5, "y": 0.5 } }
        }"#;
        let s: Scenario = serde_json::from_str(json).unwrap();
        assert_eq!(s.pitch, Pitch::default());
        assert_eq!(s.ball.owner, None);
    }
}
