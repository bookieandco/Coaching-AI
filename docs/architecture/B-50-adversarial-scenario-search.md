# B-50 — Adversarial Scenario Search

## Purpose

Add an opponent-response search layer to the universal scenario engine without turning search into an autonomous coaching decision-maker.

## References fused

### Gomoku / minimax heuristics

`aallali/Gomoku` demonstrates a practical adversarial search pattern: evaluate offensive value alongside defensive threats, explicitly identify immediate wins and blocking responses, and rank alternatives rather than treating a single heuristic score as the whole decision process.

The Coaching AI adaptation is sport-neutral. It uses the existing `win_path_support` and `opponent_response_resilience` evaluation dimensions rather than importing board-specific heuristics.

### MiniMax H3 Turbo / ComfyUI

The supplied `minimaxh3turbo/MiniMax-H3-Turbo-LoRA-ComfyUI` URL currently returns 404 from GitHub, so no implementation was copied from that exact repository. The closely related MiniMax H3 ComfyUI ecosystem provides multimodal video/audio generation workflows and Turbo LoRA acceleration. Those capabilities belong in the video evidence / scenario visualization layer, not inside the adversarial search kernel.

## Contract

`scenario-adversarial-search.ts` provides deterministic minimax over an explicit scenario tree.

- `coach` nodes maximize the evaluated scenario value.
- `opponent` nodes minimize it.
- Value combines win-path support with opponent-response resilience.
- Child ordering is deterministic.
- Depth and child budgets are explicit.
- The result is a principal variation for explanation/search provenance, not a coaching order.

## Safety boundary

The engine answers: **which searched branch remains strongest under an explicitly modeled opponent response?**

It does not answer: **what the coach must do.**

All tactical authority remains above this layer at the Coach Command Boundary.

## Next

Wire the minimax result into the iterative world model as a `counter` branch, then expose its principal variation and evidence through the replayable exploration receipt.
