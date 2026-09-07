# B-41 — Universal Coach Explanation Read Model

## Purpose

Convert the universal Evidence Graph into a deterministic, coach-readable read model without turning explanations into evidence or recommendations.

## Flow

`Observation → Inference → Hypothesis → Scenario → Simulation → Outcome → Evaluation`

The read model preserves these epistemic distinctions and additionally exposes `Unknown` and `Contradicted` states.

## Contract

`CoachExplanationReadModel` contains:

- explanation/state identity
- ordered explanation items
- confidence and uncertainty for every item
- evidence references attached to the underlying graph node
- related graph nodes for traceability
- unresolved questions
- contradictions
- aggregate evidence coverage
- aggregate uncertainty
- engine provenance

## Invariants

1. An explanation is not evidence.
2. Claims retain their own evidence references.
3. Missing evidence remains unresolved rather than being filled by generated prose.
4. Contradicting edges surface as `contradicted` items.
5. Uncertainty is never silently converted into confidence.
6. The read model does not choose a tactic, intervention, or winner.
7. Coaches remain the decision boundary.

## Relationship to B-37/B-39/B-40

- B-37 answers **where did this scenario come from?**
- B-39 answers **what claims/evidence support or contradict it?**
- B-40 projects Tennis intelligence into those universal contracts.
- B-41 answers **how should the evidence-backed state be presented to a coach?**

## Future work

B-42 can add a sport-neutral command/query boundary and deterministic section ordering for the coach interface. Sport adapters should supply facts; the read model should not invent them.
