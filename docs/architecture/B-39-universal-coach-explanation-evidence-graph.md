# B-39 — Universal Coach Explanation + Evidence Graph

## Purpose

Create a universal, auditable graph behind coach-facing explanations.

The graph separates what the system observed from what it inferred, hypothesized, simulated, and ultimately observed as an outcome.

## Canonical chain

OBSERVATION → INFERENCE → HYPOTHESIS → SCENARIO → SIMULATION → OUTCOME → EVALUATION

Unknown or unsupported claims remain explicitly unresolved.

## Graph primitives

Nodes:

- observation
- inference
- hypothesis
- scenario
- simulation
- outcome
- evaluation
- unknown

Edges:

- supports
- contradicts
- derived_from
- tests
- simulates
- observes
- evaluates
- requires

Every node and edge can carry evidence references. The graph therefore describes support relationships rather than generating a persuasive narrative without traceability.

## Explanation contract

A coach-facing explanation should be able to answer:

1. What was actually observed?
2. What was inferred from those observations?
3. What remains a hypothesis?
4. Which scenario was tested?
5. Which assumptions were simulated?
6. What actually happened afterward?
7. Which evidence supports or contradicts the conclusion?
8. What remains unknown?

The graph is the source for those answers; generated prose is only a presentation layer.

## Safety and epistemic boundaries

- Missing evidence is not negative evidence.
- UNKNOWN is not INFERRED.
- HYPOTHESIS is not fact.
- SIMULATED is not OBSERVED.
- A confidence score is not automatically an outcome probability.
- Relative scenario weights are not calibrated probabilities.
- The graph does not select tactics or authorize coaching actions.

## Integration with B-37

Scenario lineage remains the mutation/history layer. B-39 adds the broader evidence relationship layer around that lineage.

ROOT SCENARIO → MUTATION LINEAGE → EVIDENCE GRAPH → COUNTERFACTUAL → SIMULATION → OUTCOME → EVALUATION

Lineage answers **where did this scenario come from?**

The evidence graph answers **why does this claim exist and what supports it?**

## Universalization

The contract belongs in `@coaching-ai/sports-core` so Tennis, Basketball, Soccer, Football, Baseball, Hockey, Combat Sports, and future adapters can produce the same evidence semantics.

Sport adapters provide domain observations and evidence; the universal core does not fabricate sport-specific facts.

## Current implementation

`packages/sports-core/src/evidence-graph.ts` provides deterministic graph construction and ancestor/descendant tracing.

The implementation intentionally does not include an LLM, vector database, graph database, causal inference engine, or autonomous decision policy. Those are integration layers that can consume the contract later.

## Next

B-40 should wire Tennis into the universal intelligence/evidence contracts and use the resulting graph to build a coach-facing explanation read model.
