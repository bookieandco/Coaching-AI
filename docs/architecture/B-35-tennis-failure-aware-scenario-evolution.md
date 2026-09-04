# B-35 — Tennis Failure-Aware Scenario Evolution

## Purpose

B-35 feeds recurring failure-mode information back into the adaptive scenario search loop.

The search can now penalize candidates that repeatedly exhibit clustered failure signatures and generate conservative variants intended to move away from those recurring signatures.

## Flow

```text
SCENARIO POPULATION
  ↓
SIMULATION + ROBUSTNESS
  ↓
FAILURE-MODE CLUSTERING
  ↓
FAILURE-AWARE SCORE ADJUSTMENT
  ↓
PARETO / ELITE / DIVERSITY
  ↓
CONSTRAINED VARIATION
  ↓
RE-SIMULATE
```

## Configuration

`failureAware.enabled` enables the feedback loop.

`failureAware.penaltyWeight` controls how strongly matching recurring failure evidence reduces the `failure_avoidance` objective. The penalty is bounded to `[0,1]`.

## Evolution rule

B-35 deliberately remains conservative. It does not invent a new tactic from a failure cluster. It varies existing scenario response weights using the established constrained-variation mechanism.

Recurring clusters require at least two scenario observations before they influence evolutionary variation.

## Boundary

This is an optimization/search mechanism, not an autonomous coach. The engine does not select a winning tactic, execute an intervention, or convert cluster frequency into real-world probability.

Observed, inferred, hypothetical, and simulated evidence remain distinct.

## Next

B-36 should introduce scenario lineage and mutation provenance so every evolved candidate can be traced back through its parent, failure signal, perturbation, and simulation history.
