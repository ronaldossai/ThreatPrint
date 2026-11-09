import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { DEFAULT_PITCH, clientToPitch, nudge, pitchOf, toMetres } from "../coords";
import { threatRgba } from "../heatmapColour";
import type { Pitch as PitchDims, Player, Pos, Scenario, ThreatGrid } from "../types";

// The SVG user space is in metres (origin: own goal line / top touchline),
// so pitch markings use real dimensions and conversion is a single scale.
// Sizes below are for a full-size pitch; overlays are multiplied by `uiScale`.
const MARGIN_M = 4;
const PLAYER_R = 1.3;
const BALL_R = 0.65;

/**
 * The SVG zooms to fit whatever pitch it shows, so a smaller pitch is drawn
 * larger. Shrinking markers, the ball and decorations by the same factor keeps
 * them the same size on screen as on a full-size pitch.
 */
function uiScale(pitch: PitchDims): number {
  return Math.max(pitch.lengthM / DEFAULT_PITCH.lengthM, pitch.widthM / DEFAULT_PITCH.widthM);
}

type DragTarget = { kind: "player"; id: string } | { kind: "ball" };

interface PitchProps {
  scenario: Scenario;
  grid: ThreatGrid | null;
  showHeatmap: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMovePlayer: (id: string, pos: Pos) => void;
  onMoveBall: (pos: Pos) => void;
  onDropBall: (pos: Pos) => void;
  onDragChange: (dragging: boolean) => void;
}

export function Pitch(props: PitchProps) {
  const { scenario, grid, showHeatmap, selectedId } = props;
  const pitch = pitchOf(scenario);
  const s = uiScale(pitch);
  const margin = MARGIN_M * s;
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  // Handlers read the latest props through a ref so they can stay referentially
  // stable, which lets memoised markers skip re-rendering while another one moves.
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  const drag = useRef<DragTarget | null>(null);
  // Pointer events can arrive faster than the display refreshes; apply at most one move per frame.
  const pendingPos = useRef<Pos | null>(null);
  const frame = useRef(0);

  const flushMove = useCallback(() => {
    frame.current = 0;
    const pos = pendingPos.current;
    const target = drag.current;
    pendingPos.current = null;
    if (!pos || !target) return;
    if (target.kind === "player") latest.current.onMovePlayer(target.id, pos);
    else latest.current.onMoveBall(pos);
  }, []);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const beginDrag = useCallback((target: DragTarget, e: PointerEvent<SVGGElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = target;
    setDragging(true);
    latest.current.onDragChange(true);
    if (target.kind === "player") latest.current.onSelect(target.id);
  }, []);

  const handleMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    pendingPos.current = clientToPitch(pitch, svgRef.current!, e.clientX, e.clientY);
    if (!frame.current) frame.current = requestAnimationFrame(flushMove);
  };

  const endDrag = (e: PointerEvent<SVGSVGElement>, cancelled: boolean) => {
    const target = drag.current;
    if (!target) return;
    cancelAnimationFrame(frame.current);
    flushMove();
    if (target.kind === "ball" && !cancelled) {
      latest.current.onDropBall(clientToPitch(pitch, svgRef.current!, e.clientX, e.clientY));
    }
    drag.current = null;
    setDragging(false);
    latest.current.onDragChange(false);
  };

  const handlePlayerDown = useCallback(
    (player: Player, e: PointerEvent<SVGGElement>) => beginDrag({ kind: "player", id: player.id }, e),
    [beginDrag],
  );

  const handlePlayerKey = useCallback((player: Player, e: KeyboardEvent<SVGGElement>) => {
    const step = e.shiftKey ? 2 : 0.5;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    latest.current.onMovePlayer(player.id, nudge(pitchOf(latest.current.scenario), player.pos, d[0], d[1]));
  }, []);

  const handlePlayerFocus = useCallback((player: Player) => latest.current.onSelect(player.id), []);

  const ball = toMetres(pitch, scenario.ball.pos);

  return (
    <svg
      ref={svgRef}
      className={`pitch${dragging ? " dragging" : ""}`}
      viewBox={`${-margin} ${-margin} ${pitch.lengthM + 2 * margin} ${pitch.widthM + 2 * margin}`}
      style={{ "--ui-scale": s } as CSSProperties}
      preserveAspectRatio="xMidYMid meet"
      onPointerMove={handleMove}
      onPointerUp={(e) => endDrag(e, false)}
      onPointerCancel={(e) => endDrag(e, true)}
      onPointerDown={() => props.onSelect(null)}
      role="application"
      aria-label="Pitch. Attacking left to right."
    >
      <rect className="pitch-surface" x={0} y={0} width={pitch.lengthM} height={pitch.widthM} />
      {showHeatmap && grid && <Heatmap pitch={pitch} grid={grid} />}
      <Markings pitch={pitch} scale={s} />
      <AttackArrow pitch={pitch} scale={s} />

      {scenario.players.map((p) => (
        <PlayerMarker
          key={p.id}
          pitch={pitch}
          scale={s}
          player={p}
          selected={p.id === selectedId}
          onPointerDown={handlePlayerDown}
          onKeyDown={handlePlayerKey}
          onFocus={handlePlayerFocus}
        />
      ))}

      <g
        className="ball"
        transform={`translate(${ball.x} ${ball.y}) scale(${s})`}
        onPointerDown={(e) => beginDrag({ kind: "ball" }, e)}
        aria-label="Ball"
      >
        <circle r={BALL_R} />
      </g>
    </svg>
  );
}

interface PlayerMarkerProps {
  pitch: PitchDims;
  scale: number;
  player: Player;
  selected: boolean;
  onPointerDown: (player: Player, e: PointerEvent<SVGGElement>) => void;
  onKeyDown: (player: Player, e: KeyboardEvent<SVGGElement>) => void;
  onFocus: (player: Player) => void;
}

const PlayerMarker = memo(function PlayerMarker({ pitch, scale, player, selected, onPointerDown, onKeyDown, onFocus }: PlayerMarkerProps) {
  const m = toMetres(pitch, player.pos);
  return (
    <g
      className={`player ${player.team}${selected ? " selected" : ""}`}
      transform={`translate(${m.x} ${m.y}) scale(${scale})`}
      onPointerDown={(e) => onPointerDown(player, e)}
      onKeyDown={(e) => onKeyDown(player, e)}
      onFocus={() => onFocus(player)}
      tabIndex={0}
      role="button"
      aria-label={`${player.label} (${player.team}). Arrow keys move; Shift for larger steps.`}
    >
      <circle r={PLAYER_R} />
      <text dy="0.05em">{player.label}</text>
    </g>
  );
});

// One raster image instead of thousands of translucent SVG rects: markers dragged
// over it no longer force the browser to re-composite every cell. Bilinear
// upscaling of the grid also gives a smoother field than hard-edged cells.
const Heatmap = memo(function Heatmap({ pitch, grid }: { pitch: PitchDims; grid: ThreatGrid }) {
  const href = useMemo(() => heatmapDataUrl(grid), [grid]);
  if (!href) return null;
  return (
    <image
      className="heatmap"
      href={href}
      x={0}
      y={0}
      width={pitch.lengthM}
      height={pitch.widthM}
      preserveAspectRatio="none"
      pointerEvents="none"
    />
  );
});

function heatmapDataUrl(grid: ThreatGrid): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = grid.cols;
  canvas.height = grid.rows;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(grid.cols, grid.rows);
  grid.values.forEach((v, i) => {
    const [r, g, b, a] = threatRgba(v);
    img.data.set([r, g, b, Math.round(a * 255)], i * 4);
  });
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

// Penalty areas and the centre circle use fixed regulation measurements, so
// they are only drawn where they fit. Small-sided pitches get the outline,
// halfway line and goals.
function hasFullSizeMarkings(pitch: PitchDims): boolean {
  // Minimum dimensions for a full-size pitch under the Laws of the Game.
  return pitch.lengthM >= 90 && pitch.widthM >= 45;
}

const Markings = memo(function Markings({ pitch, scale }: { pitch: PitchDims; scale: number }) {
  const { lengthM: L, widthM: W } = pitch;
  return (
    <g className="markings" pointerEvents="none">
      <rect x={0} y={0} width={L} height={W} />
      <line x1={L / 2} y1={0} x2={L / 2} y2={W} />
      <circle className="spot" cx={L / 2} cy={W / 2} r={0.3 * scale} />
      {hasFullSizeMarkings(pitch) && (
        <>
          <circle cx={L / 2} cy={W / 2} r={9.15} />
          <PenaltyEnd pitch={pitch} />
          <g transform={`translate(${L} 0) scale(-1 1)`}>
            <PenaltyEnd pitch={pitch} />
          </g>
        </>
      )}
      <Goal pitch={pitch} depth={2 * scale} />
      <g transform={`translate(${L} 0) scale(-1 1)`}>
        <Goal pitch={pitch} depth={2 * scale} />
      </g>
    </g>
  );
});

/** Markings for the left-hand end; mirrored for the right. */
function PenaltyEnd({ pitch }: { pitch: PitchDims }) {
  const cy = pitch.widthM / 2;
  // The penalty arc is the part of a 9.15 m circle around the spot (11 m) outside the box (16.5 m).
  const arcDy = Math.sqrt(9.15 ** 2 - 5.5 ** 2);
  return (
    <>
      <rect x={0} y={cy - 20.16} width={16.5} height={40.32} />
      <rect x={0} y={cy - 9.16} width={5.5} height={18.32} />
      <circle className="spot" cx={11} cy={cy} r={0.3} />
      <path d={`M 16.5 ${cy - arcDy} A 9.15 9.15 0 0 1 16.5 ${cy + arcDy}`} />
    </>
  );
}

/** The goal sits just behind the goal line. */
function Goal({ pitch, depth }: { pitch: PitchDims; depth: number }) {
  const top = (pitch.widthM - pitch.goalWidthM) / 2;
  return <rect className="goal" x={-depth} y={top} width={depth} height={pitch.goalWidthM} />;
}

const AttackArrow = memo(function AttackArrow({ pitch, scale }: { pitch: PitchDims; scale: number }) {
  const y = pitch.widthM + 2.2 * scale;
  return (
    <g className="attack-arrow" pointerEvents="none" transform={`translate(${pitch.lengthM / 2} ${y}) scale(${scale})`}>
      <line x1={-8} y1={0} x2={8} y2={0} />
      <path d="M 8 0 l -1.4 -0.9 v 1.8 z" />
      <text x={-9.5} y={0} textAnchor="end">
        Attacking
      </text>
    </g>
  );
});
