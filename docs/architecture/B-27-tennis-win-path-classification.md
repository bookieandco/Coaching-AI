# B-27 — Tennis Win-Path Classification

## Purpose

Turn completed deterministic tennis simulation trajectories into explicit coaching-path classes without confusing branch frequency with calibrated probability.

## Classification boundary

`MATCH TERMINAL + actor has more sets` → `WIN_PATH`

`MATCH TERMINAL + actor has fewer sets` → `FAILURE_PATH`

`POINT / GAME / SET TERMINAL or insufficient score evidence` → `NEUTRAL_PATH`

This keeps partial trajectories from being mislabeled as wins or losses.

## Path aggregation

Paths are grouped by:

- classification
- opponent response
- counter-path

Each path exposes normalized simulation frequency and a conservative branch-support robustness score.

## Safety boundary

The engine does not:

- claim calibrated win probability
- rank a coaching decision
- recommend an intervention
- convert simulated frequency into certainty

## Next

B-28 — Tennis Adaptive Opponent Engine: update response weights from observed point/rally evidence and feed those adaptations back into scenario simulation.
