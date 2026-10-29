import { describe, expect, it } from "vitest";
import { threatRgba } from "./heatmapColour";

describe("threatRgba", () => {
  it("is transparent at zero and most opaque at one", () => {
    expect(threatRgba(0)[3]).toBe(0);
    expect(threatRgba(1)[3]).toBeCloseTo(0.7);
  });

  it("clamps out-of-range values", () => {
    expect(threatRgba(-1)).toEqual(threatRgba(0));
    expect(threatRgba(2)).toEqual(threatRgba(1));
  });

  it("gets more opaque as threat rises", () => {
    const alphas = [0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => threatRgba(v)[3]);
    for (let i = 1; i < alphas.length; i++) expect(alphas[i]).toBeGreaterThan(alphas[i - 1]);
  });
});
