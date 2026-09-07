# B-47 — Replayable Coach Exploration Receipt

## Purpose

B-47 makes a coach scenario exploration replayable and auditable without turning the exploration result into a coaching command.

The receipt records the canonical inputs and versions needed to identify the exploration: sport, game/state identity, state signature and version, ruleset, scenario set, Pareto frontier, simulation seeds, simulation budget, evaluator version, service version, and evidence IDs.

The receipt deliberately does **not** record a recommendation. Pareto membership remains an evaluation output for coach review, not an autonomous selection.

## Flow

```text
Coach Query
  -> ScenarioExplorationService
  -> Simulation + Multidimensional Evaluation
  -> Exploration Result
  -> Replayable CoachExplorationReceipt
  -> Coach Response
```

## Deterministic replay identity

`deterministicKey` is a canonical, ordered representation of the exploration inputs and relevant versions. It excludes wall-clock timestamps so the same state, ruleset, scenario set, seeds, evaluator, service version, budget, and evidence set can produce the same replay identity.

This is intentionally a portable string rather than a runtime-specific cryptographic hash. A future persistence layer may hash the canonical value without changing the receipt contract.

## Receipt fields

- `stateSignature` and `stateVersion` pin the game-state snapshot.
- `rulesetVersion` pins sport rules.
- `scenarioIds` identifies the explored scenario population.
- `paretoScenarioIds` records the evaluation frontier without declaring a winner.
- `simulationSeeds` makes stochastic exploration reproducible.
- `simulationBudget` records the requested simulation budget when supplied.
- `evaluatorVersion` and `serviceVersion` pin the evaluation/exploration implementation versions.
- `evidenceIds` provides the evidence set used by the request and resulting simulations/evaluations.
- `deterministicKey` provides the canonical replay identity.

## Validation

`validateCoachExplorationReceipt` reconstructs the expected receipt from the request and result and reports mismatches. This allows a persistence or audit layer to reject stale or tampered receipts before presenting them as replayable provenance.

## Authority boundary

The receipt is evidence of **what exploration was performed**, not authority to execute an intervention.

- No tactic is selected automatically.
- No external action is executed.
- No game state is mutated.
- `humanDecisionRequired` remains `true` on the coach response.

## Relationship to receipt OCR

The receipt pattern is also compatible with future document evidence adapters such as `bhimrazy/receipt-ocr`: extracted document evidence can enter the Evidence Ledger, while a coaching exploration receipt records exactly which evidence IDs participated in an exploration. The OCR system itself remains an external adapter rather than a sports-core dependency.

## Next

B-48 should assemble claim-level coach explanations from the evidence graph, exploration result, and replay receipt so a coach can inspect not only which scenarios were explored, but why each claim is supported, uncertain, or contradicted.
