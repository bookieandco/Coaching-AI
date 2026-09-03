# B-31 — Tennis Scenario Robustness & Cross-Seed Validation

## Purpose

B-31 tests whether a simulated coaching scenario remains structurally supported when the same counterfactual state is replayed with independent deterministic random seeds.

The question is not “what is the probability of winning?” It is:

> Does the simulated scenario's win-path support remain stable when stochastic sampling changes?

## Contract

`CANONICAL COUNTERFACTUAL → SAME SCENARIO → MULTIPLE SEEDS → SIMULATION → WIN-PATH REPORTS → STABILITY METRICS`

The canonical counterfactual state is reused for every seed. The evaluator never uses a previous simulation's final state as the next run's starting state.

## Metrics

- `winPathCoverageMean` — mean simulated win-path coverage across seeds.
- `winPathCoverageMin` / `Max` — observed bounds.
- `winPathCoverageRange` — max minus min.
- `crossSeedStability` — `1 - range`, bounded to `[0,1]`.
- `robust` — true only when at least two seeds are evaluated and stability reaches the configured safety threshold.

These are simulation stability measures, not calibrated probabilities.

## Evidence boundary

Observed evidence remains observed. Simulated trajectories remain simulated. Cross-seed agreement does not upgrade simulated output into observed fact.

No new player ability, opponent tendency, tactical fact, or evidence reference is invented by the robustness evaluator.

## Determinism

Each sample records its seed, simulation result, win-path report, and inherited evidence/provenance. Replaying the same configuration and seed should reproduce the same trajectory distribution.

## Failure handling

An invalid scenario produces an explicit non-robust result. Fewer than two unique seeds cannot establish cross-seed stability.

## Current limitation

The stability metric currently uses win-path coverage range. B-32 should add broader perturbation testing: response-weight perturbation, model-version comparison, state perturbation, and tactical-path signature stability.
