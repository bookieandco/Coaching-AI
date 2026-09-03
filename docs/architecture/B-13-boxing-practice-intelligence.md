# B-13 — Boxing Practice Intelligence

## Objective

Turn fight observations, fighter intelligence, scenario divergence, and win/failure-path evidence into **practice objectives and drill candidates** without becoming an autonomous coach.

The system answers:

> What skills or behaviors appear worth testing in practice based on the evidence we have?

It does not answer:

> What must the coach do?

## Data flow

```text
FIGHT / VIDEO EVIDENCE
        ↓
OBSERVED PRACTICE-RELEVANT BEHAVIOR
        ↓
FIGHTER / MATCHUP INTELLIGENCE
        ↓
OBSERVED OR INFERRED GAP
        ↓
PRACTICE OBJECTIVE
        ↓
HYPOTHETICAL DRILL CANDIDATE
        ↓
PRACTICE OBSERVATION
        ↓
FUTURE EVALUATION / LEARNING
```

## Semantic boundary

- `OBSERVED` — directly supported by tagged evidence.
- `INFERRED` — derived from fighter intelligence or simulation/evaluation divergence.
- `HYPOTHETICAL` — a candidate practice drill generated for testing.

The implementation must preserve evidence references across these transitions.

## Inputs

B-13 can consume:

- fighter profile/intelligence;
- tagged fight or video observations;
- scenario evaluation and observed-vs-simulated divergence;
- win/failure path evidence;
- future tracking/pose/perception outputs.

## Outputs

### Practice gap

A gap identifies a recurring or materially weak behavior, with severity, confidence, semantic basis, and evidence.

### Practice objective

An objective defines a behavior to test, an optional measurable target, and a measurement method. It is not a command.

### Drill candidate

A drill candidate provides a hypothetical practice format and progression. It remains explicitly hypothetical until practice evidence validates it.

### Session plan

A session plan is a projection of current evidence into candidate objectives and drills. It is not a schedule and is not an autonomous training prescription.

## Initial gap families

- defense;
- ring control;
- pressure response;
- exit direction;
- body attack;
- countering;
- distance control;
- tempo;
- conditioning / late-round stability;
- damage management;
- scenario adaptation.

## Measurement principle

Where possible, objectives use observable metrics rather than subjective ratings. Examples include successful defensive responses per exchange, time maintained at preferred distance, effective counters after identified triggers, and late-round performance relative to an early-round baseline.

Exact thresholds should come from the coach, sport rules, measurement system, or validated historical data rather than being invented by the intelligence layer.

## Architectural invariants

1. Practice intelligence never mutates canonical fight state.
2. Practice intelligence never converts relative scenario weights into calibrated probabilities.
3. Practice intelligence never silently turns an inference into an observation.
4. Every candidate should retain evidence provenance where available.
5. Drill candidates are suggestions for testing, not automatic coaching decisions.
6. Practice observations remain separate from fight observations and simulation outputs.
7. The same projection boundary can later be reused by other sport adapters.

## Relationship to Sports Prediction

Prediction-derived intelligence is useful as a baseline and source of mismatch signals. B-13 uses those signals to identify behaviors worth testing; it does not become a prediction engine or a betting/decision-execution layer.

## Next extension

B-14 adds live game/fight mode: continuously update canonical state and evidence while keeping perception, inference, scenario generation, and coach decision boundaries explicit.
