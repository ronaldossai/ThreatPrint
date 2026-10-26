import { nearestPlayer } from "./coords";
import type { Pos, Scenario } from "./types";

/** A ball dropped within this many metres of an attacker is given to them. */
export const BALL_PICKUP_RADIUS_M = 2.5;

export type ScenarioAction =
  | { type: "movePlayer"; id: string; pos: Pos }
  | { type: "moveBall"; pos: Pos }
  | { type: "dropBall"; pos: Pos }
  | { type: "load"; scenario: Scenario };

export function scenarioReducer(state: Scenario, action: ScenarioAction): Scenario {
  switch (action.type) {
    case "movePlayer": {
      const player = state.players.find((p) => p.id === action.id);
      if (!player) return state;
      const players = state.players.map((p) => (p.id === action.id ? { ...p, pos: action.pos } : p));
      // The ball travels with its owner, keeping the same offset at their feet.
      if (state.ball.owner === action.id) {
        const dx = action.pos.x - player.pos.x;
        const dy = action.pos.y - player.pos.y;
        const ballPos = { x: state.ball.pos.x + dx, y: state.ball.pos.y + dy };
        return { ...state, players, ball: { ...state.ball, pos: ballPos } };
      }
      return { ...state, players };
    }
    case "moveBall":
      return { ...state, ball: { pos: action.pos, owner: null } };
    case "dropBall": {
      const owner = nearestPlayer(state.players, action.pos, BALL_PICKUP_RADIUS_M, (p) => p.team === "attack");
      return { ...state, ball: { pos: action.pos, owner: owner?.id ?? null } };
    }
    case "load":
      return action.scenario;
  }
}
