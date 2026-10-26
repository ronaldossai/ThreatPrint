// Mirrors the serde types in `crates/simulation`. Keep in sync by hand for
// now; the fixture test in Rust guards the shared JSON shape.

/** Normalised position. x: 0 = own goal line → 1 = attacked goal line. y: 0 = top touchline → 1 = bottom. */
export interface Pos {
  x: number;
  y: number;
}

export type Team = "attack" | "defence";

export interface Player {
  id: string;
  team: Team;
  label: string;
  pos: Pos;
}

export interface Ball {
  pos: Pos;
  owner?: string | null;
}

export interface Scenario {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  players: Player[];
  ball: Ball;
}

export interface ThreatGrid {
  cols: number;
  rows: number;
  /** Row-major; index `row * cols + col`. Row 0 is the top touchline. */
  values: number[];
}
