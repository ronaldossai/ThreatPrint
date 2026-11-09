import type { Pitch, Player, Pos, Scenario } from "./types";

/** Full-size pitch in metres. Must match `Pitch::default()` in the engine. */
export const DEFAULT_PITCH: Pitch = { lengthM: 105, widthM: 68, goalWidthM: 7.32 };

export function pitchOf(scenario: Scenario): Pitch {
  return scenario.pitch ?? DEFAULT_PITCH;
}

export interface Metres {
  x: number;
  y: number;
}

export function toMetres(pitch: Pitch, p: Pos): Metres {
  return { x: p.x * pitch.lengthM, y: p.y * pitch.widthM };
}

export function toNormalised(pitch: Pitch, m: Metres): Pos {
  return { x: m.x / pitch.lengthM, y: m.y / pitch.widthM };
}

export function clampToPitch(p: Pos): Pos {
  return { x: clamp01(p.x), y: clamp01(p.y) };
}

export function distanceM(pitch: Pitch, a: Pos, b: Pos): number {
  const ma = toMetres(pitch, a);
  const mb = toMetres(pitch, b);
  return Math.hypot(ma.x - mb.x, ma.y - mb.y);
}

/** Distance in metres to the centre of the goal being attacked. */
export function distanceToGoalM(pitch: Pitch, p: Pos): number {
  return distanceM(pitch, p, { x: 1, y: 0.5 });
}

/** Move a normalised position by a displacement given in metres, staying on the pitch. */
export function nudge(pitch: Pitch, p: Pos, dxM: number, dyM: number): Pos {
  const m = toMetres(pitch, p);
  return clampToPitch(toNormalised(pitch, { x: m.x + dxM, y: m.y + dyM }));
}

/** The closest player satisfying `filter` within `maxDistM` metres of `pos`, if any. */
export function nearestPlayer(
  pitch: Pitch,
  players: Player[],
  pos: Pos,
  maxDistM: number,
  filter: (p: Player) => boolean = () => true,
): Player | undefined {
  let best: Player | undefined;
  let bestD = maxDistM;
  for (const p of players) {
    if (!filter(p)) continue;
    const d = distanceM(pitch, p.pos, pos);
    if (d <= bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

/** Convert a pointer's client coordinates to a normalised pitch position. */
export function clientToPitch(pitch: Pitch, svg: SVGSVGElement, clientX: number, clientY: number): Pos {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0.5, y: 0.5 };
  const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return clampToPitch(toNormalised(pitch, pt));
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
