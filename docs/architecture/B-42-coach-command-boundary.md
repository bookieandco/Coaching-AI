# B-42 — Universal Coach Command Boundary

## Purpose

B-42 defines the contract between a coach-facing client and the Coaching AI intelligence layer.

The boundary is a query/response interface, not an autonomous coaching agent.

## Flow

`Coach Query → Validation → Intelligence/Evidence Retrieval → Explanation Read Model → Coach Response`

Scenario exploration follows the same boundary and may return scenario sets for the coach to inspect.

## Query kinds

- `explain_state` — explain the current state from the evidence graph.
- `trace_evidence` — follow claims back to source evidence.
- `explore_scenario` — inspect one or more hypothetical interventions.
- `compare_scenarios` — compare at least two supplied scenarios.
- `review_outcome` — review what actually happened against a prior scenario.
- `identify_unknowns` — expose unresolved evidence/questions.

## Safety boundary

Every response carries `humanDecisionRequired: true`.

The boundary does not select tactics, execute interventions, or convert scenario outputs into orders. It exposes evidence, uncertainty, scenarios, and outcomes so the coach can decide.

## Determinism and provenance

Queries carry a state signature and may carry scenario/evidence identifiers. Responses retain evidence references and can embed the B-41 explanation read model. This preserves the chain from coach question to source evidence.

## Design rationale

Current research supports keeping AI decision support complementary to human judgment, particularly where interpretation, confidence, and contextual decision-making matter. The architecture therefore treats the coach as the final decision authority rather than making the system the decision-maker. 

## Next

B-43 should connect this boundary to a concrete scenario-exploration service and add replayable query/result receipts without allowing the boundary to execute coaching actions.
