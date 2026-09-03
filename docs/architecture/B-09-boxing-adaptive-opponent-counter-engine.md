# B-09 — Boxing Adaptive Opponent / Counter Engine

## Purpose

B-09 makes the opponent model adaptive across sequential observations and simulation branches.

The engine answers:

> Given what the opponent has just done in response to an intervention, how should the set of plausible next responses change?

It does **not** answer:

> What will the opponent do?

## Position in the coaching loop

```text
CURRENT STATE
  ↓
INTERVENTION
  ↓
OPPONENT RESPONSE
  ↓
ADAPTIVE UPDATE
  ↓
NEXT RESPONSE SET
  ↓
COUNTER / COUNTER-RESPONSE
  ↓
SIMULATION
  ↓
OBSERVATION
  ↺
```

## Model semantics

Response values are **relative weights**, not calibrated probabilities.

The engine maintains:

- prior response weight
- observed evidence count
- adaptive response weight
- exposure count
- phase/distance-specific intervention exposure
- uncertainty
- evidence and provenance

An observed response receives an evidence update. Repeated exposure to the same intervention creates adaptation pressure on subsequent branches. The update is deterministic for identical inputs and configuration.

## Observation sources

Two sources are explicitly separated:

- `observed` — evidence from the actual fight
- `simulated` — evidence produced by a counterfactual/simulation branch

Simulated evidence carries an uncertainty penalty so hypothetical behavior cannot silently become equivalent to observed behavior.

## Adaptation behavior

For a response that was observed:

```text
newWeight = clamp(oldWeight × exposureDecay + learningGain)
```

Learning gain is scaled by observed effectiveness.

For competing responses, repeated exposure applies a small adaptation-pressure adjustment rather than deleting alternatives. This preserves multiple plausible opponent reactions.

## Phase and distance

Exposure keys include:

```text
intervention : phase : distance
```

This prevents a response learned at one tactical distance or fight phase from automatically becoming a universal opponent rule.

## Evidence discipline

Every update carries forward:

- previous model evidence
- observation evidence
- candidate-response evidence

Evidence is deduplicated by serialized reference.

## Non-goals

B-09 does not:

- issue coaching recommendations
- select the coach's intervention
- produce calibrated probabilities
- collapse uncertainty to a single opponent action
- treat simulation output as ground truth
- replace the canonical event/state ledger

## Next integration

B-10 should evaluate adaptive scenarios against what actually happened and measure:

- whether the opponent response set became better calibrated
- whether adaptation improved scenario robustness
- observed-vs-simulated divergence
- cross-seed stability
- intervention exposure effects
- model version performance
