# B-34 — Tennis Cross-Scenario Stability & Failure-Mode Clustering

## Purpose

B-34 moves robustness analysis from individual scenarios to the population level. Scenarios that fail through the same opponent response, counter-path, insufficient terminal support, or low-robustness condition are grouped into descriptive failure clusters.

## Flow

```text
SCENARIO POPULATION
  ↓
INDIVIDUAL WIN / FAILURE PATHS
  ↓
FAILURE SIGNATURE EXTRACTION
  ↓
CROSS-SCENARIO CLUSTERING
  ↓
RECURRING FAILURE MODES
  ↓
COACH REVIEW / FUTURE SEARCH SIGNAL
```

## Failure modes

- `opponent_response` — recurring opponent response associated with failed trajectories.
- `counter_path` — recurring counter-path signature.
- `insufficient_terminal_support` — the simulation did not produce enough terminal support to establish a meaningful win/failure path.
- `low_robustness` — a scenario is materially sensitive to the controlled perturbations from B-32.
- `simulation_budget` — reserved for future explicit budget diagnostics.
- `invalid_scenario` — scenario repair validation failed.

## Cross-scenario metrics

`crossScenarioFailureConcentration` measures how much of the observed failure evidence belongs to the largest cluster. It is descriptive, not a probability of failure in the real match.

`stableScenarioCount` counts candidates meeting the current perturbation-stability threshold when such a report exists.

## Boundary

This layer explains recurring failure signatures. It does not recommend a tactic, rank a coach's options, or convert simulation frequency into calibrated probability.

Observed evidence remains distinct from inferred and simulated evidence. No new player or opponent facts are created by clustering.

## Next

B-35 should expose these clusters to the scenario-search loop as explicit diversity/failure-avoidance signals, while retaining the requirement that the system present multiple plausible paths rather than automatically choosing one.
