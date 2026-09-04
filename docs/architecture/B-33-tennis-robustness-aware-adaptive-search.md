# B-33 — Tennis Robustness-Aware Adaptive Scenario Search

## Purpose

B-33 closes the loop between the adaptive scenario search and the perturbation robustness layer introduced in B-32.

The search engine may now evaluate each candidate against controlled changes to hypothetical response weights and, optionally, simulation budget. Robustness becomes an explicit search objective rather than a post-hoc metric.

## Flow

```text
CURRENT MATCH STATE
  ↓
MATCHUP MODEL
  ↓
SCENARIO POPULATION
  ↓
COUNTERFACTUAL STATE
  ↓
BASE SIMULATION
  ↓
PERTURB HYPOTHETICAL ASSUMPTIONS
  ↓
RE-SIMULATE
  ↓
ROBUSTNESS / SENSITIVITY
  ↓
MULTI-OBJECTIVE SCORE
  ↓
PARETO FRONT / ELITE / DIVERSITY
  ↓
CONSTRAINED VARIATION
```

## B-33 changes

- `TennisScenarioCandidate` can carry a `perturbationRobustness` report.
- `TennisScenarioSearchConfig.robustness.enabled` turns perturbation evaluation on.
- Response-weight perturbation magnitude is configurable.
- Simulation-budget perturbation is optional.
- The `robustness` objective uses perturbation stability when the robustness layer is enabled; otherwise it retains the intrinsic win-path robustness measure.
- Search provenance records whether robustness evaluation was enabled.
- Existing evidence remains attached to the scenario; perturbations do not create observed facts.

## Safety boundary

Robustness is a sensitivity measure. It is not a calibrated probability, forecast, recommendation, or coaching decision.

The search engine does not select an action for the coach. It produces a diverse set of evaluated hypothetical scenarios and preserves the Pareto/elite structure for downstream coach review.

## MDP-Adaptive-GA influence

The external MDP-Adaptive-GA reference contributes the architectural idea of adaptive search pressure, repair, elite preservation, and diversity preservation. The implementation remains domain-specific to tennis coaching scenarios and does not copy the external solver or treat its objective function as a sports model.

## Current limitations

- Perturbations currently target response weights and simulation budget; richer state/assumption perturbations should be added only when those assumptions are explicitly represented.
- The search still varies existing response weights conservatively rather than inventing new tactical interventions.
- Tennis serving/tiebreak rules remain intentionally narrower than a full official-rule engine.
- Robustness thresholds are engineering heuristics and require evaluation against real historical data before being treated as calibrated.

## Next layer

B-34 should introduce cross-scenario stability and failure-mode clustering so the system can distinguish scenarios that fail for the same structural reason from scenarios that fail under unrelated perturbations.
