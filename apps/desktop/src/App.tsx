import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Pitch } from "./components/Pitch";
import { distanceToGoalM, pitchOf, toMetres } from "./coords";
import { engineAvailable, fetchLocationThreat, fetchThreatGrid } from "./engine";
import { threatLegendGradient } from "./heatmapColour";
import { scenarioReducer } from "./scenarioState";
import { DEFAULT_TEMPLATE, TEMPLATES, templateById } from "./templates";
import type { Pitch as PitchDims, Player, Pos, ThreatGrid } from "./types";

// Heatmap cell size, upscaled smoothly as a single image. 84 × 54 cells on a full-size pitch.
const GRID_CELL_M = 1.25;

export default function App() {
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE.id);
  const [scenario, dispatch] = useReducer(scenarioReducer, DEFAULT_TEMPLATE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [grid, setGrid] = useState<ThreatGrid | null>(null);
  const [ballThreat, setBallThreat] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);

  // The pitch only changes when a different scenario is loaded, so this doesn't refetch while dragging.
  const pitch = pitchOf(scenario);
  useEffect(() => {
    if (!engineAvailable) return;
    let current = true;
    setGrid(null);
    const cols = Math.max(1, Math.round(pitch.lengthM / GRID_CELL_M));
    const rows = Math.max(1, Math.round(pitch.widthM / GRID_CELL_M));
    fetchThreatGrid(pitch, cols, rows).then(
      (g) => current && setGrid(g),
      (e) => setEngineError(String(e)),
    );
    return () => {
      current = false;
    };
  }, [pitch]);

  // Evaluate when a drag ends rather than on every frame of it.
  // Latest-wins: ignore responses that arrive after a newer request was sent.
  const requestSeq = useRef(0);
  const ballPos = scenario.ball.pos;
  useEffect(() => {
    if (!engineAvailable || dragging) return;
    const seq = ++requestSeq.current;
    fetchLocationThreat(pitch, ballPos).then(
      (v) => seq === requestSeq.current && setBallThreat(v),
      (e) => setEngineError(String(e)),
    );
  }, [pitch, ballPos, dragging]);

  const loadTemplate = (id: string) => {
    const template = templateById(id);
    if (!template) return;
    setTemplateId(id);
    dispatch({ type: "load", scenario: template });
    setSelectedId(null);
  };

  const onMovePlayer = useCallback((id: string, pos: Pos) => dispatch({ type: "movePlayer", id, pos }), []);
  const onMoveBall = useCallback((pos: Pos) => dispatch({ type: "moveBall", pos }), []);
  const onDropBall = useCallback((pos: Pos) => dispatch({ type: "dropBall", pos }), []);

  const selected = scenario.players.find((p) => p.id === selectedId) ?? null;
  const owner = scenario.players.find((p) => p.id === scenario.ball.owner) ?? null;

  return (
    <div className="app">
      <header className="toolbar">
        <h1>ThreatPrint</h1>
        <label className="template-picker">
          <span className="muted">Scenario</span>
          <select value={templateId} onChange={(e) => loadTemplate(e.target.value)}>
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <div className="spacer" />
        <label className="toggle">
          <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} />
          Threat heatmap
        </label>
        <button onClick={() => loadTemplate(templateId)}>Reset</button>
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
            onMovePlayer={onMovePlayer}
            onMoveBall={onMoveBall}
            onDropBall={onDropBall}
            onDragChange={setDragging}
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
            <h2>Scenario</h2>
            <p className="scenario-description">{scenario.description}</p>
            {scenario.tags && scenario.tags.length > 0 && (
              <ul className="tags">
                {scenario.tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>Ball</h2>
            <dl>
              <dt>In possession</dt>
              <dd>{owner ? owner.label : "Loose"}</dd>
              <dt>Distance to goal</dt>
              <dd>{distanceToGoalM(pitch, scenario.ball.pos).toFixed(0)} m</dd>
              <dt>Baseline threat</dt>
              <dd className={dragging ? "stale" : undefined} title={dragging ? "Updates when you release" : undefined}>
                {ballThreat === null ? "—" : ballThreat.toFixed(2)}
                {ballThreat !== null && <Meter value={ballThreat} />}
              </dd>
            </dl>
          </section>

          <section>
            <h2>Selected player</h2>
            {selected ? <PlayerDetails pitch={pitch} player={selected} /> : <p className="muted">Click or tab to a player.</p>}
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

function PlayerDetails({ pitch, player }: { pitch: PitchDims; player: Player }) {
  const m = toMetres(pitch, player.pos);
  return (
    <dl>
      <dt>Role</dt>
      <dd>
        {player.label} · {player.team === "attack" ? "in possession" : "defending"}
      </dd>
      <dt>Position</dt>
      <dd>
        {m.x.toFixed(1)} m upfield, {m.y.toFixed(1)} m from left touchline
      </dd>
      <dt>Distance to goal</dt>
      <dd>{distanceToGoalM(pitch, player.pos).toFixed(0)} m</dd>
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
