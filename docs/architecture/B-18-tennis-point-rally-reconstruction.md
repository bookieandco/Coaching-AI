# B-18 — Tennis Point/Rally Reconstruction + Player Intelligence

## Objective

Convert shot-level observations into an ordered rally representation, then derive uncertainty-bearing player features from those reconstructed rallies.

## Evidence boundary

`OBSERVED` = directly supported by a feed, tracking system, video event, or annotation.

`INFERRED` = computed from observed events. It carries uncertainty and evidence references.

`HYPOTHESIS` = explanation to test.

`SCENARIO` = explicit intervention applied to a game state.

The reconstruction layer must not invent missing shots. An illegal sequence produces a warning; it does not silently rewrite evidence.

## Rally model

Each point is an ordered sequence of `TennisShotObservation` records. A shot can carry:

- actor;
- sequence/timestamp/frame;
- shot type;
- direction and depth;
- court zone;
- contact/bounce anchors;
- physical measurements such as speed/apex when available;
- terminal outcome;
- confidence;
- evidence and model provenance.

This preserves the useful Match Point AI abstraction of an ordered rally while replacing mutable simulation objects with immutable evidence-bearing observations. Match Point AI's rally implementation explicitly accumulates shots until a terminal event closes the rally. fileciteturn81file0

## Reconstruction rules

The first implementation validates alternation and terminal ordering but does not attempt to repair events. A future decoder may use tennis grammar to rank competing labels, but any relabeling must be recorded as inference.

Tennis-Vision demonstrates why this distinction matters: its ball state separates reliable floor-level geometry from best-effort contact/bounce classification, and its rally decoder uses sequence grammar because isolated event classification can produce physically impossible rallies. fileciteturn72file0 fileciteturn99file0

## Player intelligence

The first profile derives:

- first-serve rate;
- ace rate;
- double-fault rate;
- serve winner rate;
- return point-win rate;
- deep-return rate;
- return aggression rate;
- normalized rally length;
- long-rally share;
- winner/error rates;
- baseline/transition/net usage;
- break-point performance;
- tiebreak performance.

These are estimates, not permanent ratings. Small samples increase uncertainty.

## Video integration contract

Tennis-Vision's strongest reusable idea is evidence-first measurement. Serve classification should use physical evidence such as ball-above-head plus baseline position rather than assuming the first detected shot is a serve. Its shot-physics layer similarly only labels special shots when physical evidence exists. fileciteturn66file0 fileciteturn92file0

The future Coaching-AI video adapter should therefore emit observations and evidence references; it should not write tactical explanations directly into the canonical state.

## Historical data contract

The tennis-slams tracker contributes the durable-data pattern: source-aware historical records, append-only archives, scheduled refresh, and fail-safe behavior when an upstream source is empty or unavailable. The live source and durable history remain separate.

## Synthetic/search contract

Match Point AI's MCTS/rally-tree ideas and TDASS's explicit environment/what-if separation are useful downstream. Search statistics remain simulation metadata, never observations. Synthetic trajectories must be tagged as simulated and retain seed/model/ruleset provenance.

## Current implementation

- `src/point-reconstruction.ts` — evidence-aware ordered point/rally reconstruction.
- `src/player-intelligence.ts` — uncertainty-bearing player profile builder.
- `src/scoring.ts` — canonical scoring state machine.
- `src/index.ts` — canonical Tennis `SportAdapter` boundary.

## Next

`PLAYER INTELLIGENCE → SERVE/RETURN MATCHUP → TACTICAL SCENARIO ENGINE → OPPONENT RESPONSE → COUNTERFACTUAL → DETERMINISTIC SIMULATION/MCTS → WIN PATHS`
