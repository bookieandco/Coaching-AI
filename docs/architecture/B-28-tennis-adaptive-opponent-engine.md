# B-28 — Tennis Adaptive Opponent Engine

## Purpose

B-28 closes the first observed-behavior loop for tennis coaching scenarios:

`OBSERVED INTERVENTION → OBSERVED OPPONENT RESPONSE → EFFECTIVENESS → ADAPTIVE STATE → SCENARIO RESPONSE WEIGHTS → SIMULATION`

The engine learns which response branches become more supported after an opponent has actually reacted to an intervention. It does not convert the learned weights into calibrated probabilities and does not recommend an action to the coach.

## Borrowed design principle

The external Adaptive-GA reference contributes a search principle rather than sport-specific code:

- preserve useful prior solutions;
- repair invalid candidates;
- adapt search pressure from observed population behavior;
- inject diversity so search does not collapse around one solution;
- evaluate candidates against multiple objectives.

For Coaching AI, these ideas apply to scenario populations rather than binary genetic individuals.

## Adaptive observation contract

A valid adaptive observation explicitly identifies:

- initiator of the intervention;
- opponent;
- intervention type;
- observed opponent response;
- effectiveness of that response in the observed context;
- observed versus simulated provenance;
- optional surface, phase, and step context;
- evidence references.

A point winner alone is **not** treated as proof of an opponent tactical response. The response label must come from canonical event reconstruction, video observation, tracking, or an explicit coach/manual observation.

## Adaptive state

The state is scoped to an initiator/opponent pair and maintains:

- intervention exposure counts by intervention/surface/phase;
- prior response weights;
- accumulated evidence strength;
- adaptive response weights;
- exposure count per response;
- latest observed step;
- uncertainty;
- evidence references.

Observed evidence has stronger learning impact than simulated evidence. Simulated evidence can support exploration but cannot masquerade as observed behavior.

## Update rule

For an observed response:

`new response weight = prior adaptive weight + evidence gain × source strength × effectiveness gain`

Alternative responses receive a small adaptation pressure so the distribution can change without deleting alternatives.

Weights are clamped to configured minimum/maximum bounds and sorted deterministically.

These are **relative search weights**, not probabilities.

## Scenario integration

`generateTennisTacticalScenarios` now accepts an optional `TennisAdaptiveState`.

Without adaptive state, the reference response weights remain unchanged.

With adaptive state:

`candidate response → adaptive weight lookup → uncertainty/evidence enrichment → counter-path generation`

This preserves backward compatibility while allowing observed opponent behavior to influence future scenario generation.

## Simulation integration

The tennis simulation kernel now samples opponent response branches using their relative weights rather than uniformly sampling the response list.

The kernel also refreshes server/receiver IDs from the evolving state each point and avoids an erroneous normal service swap when a 6-6 tiebreak is entered.

Official tiebreak serving order and cross-set server continuity remain explicit future rules-engine work rather than being silently approximated.

## Safety / semantic boundary

B-28 does not:

- claim a learned response weight is a calibrated probability;
- infer an opponent tactic solely from match outcome;
- automatically select a coaching intervention;
- execute an intervention;
- replace the canonical event ledger;
- turn simulation evidence into observed evidence.

## Next layer

B-29 should turn this adaptive response model into a **multi-objective adaptive scenario search** layer:

`candidate scenarios → validity repair → objective evaluation → elite preservation → diversity injection → adaptive opponent response → counterfactual simulation → win/failure paths → scenario archive`

The objective is not one optimal tactic. The objective is a diverse frontier of defensible tactical alternatives for coach review.
