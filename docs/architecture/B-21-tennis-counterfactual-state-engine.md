# B-21 — Tennis Counterfactual State Engine

## Purpose

Represent a tactical scenario as a reproducible hypothetical version of the canonical tennis match state.

## Contract

`CANONICAL STATE + INTERVENTION + OPPONENT RESPONSE + COUNTER → HYPOTHETICAL STATE`

The engine increments the state version and preserves source evidence while placing hypothetical choices in an explicit `attributes.tacticalMode` namespace.

## Important boundary

The counterfactual state is **not an observed game state**. It does not mutate score, invent points, or claim that the intervention happened.

Observed facts remain canonical. Hypothetical tactical assumptions are isolated and provenance-tagged.

## Why this matters

This creates a clean handoff into simulation/search. A downstream simulator can consume a precise state version and scenario ID while knowing exactly which elements are real and which are hypothetical.

## Reproducibility

Every result retains:

- source state version
- scenario ID
- intervention
- opponent response
- counter path
- engine version
- evidence references

## Next

B-22 — Tennis Deterministic Simulation Kernel: branch counterfactual states into reproducible rally/point trajectories using seeded simulation configuration.
