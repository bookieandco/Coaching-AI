# B-45 — Tennis Scenario Exploration Bridge

## Purpose

B-45 connects the universal `ScenarioExplorationService` contract to the existing Tennis intelligence stack.

The bridge deliberately reuses the Tennis engines already built instead of creating a second scenario simulator:

```text
Universal ScenarioExplorationRequest
        ↓
Tennis Scenario Exploration Bridge
        ↓
Adaptive Scenario Search
        ↓
Counterfactual State
        ↓
Deterministic Simulation
        ↓
Win-Path Analysis
        ↓
Perturbation Robustness / Failure Awareness
        ↓
Universal ScenarioEvaluation
        ↓
Pareto Scenario IDs
```

## Contract boundary

The universal service accepts a canonical `GameState`, scenario candidates, state signature, and deterministic seeds. The Tennis bridge adapts the canonical state to `TennisMatchState` and injects the already-built Tennis matchup/adaptive context through its service configuration.

The result exposes:

- simulation outcomes;
- multidimensional evaluation scores;
- evidence references;
- Pareto scenario identifiers;
- deterministic seed provenance;
- state-signature provenance;
- `humanDecisionRequired: true`.

## Candidate semantics

Tennis scenario assumptions come from the intervention itself. They are not fabricated by the universal layer. Tennis interventions already carry their objective, assumptions, and evidence references.

## Safety boundary

The bridge does not:

- choose a tactic for the coach;
- execute an intervention;
- emit an instruction to a player;
- mutate the canonical game state;
- convert a Pareto frontier into a recommendation.

The Pareto set is an exploration result. Coach authority remains outside the intelligence service.

## Reproducibility

The bridge records the requested state signature and simulation seed. The underlying Tennis search already carries model version, generation count, simulation budget, robustness configuration, failure-aware configuration, evidence, and scenario lineage.

## Current limitation

The universal request currently carries generic scenario candidates, while Tennis generates its own tactical population. If requested IDs are supplied, the bridge filters the generated frontier to matching IDs. If no requested candidate survives that filter, it returns the generated frontier rather than silently returning an empty exploration.

Future hardening should make the candidate-generation handoff explicit so a coach query can request a constrained Tennis scenario family without relying on post-generation filtering.
