# B-32 — Tennis Perturbation Robustness

## Objective

B-31 tested whether a scenario's simulated win-path coverage remains stable across independent random seeds. B-32 adds controlled perturbation testing: change hypothetical response weights or simulation budget and measure how much the scenario's simulated win-path coverage moves.

This is a sensitivity layer, not a prediction layer.

## Contract

```text
CANONICAL MATCH STATE
        ↓
HYPOTHETICAL COUNTERFACTUAL STATE
        ↓
BASE SCENARIO
        ↓
CONTROLLED PERTURBATION
        ↓
DETERMINISTIC SIMULATION
        ↓
WIN-PATH REPORT
        ↓
SENSITIVITY / STABILITY
```

Observed facts are never rewritten by perturbation.

## Perturbations

### Response-weight perturbation

For each explicit opponent response, B-32 evaluates symmetric changes around the current relative weight. The default magnitude is 10%:

- response weight × 0.90
- response weight × 1.10

Weights remain bounded to the existing `[0.05, 4]` relative-weight contract.

These are sampling weights, not calibrated probabilities.

### Simulation-budget perturbation

Optionally evaluate an 80% and 120% simulation horizon. This tests whether a result is sensitive to the amount of simulated trajectory depth.

A shorter horizon can legitimately produce fewer terminal match outcomes; that is reported as sensitivity rather than silently treated as equivalent evidence.

## Metrics

`baselineWinPathCoverage` is the unperturbed scenario coverage when available.

`perturbedWinPathCoverageMean`, `Min`, and `Max` summarize the perturbation samples.

`Sensitivity` is the mean absolute deviation of perturbed coverage from baseline, bounded to `[0,1]`.

`PerturbationStability = 1 - Sensitivity`.

A scenario is currently marked robust when at least two perturbation samples exist and stability is at least `0.8`.

These thresholds are engineering gates, not statistical significance claims.

## Evidence Boundary

- Match observations remain observed.
- Inferences remain inferred.
- Scenario assumptions remain hypothetical.
- Simulation trajectories remain simulated.
- Perturbations do not create new player facts or evidence.

## Reproducibility

Every perturbation receives a deterministic derived seed from the configured base seed. The same canonical counterfactual state, scenario definition, perturbation specification, simulation configuration, and model version can therefore be replayed.

## B-31 vs B-32

B-31 asks:

> Does the scenario survive different random seeds?

B-32 asks:

> Does the scenario survive controlled changes to the hypothetical environment we used to simulate it?

A scenario that passes both tests has stronger engineering robustness than one that merely produces a high branch count under a single simulation configuration.

Neither layer establishes truth, calibrated probability, or a coaching recommendation.

## Current Limitations

B-32 currently perturbs explicit response weights and optional simulation horizon. Future robustness work should add:

1. state-parameter perturbations for explicitly modeled hypothetical variables;
2. matchup-model perturbations with versioned assumptions;
3. tactical assumption perturbations;
4. cross-seed × perturbation matrices;
5. path-signature stability rather than coverage alone;
6. adversarial response-model stress tests;
7. statistical confidence intervals once validated datasets exist.

## Next

**B-33 — Robustness-aware adaptive scenario search:** feed cross-seed and perturbation robustness into the scenario-search evaluation loop without collapsing robustness into a single opaque score or automatically selecting a strategy.
