# Model notes

Everything ThreatPrint computes today is a **hand-designed heuristic**. None of it
is fitted to data or validated against match outcomes. Read scores as relative
comparisons under a fixed set of assumptions, not as probabilities.

## Coordinate system

Defined in `crates/simulation/src/geometry.rs`, and mirrored in `apps/desktop/src/coords.ts`.

| Axis | Range | 0 | 1 |
|------|-------|---|---|
| `x`  | `[0, 1]` | own goal line | goal line being attacked |
| `y`  | `[0, 1]` | top touchline | bottom touchline |

- The team in possession **always attacks toward `+x`**, which the UI shows as left to right.
- Pitch: 105 m × 68 m, goal 7.32 m wide (`Pitch::default()`).
- Geometry is computed in metres with the origin at the own-goal-line / top-touchline corner.
- The UI's SVG user space is also in metres, so screen ↔ pitch conversion is a single scale step.

## Baseline spatial threat (`threat.rs`)

This is the danger of holding the ball at a location, **ignoring all players**:

```
threat = angle_weight    · min(1, goal_mouth_angle / reference_angle)
       + distance_weight · exp(−distance_to_goal_centre / distance_decay_m)
```

| Parameter | Default | Meaning |
|-----------|---------|---------|
| `angle_weight` | 0.6 | Contribution of how much of the goal is visible |
| `distance_weight` | 0.4 | Contribution of raw proximity |
| `reference_angle_rad` | 0.642 | Goal-mouth angle from the penalty spot. The angle term saturates here. |
| `distance_decay_m` | 18 | Proximity falls by a factor of *e* every 18 m |

Properties covered by tests:

- The value lies in `[0, 1]` everywhere on the pitch.
- It strictly increases toward goal along the centre line.
- It is higher centrally than wide at the same depth.
- It is symmetric about the long axis.
- It is 0 beyond the goal line.
- It is deterministic.

Known limitations:

- The model ignores defenders, teammates, pressure, body orientation and passing options.
- The angle term saturates inside roughly the penalty spot distance, so locations deep in the six-yard box differ only through proximity.
- The weights are chosen by eye. They have no empirical basis.

## Planned next layers

These are not implemented yet.

1. Defensive influence fields and pressure on the ball carrier.
2. Passing-lane availability, including lanes blocked by defenders.
3. Candidate actions (carry, pass, through ball, recycle). Each produces a resulting state, a score and a factor breakdown.
4. Comparisons between actions from the same state, plus a small set of configurable defensive responses.
