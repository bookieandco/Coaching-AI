# B-40 — Tennis → Universal Coaching Intelligence Integration

## Purpose

B-40 makes Tennis the first sport adapter to project sport-specific intelligence into the universal `sports-core` coaching contracts without erasing tennis-specific semantics.

The integration path is:

`Tennis observations → player intelligence → universal estimates → matchup/scenario evaluation → epistemic state → evidence graph`

The result is a coach-analysis read model, not an autonomous recommendation engine.

## Universal projections

### Player intelligence

Existing tennis feature estimates become `CoachingEstimate` records. The original value, sample size, uncertainty, and evidence references are preserved.

The projection does not relabel a tennis estimate as a calibrated match probability.

### Tactical scenarios

Each tennis tactical scenario becomes a `CoachingPolicyEvaluation` keyed by its scenario ID and current state signature. Objective scores currently describe:

- evidence coverage;
- opponent-response support;
- counter-path support.

These scores are descriptive. They do not select a tactic.

### Evidence graph

The projection creates typed graph nodes for:

- observed evidence;
- inferred player estimates;
- inferred matchup state;
- hypothetical scenarios;
- opponent-response hypotheses;
- scenario evaluations;
- unresolved/unknown evidence requirements.

This allows the coach interface to trace a claim back toward its supporting evidence rather than treating generated explanation text as evidence.

## Epistemic boundary

Tennis `OBSERVED`, `INFERRED`, `HYPOTHESIS`, `SIMULATED`, and `UNKNOWN` states remain explicit. Missing required evidence is represented as `UNKNOWN`; it is never silently upgraded into an inference.

## Evidence and uncertainty invariants

1. Every projected estimate retains its source evidence references.
2. Empty evidence remains unresolved.
3. Uncertainty travels with estimates, scenarios, evaluations, and graph nodes.
4. A matchup delta is not converted into a win probability.
5. Scenario evaluation does not imply recommendation.
6. The universal layer does not perform computer vision or invent motion measurements.
7. The graph is deterministic for the same input state, evidence, and scenario set.

## Why this matters

Recent tennis research is moving toward evidence-grounded tactical reasoning: fine-grained stroke events are linked to tactical relations and supporting evidence rather than producing unsupported high-level commentary. citeturn0academia24turn0academia25

This architecture also follows the broader sports-AI requirement that uncertainty, transparency, and contextualization remain visible when analytical outputs are translated toward coaching use. citeturn0search2turn0search6

## Implementation

- `packages/sport-adapters/tennis/src/universal-intelligence.ts`
- Tennis adapter exports the universal projection from `src/index.ts`.

## Boundary

B-40 intentionally stops before autonomous tactical selection. The next layer can consume the universal graph and produce a coach-facing explanation/read model while preserving the distinction between evidence, inference, hypothesis, simulation, and actual outcome.
