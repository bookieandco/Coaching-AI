# B-16 — Tennis Intelligence Foundation

The tennis adapter is the canonical match-state boundary. The next intelligence layer will learn from point-level state transitions without changing that source of truth.

## Intelligence dimensions

- serve profile: first/second serve usage, placement, effectiveness;
- return profile: depth, direction, aggression and return outcomes;
- rally profile: length, tempo, direction and point-ending patterns;
- court position: baseline, transition and net states;
- pressure states: break points, set points, tiebreaks and closing games;
- surface effects: hard, clay, grass and other ruleset-specific contexts;
- fatigue/readiness: late-set and late-match degradation signals;
- matchup interactions: server vs returner and style-vs-style effects;
- adaptation: observed changes after repeated exposure to a tactic.

## Semantic boundary

`OBSERVATION` records what the evidence directly establishes.

`INFERENCE` describes a derived tendency or relationship.

`HYPOTHESIS` describes a testable coaching explanation.

`SCENARIO` explicitly changes a state assumption or intervention.

No inferred tennis tendency becomes an observation merely because a model has high confidence.

## Backward build

The implementation sequence remains:

`POINT RECONSTRUCTION → PLAYER INTELLIGENCE → MATCHUP → SCENARIO → COUNTERFACTUAL → SIMULATION → WIN PATH → ADAPTATION → LEARNING → COMMAND CENTER → VIDEO → PRACTICE → LIVE`

This keeps tennis compatible with the universal Coaching AI architecture while allowing tennis-specific mechanics to remain inside the adapter/intelligence boundary.
