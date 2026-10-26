import { describe, expect, it } from "vitest";
import {
  clampToPitch,
  distanceM,
  distanceToGoalM,
  nearestPlayer,
  nudge,
  toMetres,
  toNormalised,
} from "./coords";
import type { Player } from "./types";

describe("coordinate conversion", () => {
  it("maps normalised corners to pitch dimensions", () => {
    expect(toMetres({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(toMetres({ x: 1, y: 1 })).toEqual({ x: 105, y: 68 });
    expect(toMetres({ x: 0.5, y: 0.5 })).toEqual({ x: 52.5, y: 34 });
  });

  it("round-trips metres and normalised", () => {
    const p = { x: 0.73, y: 0.21 };
    const back = toNormalised(toMetres(p));
    expect(back.x).toBeCloseTo(p.x, 12);
    expect(back.y).toBeCloseTo(p.y, 12);
  });

  it("clamps to the pitch", () => {
    expect(clampToPitch({ x: -0.2, y: 1.4 })).toEqual({ x: 0, y: 1 });
  });

  it("measures distance in metres", () => {
    expect(distanceM({ x: 0, y: 0.5 }, { x: 1, y: 0.5 })).toBeCloseTo(105);
    expect(distanceToGoalM({ x: 1 - 11 / 105, y: 0.5 })).toBeCloseTo(11);
  });

  it("nudges by metres and stays on the pitch", () => {
    const p = nudge({ x: 0.5, y: 0.5 }, 10.5, -6.8);
    expect(p.x).toBeCloseTo(0.6);
    expect(p.y).toBeCloseTo(0.4);
    expect(nudge({ x: 0.99, y: 0.5 }, 50, 0).x).toBe(1);
  });
});

describe("nearestPlayer", () => {
  const players: Player[] = [
    { id: "a", team: "attack", label: "A", pos: { x: 0.5, y: 0.5 } },
    { id: "b", team: "attack", label: "B", pos: { x: 0.52, y: 0.5 } },
    { id: "d", team: "defence", label: "D", pos: { x: 0.505, y: 0.5 } },
  ];

  it("finds the closest player within range", () => {
    expect(nearestPlayer(players, { x: 0.501, y: 0.5 }, 3)?.id).toBe("a");
  });

  it("respects the filter", () => {
    const attackers = (p: Player) => p.team === "attack";
    expect(nearestPlayer(players, { x: 0.506, y: 0.5 }, 3, attackers)?.id).toBe("a");
  });

  it("returns undefined when nobody is in range", () => {
    expect(nearestPlayer(players, { x: 0.1, y: 0.1 }, 3)).toBeUndefined();
  });
});
