# B-11 — Boxing Coach Command Center

## Purpose

B-11 is the read-model boundary between the boxing intelligence stack and a future coach-facing interface. It assembles canonical fight state, scenarios, simulation/path results, evaluation, adaptive-opponent state, risks, and evidence without becoming a recommendation or execution engine.

## Inputs

- Canonical `GameState`
- `BoxingScenario[]`
- Optional `BoxingWinPathReport` projections
- Optional `BoxingScenarioEvaluation` projections
- Optional adaptive-opponent state
- Optional prediction baseline context

The command center owns no new source of truth.

## Presentation semantics

Every displayed conclusion must retain provenance:

- **OBSERVED** — directly supported by event/tracking/manual evidence.
- **INFERRED** — derived from observed evidence or evaluation.
- **SIMULATED** — produced by the deterministic simulation stack.
- **HYPOTHETICAL** — an intervention/assumption that has not yet been observed.

Prediction output is displayed only as baseline context. It is not converted into a coaching instruction.

## Scenario card

Each scenario exposes:

1. Objective
2. Intervention
3. Why the scenario is being considered
4. Modeled opponent responses
5. Counter paths
6. Win/failure/neutral path coverage
7. Robustness and uncertainty
8. Evaluation and simulation-vs-observation divergence
9. Evidence
10. Risks

Preferred language is descriptive: “Scenario,” “Modeled response,” “Simulation produced,” “Risk,” and “Evidence.” Avoid “do this now” or equivalent imperative recommendations.

## Freshness

The projection accepts an observation timestamp and configurable staleness threshold. Stale state is surfaced as a high-severity risk rather than silently treated as current.

## Coach decisions

A future decision record may capture what the coach chose, but this layer must not execute the action. Decision capture and action execution remain separate capabilities.

## Reproducibility

Scenario and simulation provenance must remain addressable through the underlying reports: state version, model/engine versions, seed/configuration, and evidence references.

## Relationship to the prediction system

Prediction is an input baseline. Coaching remains counterfactual:

`CURRENT STATE → BASELINE CONTEXT → SCENARIO → OPPONENT RESPONSE → COUNTER PATH → SIMULATION → WIN/FAILURE PATHS → COACH DECISION`

The command center does not collapse these stages into a single score.

## B-11 acceptance criteria

- No coaching action is automatically executed.
- No scenario is labeled as certain or guaranteed.
- Observed, inferred, simulated, and hypothetical information remains distinguishable.
- Stale state is visible.
- Evidence and provenance survive projection.
- Multiple scenarios can be compared without declaring a winner.
- The projection can later feed web/mobile/bench interfaces without changing domain truth.
