// Sequential single-hue ramp for the threat heatmap: transparent → amber → deep orange.
// Kept deliberately restrained so the heatmap does not imply more precision than the model has.

export type Rgba = [r: number, g: number, b: number, a: number];

const STOPS: Array<[number, Rgba]> = [
  [0.0, [255, 214, 102, 0.0]],
  [0.35, [255, 190, 60, 0.28]],
  [0.7, [245, 130, 32, 0.5]],
  [1.0, [200, 60, 20, 0.7]],
];

/** Ramp colour for `v` (clamped to [0, 1]); channels 0–255, alpha 0–1. */
export function threatRgba(v: number): Rgba {
  const t = Math.min(1, Math.max(0, v));
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i];
    if (t <= t1) {
      const [t0, c0] = STOPS[i - 1];
      const k = (t - t0) / (t1 - t0);
      return c0.map((c, j) => c + (c1[j] - c) * k) as Rgba;
    }
  }
  return STOPS[STOPS.length - 1][1];
}

export function threatColour(v: number): string {
  const [r, g, b, a] = threatRgba(v);
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(3)})`;
}

/** CSS gradient matching the ramp, for the legend. */
export const threatLegendGradient = `linear-gradient(to right, ${STOPS.map(
  ([t]) => `${threatColour(t)} ${t * 100}%`,
).join(", ")})`;
