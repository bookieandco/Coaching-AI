# B-48 — Algorithmic Scenario Search Kernel

## Reference

K-Search (`caoshiyi/K-Search`) demonstrates a persistent, co-evolving world model for iterative search: hypotheses and alternatives are retained across rounds, evaluation results update the search state, and stagnation can trigger a different search action. The repository describes this as a structured decision tree rather than independent one-shot generation. citehttps://github.com/caoshiyi/K-Search

## Coaching-AI fusion

Coaching AI adopts the search architecture, not the GPU-kernel implementation.

The universal layer now provides `ScenarioSearchWorldModel` with:

- persistent exploration identity
- state signature anchoring
- explicit search nodes
- hypotheses with confidence and evidence references
- evaluation attachment
- visits and improvement history
- stagnation tracking
- explicit next search actions
- deterministic node ordering

Supported search actions are `expand`, `refine`, `counter`, `replay`, and `stop`.

## Control boundary

The world model is a search-memory mechanism. It is not a coaching policy and does not issue instructions. A search action means what the exploration engine should investigate next; it does not mean what a coach should tell an athlete to do.

The existing command boundary remains human-authoritative.

## Evidence semantics

Hypotheses carry evidence references and confidence separately. Search state cannot convert a hypothesis into an observation. Evaluation remains separate from simulation and outcome records.

## Reproducibility

The world model is anchored to `explorationId` and `stateSignature`. Scenario exploration receipts remain the replay boundary for the complete exploration run; this world model records the evolving search state within that run.

## Why this matters

This gives Coaching AI a persistent search memory instead of repeatedly starting scenario exploration from scratch. It also creates a clean location for future A*, adversarial/minimax, Monte Carlo, beam, and domain-specific search strategies without coupling those algorithms to a particular sport.

## Next

B-49 should connect the world model to `ScenarioExplorationService` while preserving deterministic budgets, explicit search strategy metadata, and the human-decision boundary.
