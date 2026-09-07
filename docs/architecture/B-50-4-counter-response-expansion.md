# B-50.4 — Counter-Response Expansion

## Purpose

Turn a selected coaching scenario into explicit opponent-response branches and evaluate those branches with the universal adversarial search kernel.

## Flow

```text
Selected Scenario
  -> Counter-Response Candidates
  -> Opponent Branch Nodes
  -> Adversarial Search Tree
  -> Minimax Evaluation
  -> Principal Variation
  -> World Model
```

## Design

Counter-response expansion is sport-neutral. A sport adapter supplies plausible response candidates and their evidence/evaluations; the core owns deterministic branch construction and adversarial traversal.

The kernel does not issue a coaching instruction. It identifies which response branch is most damaging under the supplied evaluation model and preserves the principal variation for inspection.

## Gomoku-derived pattern

The Gomoku reference demonstrates the value of explicit defensive response search, alpha-beta/minimax-style traversal, and heuristic evaluation rather than evaluating only the initiating move. The sports implementation generalizes this to scenario nodes rather than board positions.

## MiniMax H3 boundary

Multimodal/video generation belongs upstream in the evidence and perception layers. H3-derived observations can supply candidate response evidence, but generated media is never treated as ground truth without an evidence/provenance record.

## Safety boundary

- no autonomous tactic selection
- no game-state mutation
- no external action
- no claim that minimax output is a prediction
- coach remains the decision authority

## Determinism

Response candidates are stably ordered by scenario ID. Node IDs encode parent and response identity. Minimax tie-breaking is deterministic.
