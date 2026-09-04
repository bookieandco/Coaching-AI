# B-38 — Universal Coaching Intelligence, Calibration, Hierarchical Evidence & Reference Motion

## Objective

Promote the strongest ideas discovered while building tennis and reviewing external coaching systems into the universal Coaching AI core.

B-38 creates contracts and deterministic primitives for four capabilities:

1. performance estimation with sparse-data partial pooling;
2. confidence calibration against observed outcomes;
3. reference-based motion comparison;
4. high-level intervention/policy evaluation without autonomous selection.

The universal layer remains sport-agnostic. Sport adapters provide the domain-specific observations, motion features, rules, and interventions.

## Influences

- Coach Watts demonstrates the value of a unified longitudinal athlete context rather than isolated event metrics: workouts, recovery/readiness, history, and adaptive planning can coexist in one coaching model. urlCoach Watts repositoryhttps://github.com/watt-mind/coach
- Coach-RL motivates evaluating coaching at the high-level intervention/state layer rather than issuing low-level player commands.
- Hierarchical Bayesian modeling motivates partial pooling: sparse player or situation samples can borrow statistical strength from a higher-level prior without rewriting observed facts.
- Confidence/performance research motivates measuring whether confidence tracks actual correctness rather than treating confidence as performance.
- Reference-based motion work motivates comparing observed movement against an explicit reference, with temporal alignment and spatial/temporal differences kept as structured evidence.

## Universal contracts

### 1. Coaching evidence semantics

The core preserves:

`OBSERVED ≠ INFERRED ≠ HYPOTHESIS ≠ SIMULATED ≠ UNKNOWN`

Missing evidence is never converted into negative evidence.

### 2. Hierarchical evidence

The supported hierarchy is:

`SPORT → COMPETITION → TEAM → PLAYER → GAME → SITUATION`

`estimateHierarchicalRate()` performs deterministic partial pooling from a parent mean and parent strength. It produces an estimate; it does not alter the underlying observations.

### 3. Sparse performance estimation

`estimateBetaBinomial()` supplies a deterministic Beta-Binomial estimate with an explicit prior. The returned uncertainty is an estimate uncertainty measure, not a claim that the model is calibrated.

Actual probability calibration remains an evaluation task requiring held-out observations.

### 4. Confidence calibration

`calibrateConfidence()` separates three concepts:

- performance: what happened;
- confidence: how strongly the system believed its estimate;
- calibration: how confidence tracked observed correctness.

The result exposes mean absolute error, Brier score, mean confidence, and observed accuracy.

### 5. Reference motion

`compareReferenceMotion()` accepts already-extracted motion measurements:

`REFERENCE → OBSERVED MOTION → ALIGN → DIFFERENCE → EXPLANATION → PRACTICE OBJECTIVE`

The core does not perform computer vision. A sport/video adapter supplies the temporal alignment and spatial/temporal difference measurements plus evidence references.

Both observed and reference evidence remain traceable.

### 6. Coaching policy evaluation

`buildCoachingPolicyEvaluation()` records the evaluation of a high-level intervention against a state signature and objective scores.

It deliberately does **not**:

- choose the best policy;
- authorize an intervention;
- issue player commands;
- convert scores into probabilities;
- replace the coach.

That keeps scenario search, simulation, and coach review above the universal measurement layer.

## Architecture

```text
                 UNIVERSAL COACHING INTELLIGENCE
                              │
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
 Performance              Confidence          Motion / Technique
  Estimation              Calibration             Comparison
        │                     │                     │
        └──────────────┬──────┴──────────────┬──────┘
                       ↓                     ↓
                Hierarchical           Reference
                   Evidence              Evidence
                       │                     │
                       └──────────┬──────────┘
                                  ↓
                         Policy / Scenario
                            Evaluation
                                  ↓
                           Coach Explanation
```

## Relationship to Tennis

Tennis remains the reference implementation for the full scenario-learning stack. B-38 gives tennis a universal destination for capabilities that should not remain tennis-specific.

The tennis layers can now progressively map:

- player intelligence → `CoachingEstimate` / hierarchical evidence;
- scenario evaluation → confidence calibration records;
- future CoachMe-style technique analysis → `ReferenceMotionComparison`;
- tactical scenario branches → `CoachingPolicyEvaluation`.

The same contracts can then be consumed by basketball, soccer, football, baseball, hockey, volleyball, rugby, cricket, golf, lacrosse, combat sports, motorsports, and future adapters.

## Reproducibility

B-38 primitives are deterministic. They do not use random sampling, wall-clock timestamps, hidden model state, or opaque external calls.

Any stochastic simulation remains responsible for its own seed/model/config provenance under the existing simulation contracts.

## Safety and epistemic boundary

B-38 is an evidence and evaluation layer, not an autonomous coach.

It must never silently promote:

- population evidence into an individual fact;
- inferred technique into observed technique;
- confidence into outcome probability;
- simulation into reality;
- a policy score into a recommendation.

## Implementation

Implemented in:

- `packages/sports-core/src/coaching-intelligence.ts`
- `packages/sports-core/src/index.ts`
- `packages/sports-core/package.json`

Exports include:

- `estimateBetaBinomial`
- `estimateHierarchicalRate`
- `calibrateConfidence`
- `compareReferenceMotion`
- `buildCoachingPolicyEvaluation`

## Next

B-39 should connect the universal intelligence layer to a universal **Coach Explanation / Evidence Graph** so every coach-facing statement can answer:

`WHAT DO WE KNOW? → WHY DO WE THINK IT? → WHAT EVIDENCE SUPPORTS IT? → WHAT IS UNKNOWN? → WHAT COULD HAPPEN IF WE INTERVENE?`

That explanation layer should consume, rather than replace, the existing scenario lineage, epistemic awareness, evidence ledger, simulation, and sport-adapter contracts.
