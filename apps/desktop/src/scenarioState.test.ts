import { describe, expect, it } from "vitest";
import { scenarioReducer } from "./scenarioState";
import type { Scenario } from "./types";

const base: Scenario = {
  id: "t",
  name: "t",
  players: [
    { id: "rw", team: "attack", label: "RW", pos: { x: 0.7, y: 0.1 } },
    { id: "st", team: "attack", label: "ST", pos: { x: 0.85, y: 0.5 } },
    { id: "lb", team: "defence", label: "LB", pos: { x: 0.75, y: 0.12 } },
  ],
  ball: { pos: { x: 0.705, y: 0.1 }, owner: "rw" },
};

describe("scenarioReducer", () => {
  it("moves the ball with its owner", () => {
    const s = scenarioReducer(base, { type: "movePlayer", id: "rw", pos: { x: 0.8, y: 0.2 } });
    expect(s.ball.pos.x).toBeCloseTo(0.805);
    expect(s.ball.pos.y).toBeCloseTo(0.2);
    expect(s.ball.owner).toBe("rw");
  });

  it("leaves the ball alone when a non-owner moves", () => {
    const s = scenarioReducer(base, { type: "movePlayer", id: "st", pos: { x: 0.9, y: 0.5 } });
    expect(s.ball).toBe(base.ball);
  });

  it("detaches the ball while dragging it", () => {
    const s = scenarioReducer(base, { type: "moveBall", pos: { x: 0.6, y: 0.6 } });
    expect(s.ball.owner).toBeNull();
  });

  it("gives a dropped ball to a nearby attacker but never a defender", () => {
    const toStriker = scenarioReducer(base, { type: "dropBall", pos: { x: 0.851, y: 0.5 } });
    expect(toStriker.ball.owner).toBe("st");
    const nearDefender = scenarioReducer(base, { type: "dropBall", pos: { x: 0.751, y: 0.12 } });
    expect(nearDefender.ball.owner).toBeNull();
  });
});
