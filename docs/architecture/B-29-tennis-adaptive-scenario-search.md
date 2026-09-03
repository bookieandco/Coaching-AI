# B-29 — Tennis Adaptive Scenario Search

## Purpose
Translate the strongest ideas from adaptive genetic search into a coaching-safe scenario search layer.

The engine searches a **scenario frontier**, not a single optimum and not an automatic coaching recommendation.

## Translation

| Adaptive search idea | Coaching AI translation |
|---|---|
| Candidate population | Tactical scenario population |
| Fitness | Multi-objective scenario evidence |
| Repair | Structural scenario validity repair |
| Elite preservation | Preserve non-dominated scenarios |
| Diversity injection | Preserve distinct tactical signatures |
| Mutation/crossover | Future constrained scenario variation |

## Executable pipeline

`adaptive opponent state → scenario generation → structural validation → counterfactual state → deterministic simulation → win-path report → multi-objective scores → Pareto frontier → elite/diverse population`

The search layer consumes the existing canonical state and intelligence layers. It does not create a second game-state authority.

## Objectives

- win-path support
- failure avoidance
- robustness
- evidence strength
- tactical diversity

Objectives remain separate. Pareto dominance is preferred to collapsing everything into one opaque score.

## Structural repair boundary

Repair currently acts as validation metadata. Invalid source state versions, missing actors/responses, orphan counters, or non-positive response weights make a candidate invalid rather than silently fabricating a fix.

Future repair operators may normalize safe structural fields, but they must never invent evidence, tactical facts, player abilities, or opponent tendencies.

## Determinism

Scenario evaluation derives simulation seeds from the configured seed, generation, and scenario identity. Candidate ordering and signature filtering are deterministic. The simulation layer remains responsible for reproducible point-level trajectories.

## Evidence boundary

Simulation outputs remain simulated. Observations remain observed. Inferred matchup features remain inferences. A scenario is hypothetical until tested against real observations.

## Current implementation

`adaptive-scenario-search.ts` now executes the B-29 single-generation population pass over the existing tennis stack. It evaluates generated tactical scenarios through counterfactual state construction, simulation, and win-path classification; computes independent objective scores; and returns a Pareto frontier plus elite/diverse candidates.

`maxGenerations` is retained in the contract but the generation count is intentionally one for B-29. Multi-generation constrained variation is B-30.

## Next

B-30 adds deterministic scenario variation operators and a bounded generation loop while preserving the same evidence, provenance, and non-recommendation boundaries.
