# B-10 — Boxing Scenario Evaluation + Learning Loop

## Objective

Close the loop between simulated coaching scenarios and what actually happened. B-10 evaluates scenario performance, exposes simulation-vs-observation divergence, and emits bounded learning signals without converting evaluation into coaching advice.

## Flow

```text
Scenario
  ↓
Simulation
  ↓
Win / Failure Path Report
  ↓
Real-World Outcome (when available)
  ↓
Scenario Evaluation
  ↓
Divergence + Calibration Signals
  ↓
Learning Signals
  ↓
Adaptive Opponent / Intelligence State
```

## Evidence separation

- `simulated` evidence describes model-generated trajectories.
- `observed` evidence describes what was actually recorded.
- Evaluation compares the two; it does not rewrite history.
- Observations can update future intelligence, while simulations remain hypothetical.

## Evaluation outputs

B-10 records:

- objective scores
- observed-vs-simulated deltas
- calibration signals
- path robustness
- uncertainty
- learning signals
- evidence references
- model/evaluation provenance

## Learning rules

Learning is deliberately bounded. A single observed outcome may identify divergence, but it must not be treated as proof of a permanent tactical rule. Repeated evidence belongs in the adaptive opponent model and broader intelligence layer.

## Non-goals

B-10 does not:

- recommend a tactic to a coach
- declare a scenario certain
- convert relative simulation weights into calibrated probabilities
- overwrite observations with simulation output
- automatically execute a coaching decision

## Forward integration

B-11 should surface these evaluations through the Coach Command Center. B-12 should connect them to video evidence so every important evaluation can be traced back to the relevant fight sequence.
