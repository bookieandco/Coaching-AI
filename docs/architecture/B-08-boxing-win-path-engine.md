# B-08 — Boxing Win-Path Engine

## Purpose

Convert deterministic simulation trajectories into explicit win paths, failure paths, and neutral paths that a coach can inspect. The engine evaluates simulated branches; it does not recommend a tactic and does not replace the prediction model.

## Contract

`GameState + CoachingScenario + SimulationResult -> WinPathReport`

Each path preserves:

- scenario ID
- terminal reason
- winner identity when available
- empirical simulation frequency
- robustness
- key state transitions
- evidence references
- simulation seed/config provenance

## Semantic boundary

- Prediction estimates likely outcomes from a baseline model.
- Scenario defines an intervention and explicit assumptions.
- Simulation samples possible trajectories under that scenario.
- Win-path analysis groups and evaluates those trajectories.
- Coach decides whether a path is tactically useful.

The engine must never label a simulated frequency as a calibrated real-world probability unless the upstream simulation/model contract explicitly establishes calibration.

## Path classes

### Win path

The controlled participant is the terminal winner.

### Failure path

The opponent is the terminal winner, or the trajectory explicitly terminates in a loss condition.

### Neutral path

No winner is established, such as an incomplete or unresolved trajectory.

## Robustness

Robustness measures how consistently a path appears across simulated trajectories. The initial implementation uses trajectory-shape variability as a conservative proxy. Later versions should incorporate perturbation tests, model disagreement, evidence quality, and parameter sensitivity.

## Future extensions

- transition-level bottleneck detection
- path clustering independent of exact event IDs
- damage/fatigue-aware robustness
- round scoring and judging-aware terminal states
- adversarial response perturbations
- cross-seed stability testing
- coach-selected objective weighting
