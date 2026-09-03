# B-25 — Tennis Scoring Invariant Hardening

## Completed invariants

The tennis scoring layer now explicitly handles:

- deuce → advantage
- advantage → deuce
- advantage → game
- 6–6 → tiebreak entry before another normal game is awarded
- tiebreak first-to-7 with a two-point margin
- 7–6 tiebreak set completion
- set reset after completion
- match completion through the existing best-of format target
- clearing stale advantage state when entering a tiebreak

## Regression vectors

`scoring-invariants.ts` provides deterministic vectors for the core transitions. They are intentionally dependency-free so they can be called from any future test runner.

## Important limitation

Server rotation and official tiebreak serving order are not yet modeled. Doubles remains outside this reference adapter. Those belong to the next ruleset hardening layer rather than being silently approximated.

## Next

B-26 — Upgrade the deterministic simulation kernel to run point-by-point trajectories against the canonical scoring state and the explicit outcome-transition contract.
