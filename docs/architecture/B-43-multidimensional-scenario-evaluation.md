# B-43 — Multidimensional Scenario Evaluation

## Reference absorbed

IAMEE is an Integrated Assessment Model Scenario Exploration and Evaluation Framework. It evaluates scenarios across multiple dimensions rather than reducing scenario quality to a single prediction. Its current framework includes economic feasibility, environmental sustainability, resource use, societal resilience, interregional fairness, near-term robustness, and transition rate. It also computes regional metrics and has scenario-archetype/selection concepts. citehttps://github.com/hamishbeath/IAMEE

For Coaching AI, the useful architectural pattern is the **multidimensional scenario scorecard**, not the climate-specific metrics or domain assumptions.

## Coaching adaptation

A coaching scenario can now be evaluated across independent dimensions:

- `win_path_support`
- `failure_avoidance`
- `robustness`
- `evidence_strength`
- `opponent_response_resilience`
- `execution_burden`
- `adaptability`
- `tactical_diversity`

Each dimension keeps its own score, confidence, uncertainty, evidence references, and optional rationale.

## Why this matters

A scenario can be strong on one axis and weak on another. For example, an intervention can have strong simulated win-path support while having poor robustness or high execution burden. The system therefore must not collapse all dimensions into an opaque recommendation.

B-43 provides optional aggregate scoring for inspection, but also supports Pareto-style non-dominated scenario sets. A scenario is Pareto-eligible when no other evaluated scenario is at least as strong on every shared dimension and strictly stronger on one.

## Evidence and uncertainty

Scores are not observations. Every score carries evidence references and confidence/uncertainty. Missing evidence does not become a favorable score. The evaluator preserves the distinction between observed evidence, inference, simulation, and outcome through the existing evidence graph and explanation layers.

## Determinism

Evaluation results carry the canonical state signature and optional simulation seed. The same dimensions and inputs can therefore be replayed independently of presentation/UI logic.

## Coach authority

B-43 does not select a tactic. Pareto eligibility is a structural property of the evaluated scenario set, not a recommendation. The coach remains the decision authority through the B-42 command boundary.

## IAMEE concepts intentionally not copied

The implementation does not copy climate-specific indicators, PyAM data structures, country/region assumptions, or IAMEE's Python execution pipeline. Those belong to its original integrated-assessment domain.

## Next

B-44 should connect this evaluation contract to the scenario exploration service so a coach query can request multiple candidate scenarios, evaluate them dimension-by-dimension, preserve Pareto alternatives, and return them through the explanation read model.
