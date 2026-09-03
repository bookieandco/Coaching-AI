# B-15 — Tennis Reference Adapter

Tennis is the second sport reference implementation after boxing. It is deliberately built against the universal `SportAdapter` contract so the coaching intelligence layer can remain sport-agnostic.

## Canonical state

The adapter models:

- two participants for singles or four for doubles;
- points, games, and sets;
- best-of-1, best-of-3, and best-of-5 formats;
- court surface;
- server/receiver metadata;
- set completion;
- evidence references;
- monotonically increasing state versions.

## Event boundary

Raw feeds become canonical `Event` objects through `normalizeEvent`. State changes occur only through `applyEvent`/`applyAction`. Downstream intelligence must consume the resulting `GameState` rather than maintaining a parallel score truth.

## Coaching intelligence hooks

The tennis adapter exposes the state required for later tennis-specific intelligence such as:

- serve/return matchup modeling;
- rally-length and point-pattern analysis;
- court-position and movement intelligence;
- first/second serve behavior;
- break-point pressure states;
- surface-specific tendencies;
- fatigue and late-set performance;
- opponent adaptation;
- point/set/match counterfactuals.

Those models belong above the adapter boundary. The adapter should not become a prediction engine or coaching recommendation engine.

## Important semantic rule

A tennis point winner is an observed event. Any explanation for why the point was won—serve quality, return depth, positioning, fatigue, tactical choice, or matchup—is inference and must retain its own evidence/provenance.

## Next tennis layers

The next tennis build should follow the same backward path used for boxing:

`MATCH DATA → POINT EVENT RECONSTRUCTION → PLAYER INTELLIGENCE → MATCHUP MODEL → TACTICAL SCENARIOS → COUNTERFACTUAL → SIMULATION → WIN PATHS → ADAPTIVE OPPONENT → LEARNING → COACH COMMAND CENTER → VIDEO → PRACTICE → LIVE MODE`

Tennis-specific state semantics should be implemented before universal scenario code is generalized from the boxing reference.
