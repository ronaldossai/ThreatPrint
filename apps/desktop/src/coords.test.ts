import { describe, expect, it } from "vitest";
import {
  DEFAULT_PITCH,
  clampToPitch,
  distanceM,
  distanceToGoalM,
  nearestPlayer,
  nudge,
  pitchOf,
  toMetres,
  toNormalised,
} from "./coords";
import type { Pitch, Player } from "./types";

const FULL = DEFAULT_PITCH;

describe("coordinate conversion", () => {
  it("maps normalised corners to pitch dimensions", () => {
    expect(toMetres(FULL, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(toMetres(FULL, { x: 1, y: 1 })).toEqual({ x: 105, y: 68 });
    expect(toMetres(FULL, { x: 0.5, y: 0.5 })).toEqual({ x: 52.5, y: 34 });
  });

  it("uses the given pitch's dimensions", () => {
    const small: Pitch = { lengthM: 40, widthM: 20, goalWidthM: 3 };
    expect(toMetres(small, { x: 1, y: 1 })).toEqual({ x: 40, y: 20 });
    expect(distanceToGoalM(small, { x: 0, y: 0.5 })).toBeCloseTo(40);
  });

  it("falls back to the full-size pitch when a scenario has none", () => {
    expect(pitchOf({ id: "t", name: "t", players: [], ball: { pos: { x: 0.5, y: 0.5 } } })).toBe(DEFAULT_PITCH);
  });

  it("round-trips metres and normalised", () => {
    const p = { x: 0.73, y: 0.21 };
    const back = toNormalised(FULL, toMetres(FULL, p));
    expect(back.x).toBeCloseTo(p.x, 12);
    expect(back.y).toBeCloseTo(p.y, 12);
  });

  it("clamps to the pitch", () => {
    expect(clampToPitch({ x: -0.2, y: 1.4 })).toEqual({ x: 0, y: 1 });
  });

  it("measures distance in metres", () => {
    expect(distanceM(FULL, { x: 0, y: 0.5 }, { x: 1, y: 0.5 })).toBeCloseTo(105);
    expect(distanceToGoalM(FULL, { x: 1 - 11 / 105, y: 0.5 })).toBeCloseTo(11);
  });

  it("nudges by metres and stays on the pitch", () => {
    const p = nudge(FULL, { x: 0.5, y: 0.5 }, 10.5, -6.8);
    expect(p.x).toBeCloseTo(0.6);
    expect(p.y).toBeCloseTo(0.4);
    expect(nudge(FULL, { x: 0.99, y: 0.5 }, 50, 0).x).toBe(1);
  });
});

describe("nearestPlayer", () => {
  const players: Player[] = [
    { id: "a", team: "attack", label: "A", pos: { x: 0.5, y: 0.5 } },
    { id: "b", team: "attack", label: "B", pos: { x: 0.52, y: 0.5 } },
    { id: "d", team: "defence", label: "D", pos: { x: 0.505, y: 0.5 } },
  ];

  it("finds the closest player within range", () => {
    expect(nearestPlayer(FULL, players, { x: 0.501, y: 0.5 }, 3)?.id).toBe("a");
  });

  it("respects the filter", () => {
    const attackers = (p: Player) => p.team === "attack";
    expect(nearestPlayer(FULL, players, { x: 0.506, y: 0.5 }, 3, attackers)?.id).toBe("a");
  });

  it("returns undefined when nobody is in range", () => {
    expect(nearestPlayer(FULL, players, { x: 0.1, y: 0.1 }, 3)).toBeUndefined();
  });
});
