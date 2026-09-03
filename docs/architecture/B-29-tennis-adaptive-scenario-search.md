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

## Objectives

- win-path support
- failure avoidance
- robustness
- evidence strength
- tactical diversity

Objectives remain separate. Pareto dominance is preferred to collapsing everything into one opaque score.

## Safety boundary

Repair may fix structure such as invalid weights or orphan counter references. It must never invent evidence, tactical facts, player abilities, or opponent tendencies.

Simulation outputs remain simulated. Observations remain observed. A scenario is hypothetical until tested.

## Current implementation

`adaptive-scenario-search.ts` provides the objective/config/result contracts plus deterministic Pareto, elite-preservation, diversity-signature, and structural-repair primitives.

The next increment wires the search primitives into the full tennis pipeline: adaptive opponent state → scenario generation → counterfactual → simulation → win paths → frontier.
