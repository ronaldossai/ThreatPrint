import { useEffect, useReducer, useRef, useState } from "react";
import wingerReceiving from "../../../fixtures/scenarios/winger-receiving.json";
import { Pitch } from "./components/Pitch";
import { distanceToGoalM, toMetres } from "./coords";
import { engineAvailable, fetchLocationThreat, fetchThreatGrid } from "./engine";
import { threatLegendGradient } from "./heatmapColour";
import { scenarioReducer } from "./scenarioState";
import type { Player, Scenario, ThreatGrid } from "./types";

const INITIAL = wingerReceiving as Scenario;
// 1.25 m cells: fine enough to read, cheap enough to render as SVG.
const GRID_COLS = 84;
const GRID_ROWS = 54;

export default function App() {
  const [scenario, dispatch] = useReducer(scenarioReducer, INITIAL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [grid, setGrid] = useState<ThreatGrid | null>(null);
  const [ballThreat, setBallThreat] = useState<number | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);

  useEffect(() => {
    if (!engineAvailable) return;
    fetchThreatGrid(GRID_COLS, GRID_ROWS).then(setGrid, (e) => setEngineError(String(e)));
  }, []);

  // Latest-wins: ignore responses that arrive after a newer request was sent.
  const requestSeq = useRef(0);
  const ballPos = scenario.ball.pos;
  useEffect(() => {
    if (!engineAvailable) return;
    const seq = ++requestSeq.current;
    fetchLocationThreat(ballPos).then(
      (v) => seq === requestSeq.current && setBallThreat(v),
      (e) => setEngineError(String(e)),
    );
  }, [ballPos]);

  const selected = scenario.players.find((p) => p.id === selectedId) ?? null;
  const owner = scenario.players.find((p) => p.id === scenario.ball.owner) ?? null;

  return (
    <div className="app">
      <header className="toolbar">
        <h1>ThreatPrint</h1>
        <span className="scenario-name">{scenario.name}</span>
        <div className="spacer" />
        <label className="toggle">
          <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} />
          Threat heatmap
        </label>
        <button
          onClick={() => {
            dispatch({ type: "load", scenario: INITIAL });
            setSelectedId(null);
          }}
        >
          Reset
        </button>
      </header>

      {!engineAvailable && (
        <div className="banner">
          Simulation engine not connected: this is the browser preview. Run <code>npm run app</code> for the desktop app.
        </div>
      )}
      {engineError && <div className="banner error">Engine error: {engineError}</div>}

      <main className="workspace">
        <section className="pitch-area">
          <Pitch
            scenario={scenario}
            grid={grid}
            showHeatmap={showHeatmap}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMovePlayer={(id, pos) => dispatch({ type: "movePlayer", id, pos })}
            onMoveBall={(pos) => dispatch({ type: "moveBall", pos })}
            onDropBall={(pos) => dispatch({ type: "dropBall", pos })}
          />
          {showHeatmap && (
            <div className="legend" aria-label="Heatmap legend">
              <span>Lower</span>
              <div className="legend-bar" style={{ background: threatLegendGradient }} />
              <span>Higher baseline threat</span>
            </div>
          )}
        </section>

        <aside className="panel">
          <section>
            <h2>Ball</h2>
            <dl>
              <dt>In possession</dt>
              <dd>{owner ? owner.label : "Loose"}</dd>
              <dt>Distance to goal</dt>
              <dd>{distanceToGoalM(scenario.ball.pos).toFixed(0)} m</dd>
              <dt>Baseline threat</dt>
              <dd>
                {ballThreat === null ? "—" : ballThreat.toFixed(2)}
                {ballThreat !== null && <Meter value={ballThreat} />}
              </dd>
            </dl>
          </section>

          <section>
            <h2>Selected player</h2>
            {selected ? <PlayerDetails player={selected} /> : <p className="muted">Click or tab to a player.</p>}
          </section>

          <section>
            <h2>Players</h2>
            <ul className="roster">
              {scenario.players.map((p) => (
                <li key={p.id}>
                  <button
                    className={`roster-item ${p.team}${p.id === selectedId ? " selected" : ""}`}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <span className="dot" />
                    {p.label}
                    <span className="muted">{p.team === "attack" ? "In possession" : "Defending"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="model-note">
            <h2>About this value</h2>
            <p>
              Baseline threat depends on <strong>location only</strong>, using goal-mouth angle and distance to
              goal. It ignores every player. It is a hand-tuned heuristic, not a fitted or validated xT model. Use
              it to compare locations, not as a probability.
            </p>
          </section>
        </aside>
      </main>
    </div>
  );
}

function PlayerDetails({ player }: { player: Player }) {
  const m = toMetres(player.pos);
  return (
    <dl>
      <dt>Role</dt>
      <dd>
        {player.label} · {player.team === "attack" ? "in possession" : "defending"}
      </dd>
      <dt>Position</dt>
      <dd>
        {m.x.toFixed(1)} m upfield, {m.y.toFixed(1)} m from top touchline
      </dd>
      <dt>Distance to goal</dt>
      <dd>{distanceToGoalM(player.pos).toFixed(0)} m</dd>
    </dl>
  );
}

function Meter({ value }: { value: number }) {
  return (
    <span className="meter" aria-hidden>
      <span style={{ width: `${Math.round(value * 100)}%` }} />
    </span>
  );
}
