# B-20 — Tennis Tactical Scenario Engine

## Purpose

Turn current tennis state plus matchup intelligence into explicit hypothetical tactical branches.

## Core loop

`CURRENT MATCH STATE → MATCHUP MODEL → INTERVENTION → OPPONENT RESPONSE → COUNTER PATH`

B-20 deliberately stops before simulation. B-21 can apply these branches to counterfactual state transitions and later simulation/search.

## Intervention families

- serve direction
- serve speed
- second-serve shape
- return position
- return aggression
- rally length
- court position
- tempo

These are intervention primitives, not coaching commands.

## Response model

Opponent responses are ranked with **relative weights**, not calibrated probabilities. The engine preserves uncertainty and evidence references. A response can be hypothetical even when its rationale is informed by observed player tendencies.

## Semantic boundary

- OBSERVED: point/shot evidence.
- INFERRED: player and matchup intelligence.
- HYPOTHETICAL: intervention, response, and counter path.
- SIMULATED: downstream state trajectories.

No scenario is labeled as an observed fact merely because the underlying matchup model is evidence-backed.

## Design rule

B-20 generates a *space of possibilities*. It does not select the best tactic, issue an instruction, or automatically execute an action.

## Next

B-21 — Tennis Counterfactual State Engine: apply an intervention/response/counter to a versioned canonical match state while preserving provenance and reproducibility.
