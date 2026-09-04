# B-37 — Tennis Scenario Lineage + Epistemic Provenance

## Purpose

B-37 makes adaptive scenario evolution traceable. Every generated scenario can be followed back to its root scenario, through mutations, failure signals, evidence, and epistemic status.

## Lineage

```text
ROOT SCENARIO
    ↓
MUTATION
    ↓
FAILURE / DIVERSITY / ADAPTATION SIGNAL
    ↓
CHILD SCENARIO
    ↓
COUNTERFACTUAL
    ↓
SIMULATION
    ↓
ROBUSTNESS / FAILURE EVALUATION
```

A lineage node records:

- scenario ID
- parent and root IDs
- generation
- mutation type and reason
- deterministic mutation parameters when available
- recurring failure signatures
- epistemic item IDs
- evidence references
- engine/model provenance

## Epistemic boundary

Lineage does not upgrade evidence.

- OBSERVED remains OBSERVED.
- INFERRED remains INFERRED.
- HYPOTHESIS remains HYPOTHESIS.
- SIMULATED remains SIMULATED.
- UNKNOWN remains UNKNOWN.

Missing evidence is never treated as negative evidence.

The lineage can carry uncertainty forward, but it does not manufacture confidence.

## Adaptive-search integration

The Tennis adaptive scenario search now creates deterministic root lineage nodes and extends lineage when failure-aware evolution creates child scenarios. Recurring failure clusters are recorded as mutation signals so later analysis can answer:

- Which scenarios descended from the same root?
- Which mutations were made in response to recurring failures?
- Which evidence supported the lineage?
- Which epistemic unknowns were present when the mutation was created?
- How many generations separate a child from its root?

Failed scenarios remain auditable rather than disappearing merely because they are not elite.

## Reproducibility

Lineage does not depend on timestamps or random UUIDs. Scenario IDs and generation order remain deterministic, preserving replayability alongside the deterministic simulation kernel.

## Universalization rule

This is a Tennis implementation of a capability that belongs in the universal Coaching AI core. As other sports are built, they should implement the same lineage and epistemic contracts with sport-specific scenario semantics.

## Safety boundary

Lineage is an evidence and audit mechanism. It does not select a coaching strategy, diagnose an athlete, or authorize an intervention. The coach remains the decision authority.

## Next

B-38 should promote the lineage/epistemic model into a reusable universal contract and expose a coach-facing explanation view without collapsing observations, inferences, hypotheses, simulations, and unknowns.
