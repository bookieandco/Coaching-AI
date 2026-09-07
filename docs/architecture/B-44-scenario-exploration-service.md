# B-44 — Universal Scenario Exploration Service

## Purpose

B-44 defines the execution-neutral service boundary that turns a coach's scenario set into replayable simulation results and multidimensional evaluations.

## Flow

`Coach Query → Canonical State → Candidate Scenarios → Simulation Seeds → Outcome Set → Multidimensional Evaluation → Pareto Set → Explanation`

The service contract does not itself implement sport-specific simulation. Sport adapters supply the simulation/evaluation implementation behind the boundary.

## Contract

`ScenarioExplorationRequest` carries:
- exploration identifier
- sport
- canonical state and state signature
- candidate interventions
- explicit assumptions/evidence
- optional deterministic seeds
- simulation budget

`ScenarioExplorationResult` carries:
- simulation results
- multidimensional scenario evaluations
- Pareto-eligible scenario IDs
- optional B-41 explanation read model
- state/seed provenance
- `humanDecisionRequired: true`

## IAMEE-derived design principle

Scenario quality is multidimensional. A single aggregate score must not erase tradeoffs. The evaluator therefore preserves dimension-level score, confidence, uncertainty, rationale, and evidence, while Pareto eligibility identifies non-dominated alternatives descriptively.

## Determinism

Seeds and the canonical state signature are explicit inputs. Implementations should persist the simulation configuration and engine version so a result can be replayed.

## Safety boundary

The exploration service generates and evaluates hypothetical alternatives. It does not issue orders, select tactics on behalf of the coach, or execute external actions.

## Next

B-45 should provide a sport-adapter execution bridge, beginning with Tennis, so the universal exploration contract can invoke the existing point simulation, win-path, adaptive-opponent, robustness, and evidence systems without duplicating them.
