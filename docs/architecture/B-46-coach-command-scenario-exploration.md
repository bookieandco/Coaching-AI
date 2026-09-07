# B-46 — Coach Command Boundary → Scenario Exploration

## Purpose

B-46 connects the coach-facing command boundary to the universal `ScenarioExplorationService`.

The boundary now accepts `explore_scenario` and `compare_scenarios` queries, validates them, supplies the canonical game state and state signature to the exploration service, and returns the resulting scenario set and evidence references.

## Flow

```text
Coach Query
  ↓
Query Validation
  ↓
ScenarioExplorationService
  ↓
Sport-specific scenario generation / simulation
  ↓
Multidimensional evaluation
  ↓
Scenario Set + Evidence
  ↓
Coach Response
```

## Authority boundary

The boundary does not select a tactic, issue a coaching order, mutate game state, or execute an external action. Every response continues to carry `humanDecisionRequired: true`.

This follows the broader principle that an agent capability surface is not itself execution authority; scope and permissions must remain explicit at the boundary. citeturn0search0

## Tennis path

The Tennis implementation can now sit behind this universal boundary. Its existing scenario stack performs tactical scenario generation, counterfactual construction, simulation, win-path analysis, robustness, and failure-aware evolution before exposing the universal result contract.

## Query semantics

`explore_scenario` may carry a natural-language question or explicit scenario IDs.

`compare_scenarios` requires at least two scenario IDs.

Invalid requests fail before the exploration service is invoked.

## Determinism and evidence

The state signature is passed through unchanged. Returned simulation/evaluation evidence is deduplicated by evidence ID before it reaches the coach response.

## Non-goals

- no autonomous tactic selection
- no command execution
- no conversion of Pareto membership into recommendation
- no LLM-generated score overrides
- no mutation of observed game state

## Next

B-47 should add a replayable command receipt and explicit claim-level explanation assembly so every coach exploration can be reconstructed from query → state → scenario → simulation → evaluation → evidence.
