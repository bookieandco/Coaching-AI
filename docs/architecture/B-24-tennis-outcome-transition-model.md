# B-24 — Tennis Outcome Transition Model

## Purpose

Separate tennis score-state transitions from the model that selects a point winner.

## Contract

`OUTCOME SELECTION → APPLY POINT → GAME → SET → MATCH`

The transition function consumes an already-selected point winner and delegates scoring to the canonical tennis scoring module.

## Important boundary

The transition function does **not** claim that its weights are calibrated probabilities. The heuristic builder exposes relative sampling weights and uncertainty only. A production outcome model must be trained and evaluated against observed point-level data before its outputs are presented as probabilities.

## State integrity

Canonical participants, score, set completion, and state-version semantics remain owned by the tennis adapter/scoring layer. Outcome modeling does not rewrite observed facts.

## Current scope

- server/receiver point labels
- canonical point application
- game/set/match transition flags
- uncertainty propagation
- evidence propagation
- explicit heuristic relative weights

## Next

Harden tennis scoring invariants and then upgrade B-22 to use this transition contract for reproducible point-level trajectories.
