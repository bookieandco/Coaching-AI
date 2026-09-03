# B-26 — Tennis Point Trajectory Simulation

## Upgrade

B-22 is upgraded from single tactical-branch sampling to deterministic point-by-point trajectories.

`COUNTERFACTUAL STATE → OUTCOME WEIGHTS → POINT TRANSITION → GAME/SET/MATCH STATE → TRAJECTORY`

## Guarantees

- seeded deterministic branching
- canonical scoring transitions
- explicit server/receiver point labels
- state-version progression inside simulated trajectories
- response/counter provenance
- no mutation of the source counterfactual object
- no conversion of heuristic weights into calibrated probabilities

## Outcome model boundary

The current point winner selector uses matchup-derived relative weights. These are simulation weights only. They must be replaced or calibrated against observed point-level datasets before being interpreted statistically.

## Serving

Singles server alternates after completed games. Official tiebreak serving rotation is still a ruleset gap and is intentionally not approximated.

## Terminal semantics

Trajectories can terminate at point, game, set, or match boundaries. A max-step cutoff remains a continuation rather than an invented terminal outcome.

## Next

B-27 — Tennis Win-Path Upgrade: consume final simulated score states to classify actual simulated win/failure/neutral trajectories.
