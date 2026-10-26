import { memo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { PITCH, clientToPitch, nudge, toMetres } from "../coords";
import { threatColour } from "../heatmapColour";
import type { Player, Pos, Scenario, ThreatGrid } from "../types";

// The SVG user space is in metres (origin: own goal line / top touchline),
// so pitch markings use real dimensions and conversion is a single scale.
const MARGIN_M = 4;
const PLAYER_R = 1.3;
const BALL_R = 0.65;

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
}

export function Pitch(props: PitchProps) {
  const { scenario, grid, showHeatmap, selectedId, onSelect } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragTarget | null>(null);

  const posFromEvent = (e: PointerEvent) => clientToPitch(svgRef.current!, e.clientX, e.clientY);

  const startDrag = (target: DragTarget) => (e: PointerEvent<SVGGElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(target);
    if (target.kind === "player") onSelect(target.id);
  };

  const handleMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const pos = posFromEvent(e);
    if (drag.kind === "player") props.onMovePlayer(drag.id, pos);
    else props.onMoveBall(pos);
  };

  const handleUp = (e: PointerEvent<SVGSVGElement>) => {
    if (drag?.kind === "ball") props.onDropBall(posFromEvent(e));
    setDrag(null);
  };

  const handlePlayerKey = (player: Player) => (e: KeyboardEvent<SVGGElement>) => {
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
    props.onMovePlayer(player.id, nudge(player.pos, d[0], d[1]));
  };

  const ball = toMetres(scenario.ball.pos);

  return (
    <svg
      ref={svgRef}
      className={`pitch${drag ? " dragging" : ""}`}
      viewBox={`${-MARGIN_M} ${-MARGIN_M} ${PITCH.lengthM + 2 * MARGIN_M} ${PITCH.widthM + 2 * MARGIN_M}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={() => setDrag(null)}
      onPointerDown={() => onSelect(null)}
      role="application"
      aria-label="Pitch. Attacking left to right."
    >
      <rect className="pitch-surface" x={0} y={0} width={PITCH.lengthM} height={PITCH.widthM} />
      {showHeatmap && grid && <Heatmap grid={grid} />}
      <Markings />
      <AttackArrow />

      {scenario.players.map((p) => {
        const m = toMetres(p.pos);
        return (
          <g
            key={p.id}
            className={`player ${p.team}${p.id === selectedId ? " selected" : ""}`}
            transform={`translate(${m.x} ${m.y})`}
            onPointerDown={startDrag({ kind: "player", id: p.id })}
            onKeyDown={handlePlayerKey(p)}
            onFocus={() => onSelect(p.id)}
            tabIndex={0}
            role="button"
            aria-label={`${p.label} (${p.team}). Arrow keys move; Shift for larger steps.`}
          >
            <circle r={PLAYER_R} />
            <text dy="0.05em">{p.label}</text>
          </g>
        );
      })}

      <g
        className="ball"
        transform={`translate(${ball.x} ${ball.y})`}
        onPointerDown={startDrag({ kind: "ball" })}
        aria-label="Ball"
      >
        <circle r={BALL_R} />
      </g>
    </svg>
  );
}

// The grid only changes when the model does, so avoid re-rendering thousands of rects on every drag.
const Heatmap = memo(function Heatmap({ grid }: { grid: ThreatGrid }) {
  const w = PITCH.lengthM / grid.cols;
  const h = PITCH.widthM / grid.rows;
  const cells = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const v = grid.values[row * grid.cols + col];
      // Slight overlap hides hairline seams between cells.
      cells.push(
        <rect key={row * grid.cols + col} x={col * w} y={row * h} width={w + 0.05} height={h + 0.05} fill={threatColour(v)} />,
      );
    }
  }
  return (
    <g className="heatmap" shapeRendering="crispEdges" pointerEvents="none">
      {cells}
    </g>
  );
});

const Markings = memo(function Markings() {
  const { lengthM: L, widthM: W } = PITCH;
  return (
    <g className="markings" pointerEvents="none">
      <rect x={0} y={0} width={L} height={W} />
      <line x1={L / 2} y1={0} x2={L / 2} y2={W} />
      <circle cx={L / 2} cy={W / 2} r={9.15} />
      <circle className="spot" cx={L / 2} cy={W / 2} r={0.3} />
      <PenaltyEnd />
      <g transform={`translate(${L} 0) scale(-1 1)`}>
        <PenaltyEnd />
      </g>
    </g>
  );
});

/** Markings for the left-hand end; mirrored for the right. */
function PenaltyEnd() {
  const cy = PITCH.widthM / 2;
  const halfGoal = PITCH.goalWidthM / 2;
  // The penalty arc is the part of a 9.15 m circle around the spot (11 m) outside the box (16.5 m).
  const arcDy = Math.sqrt(9.15 ** 2 - 5.5 ** 2);
  return (
    <>
      <rect x={0} y={cy - 20.16} width={16.5} height={40.32} />
      <rect x={0} y={cy - 9.16} width={5.5} height={18.32} />
      <circle className="spot" cx={11} cy={cy} r={0.3} />
      <path d={`M 16.5 ${cy - arcDy} A 9.15 9.15 0 0 1 16.5 ${cy + arcDy}`} />
      <rect className="goal" x={-2} y={cy - halfGoal} width={2} height={PITCH.goalWidthM} />
    </>
  );
}

function AttackArrow() {
  const y = PITCH.widthM + 2.2;
  return (
    <g className="attack-arrow" pointerEvents="none">
      <line x1={PITCH.lengthM / 2 - 8} y1={y} x2={PITCH.lengthM / 2 + 8} y2={y} />
      <path d={`M ${PITCH.lengthM / 2 + 8} ${y} l -1.4 -0.9 v 1.8 z`} />
      <text x={PITCH.lengthM / 2 - 9.5} y={y} textAnchor="end">
        Attacking
      </text>
    </g>
  );
}
