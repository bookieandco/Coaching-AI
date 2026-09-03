# B-23 — Tennis Win-Path Engine

## Purpose

Aggregate deterministic simulation branches into explicit path records while refusing to manufacture outcome probabilities before the tennis transition model is validated.

## Path contract

`SIMULATED TRAJECTORIES → PATH GROUPS → COVERAGE + ROBUSTNESS + UNCERTAINTY`

Each path preserves its scenario, response, counter, frequency, and evidence references.

## Current safety boundary

The current B-22 kernel only simulates tactical branch selection. Therefore B-23 classifies every generated branch as `neutral_path`.

This is intentional. A branch cannot become a win path simply because a scenario was selected. Win/failure classification requires a validated state-transition model capable of producing point, game, set, and match outcomes.

## Robustness

Current robustness is branch frequency within the generated sample. It is not a claim that a path is strategically superior.

Future robustness should include:

- cross-seed stability
- perturbation tests
- score-state sensitivity
- player fatigue/readiness
- surface effects
- opponent adaptation
- outcome-model uncertainty

## Next

B-24 — Tennis Outcome Transition Model: introduce validated point-level transition primitives so simulations can progress from tactical branches into actual score/state trajectories.
