# SPORT-PRED-01 — Canonical Sports Intelligence Envelope

## Objective

Create one sport-agnostic contract that every Sports Prediction model can emit and every downstream Coaching AI or Money Core research adapter can consume without collapsing prediction into authority.

The envelope represents **intelligence only**.

It may describe likely outcomes, uncertainty, evidence, model identity, calibration state, resolution rules, and provenance. It may never place a bet, allocate capital, execute a financial action, or issue a coaching intervention.

## Canonical flow

```text
OBSERVATIONS
    ↓
NORMALIZED SPORT STATE
    ↓
MODEL + VERSION + FEATURE SNAPSHOT
    ↓
PREDICTION DISTRIBUTION
    ↓
CALIBRATION + UNCERTAINTY
    ↓
EVIDENCE + PROVENANCE
    ↓
SPORTS PREDICTION ENVELOPE
    ├──→ Coaching AI baseline/context
    └──→ Money Core research input
```

The envelope stops at both boundaries.

## Required semantics

A valid `SportsPredictionEnvelope` binds:

- sport and subject identity;
- information cutoff and issue time;
- model, model version, methodology version, and feature snapshot hash;
- a normalized probability distribution;
- calibration status and evaluation history;
- aleatoric, epistemic, and overall uncertainty;
- explicit resolution authority and rule version;
- evidence references;
- input/evidence provenance hashes;
- allowed intelligence uses;
- an immutable no-execution authority block.

## Probability invariant

Outcome probabilities must be finite, individually bounded to `[0, 1]`, uniquely identified, and sum to one within a small numerical tolerance.

This prevents downstream systems from treating arbitrary scores as calibrated probabilities.

## Point-in-time invariant

`informationCutoff` cannot occur after `issuedAt`.

The envelope therefore records what the model was allowed to know when the prediction was issued. Downstream evaluation must resolve the prediction against later evidence without rewriting the historical prediction.

## Calibration invariant

Calibration remains separate from confidence and uncertainty.

The envelope records a calibration status and may include Brier score, sample size, calibration model version, and evaluation time. An uncalibrated model can still emit an envelope, but downstream consumers can distinguish it from a calibrated one.

## Epistemic invariant

The envelope carries:

- aleatoric uncertainty — irreducible outcome variability;
- epistemic uncertainty — uncertainty from model/data limitations;
- overall uncertainty.

These values are not execution thresholds by themselves.

## Resolution invariant

Every prediction declares how it can later be resolved:

- resolution type;
- named result authority;
- rule version;
- optional resolution deadline.

That allows reproducible post-event scoring and model calibration.

## Authority invariant

Every envelope is forced to:

```text
decision           = INTELLIGENCE_ONLY
coachingExecution  = NONE
bettingExecution   = NONE
financialExecution = NONE
```

No model, sport adapter, simulation, confidence score, or prediction probability can override this contract.

Money Core may later ingest an envelope as research evidence, but financial authority must be established independently inside Money Core / Action Core.

Coaching AI may display the envelope as baseline context, but the coach remains the decision authority.

## Allowed uses

The initial allowed-use vocabulary is:

- `ANALYSIS`
- `SIMULATION_BASELINE`
- `COACHING_CONTEXT`
- `MONEY_RESEARCH_INPUT`

`MONEY_RESEARCH_INPUT` means evidence ingestion only. It does not mean betting or trading authorization.

## Implementation

- `packages/sports-core/src/sports-prediction-envelope.ts`
- `packages/sports-core/src/sports-prediction-envelope.test.ts`
- exports through `packages/sports-core/src/index.ts`
- dedicated package subpath `@coaching-ai/sports-core/sports-prediction-envelope`

## Acceptance criteria

SPORT-PRED-01 is structurally complete when:

1. the envelope is sport-agnostic;
2. invalid probability mass fails closed;
3. future-information cutoff fails closed;
4. missing evidence/provenance fails closed;
5. execution authority cannot be represented as valid;
6. calibration and uncertainty remain separate;
7. downstream Money/Coaching uses are explicitly non-authoritative;
8. identical inputs produce the same semantic envelope.

## Next

**SPORT-MONEY-01** should create the one-way adapter from this envelope into Money Core's research/evidence boundary.

That bridge must preserve:

`prediction identity → information cutoff → model/version → calibration → uncertainty → evidence → provenance → resolution contract`

and must not translate a Sports Prediction probability directly into a wager, allocation, order, or execution permit.
