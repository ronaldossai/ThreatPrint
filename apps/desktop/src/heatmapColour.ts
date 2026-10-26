// Sequential single-hue ramp for the threat heatmap: transparent → amber → deep orange.
// Kept deliberately restrained so the heatmap does not imply more precision than the model has.

const STOPS: Array<[number, [number, number, number, number]]> = [
  [0.0, [255, 214, 102, 0.0]],
  [0.35, [255, 190, 60, 0.28]],
  [0.7, [245, 130, 32, 0.5]],
  [1.0, [200, 60, 20, 0.7]],
];

export function threatColour(v: number): string {
  const t = Math.min(1, Math.max(0, v));
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i];
    if (t <= t1) {
      const [t0, c0] = STOPS[i - 1];
      const k = (t - t0) / (t1 - t0);
      const [r, g, b, a] = c0.map((c, j) => c + (c1[j] - c) * k);
      return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(3)})`;
    }
  }
  return `rgba(${STOPS[STOPS.length - 1][1].join(", ")})`;
}

/** CSS gradient matching the ramp, for the legend. */
export const threatLegendGradient = `linear-gradient(to right, ${STOPS.map(
  ([t]) => `${threatColour(t)} ${t * 100}%`,
).join(", ")})`;
