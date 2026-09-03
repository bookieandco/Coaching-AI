# B-07 — Boxing Deterministic Simulation Kernel

## Purpose

B-07 converts an explicit boxing counterfactual branch into reproducible simulated trajectories. It is a simulation layer, not a prediction model and not a coaching recommendation engine.

## Inputs

- canonical or counterfactual `GameState`
- `BoxingIntervention`
- `BoxingResponseChain`
- model version
- ruleset version
- evidence-set version
- simulation count
- maximum steps
- step duration
- explicit integer seed

## Execution model

```text
CURRENT STATE
  ↓
INTERVENTION
  ↓
OPPONENT RESPONSE WEIGHT
  ↓
OPTIONAL COUNTER BRANCH
  ↓
COUNTERFACTUAL STATE
  ↓
CLOCK / STATE ADVANCE
  ↓
NEXT STEP
  ↓
TRAJECTORY
  ↓
DISTRIBUTION
```

The response-chain `probability` field is deliberately treated as a normalized **sampling weight**. The kernel does not convert it into a claim about calibrated real-world likelihood.

## Determinism contract

The same:

- initial state version
- scenario ID
- intervention
- response chain
- simulation configuration
- model version
- ruleset version
- evidence-set version
- seed

must produce the same trajectory sequence and aggregate counts.

Each trajectory receives a derived seed from the root seed and simulation index. A small deterministic PRNG is used so the kernel does not depend on platform-specific random behavior.

## Trajectory model

Each step records:

- step number
- state version
- elapsed simulation time
- branch ID
- selected response ID
- optional counter ID
- response sampling weight
- resulting state
- state deltas

The trajectory also records terminal status and a normalized outcome reason.

## Reference implementation lessons

The open-source `boxing-simulator` project is useful as a reference for round/exchange-oriented simulation, punch accounting, damage, conditioning, play-by-play, and derived fight statistics. Those concepts belong downstream of the canonical event/state model in Coaching AI. They must not become competing sources of truth.

## Current scope

B-07 intentionally provides the deterministic branching/replay substrate first. It does **not** yet claim a physically or statistically calibrated boxing simulator. Damage, fatigue, distance, pace, punch selection, judging, knockdown probability, and richer round transitions should become explicit transition models in subsequent milestones.

## Next extension

B-08 should consume these trajectories to compute explicit win paths, failure paths, robustness, and scenario-level evidence summaries without collapsing simulation into prediction.
