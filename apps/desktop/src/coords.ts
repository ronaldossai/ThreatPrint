import type { Player, Pos } from "./types";

/** Pitch dimensions in metres. Must match `Pitch::default()` in the engine. */
export const PITCH = { lengthM: 105, widthM: 68, goalWidthM: 7.32 } as const;

export interface Metres {
  x: number;
  y: number;
}

export function toMetres(p: Pos): Metres {
  return { x: p.x * PITCH.lengthM, y: p.y * PITCH.widthM };
}

export function toNormalised(m: Metres): Pos {
  return { x: m.x / PITCH.lengthM, y: m.y / PITCH.widthM };
}

export function clampToPitch(p: Pos): Pos {
  return { x: clamp01(p.x), y: clamp01(p.y) };
}

export function distanceM(a: Pos, b: Pos): number {
  const ma = toMetres(a);
  const mb = toMetres(b);
  return Math.hypot(ma.x - mb.x, ma.y - mb.y);
}

/** Distance in metres to the centre of the goal being attacked. */
export function distanceToGoalM(p: Pos): number {
  return distanceM(p, { x: 1, y: 0.5 });
}

/** Move a normalised position by a displacement given in metres, staying on the pitch. */
export function nudge(p: Pos, dxM: number, dyM: number): Pos {
  const m = toMetres(p);
  return clampToPitch(toNormalised({ x: m.x + dxM, y: m.y + dyM }));
}

/** The closest player satisfying `filter` within `maxDistM` metres of `pos`, if any. */
export function nearestPlayer(
  players: Player[],
  pos: Pos,
  maxDistM: number,
  filter: (p: Player) => boolean = () => true,
): Player | undefined {
  let best: Player | undefined;
  let bestD = maxDistM;
  for (const p of players) {
    if (!filter(p)) continue;
    const d = distanceM(p.pos, pos);
    if (d <= bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

/** Convert a pointer's client coordinates to a normalised pitch position. */
export function clientToPitch(svg: SVGSVGElement, clientX: number, clientY: number): Pos {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0.5, y: 0.5 };
  const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return clampToPitch(toNormalised(pt));
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
