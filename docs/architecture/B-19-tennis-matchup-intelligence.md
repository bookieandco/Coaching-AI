# B-19 — Tennis Serve/Return Matchup Intelligence

## Purpose

Convert evidence-backed player profiles into a player-vs-player matchup model that can feed coaching scenarios without becoming an autonomous recommendation engine.

## Inputs

- server player profile
- receiver player profile
- court surface
- reconstructed rally/point evidence
- optional pressure-state samples

## Dimensions

1. First-serve production versus return performance.
2. Second-serve safety versus return conversion.
3. Return conversion versus opposing serve production.
4. Rally efficiency: winners versus errors.
5. Court-position tendencies: baseline, transition, and net usage.
6. Break-point pressure when sufficient evidence exists.

## Output

`TennisMatchupModel` contains explicit interaction deltas, uncertainty, evidence references, and model provenance.

A matchup `advantage` is a relative feature delta. It is **not** a calibrated probability, prediction, recommendation, or betting signal.

## Evidence boundary

OBSERVED → reconstructed point/shot facts.

INFERRED → player profile and matchup interactions derived from those observations.

HYPOTHETICAL → future tactical intervention.

SCENARIO → intervention + assumptions + opponent response + counterfactual state.

The matchup model must never silently convert inference into observed fact.

## Surface awareness

Surface is retained as first-class context. B-19 does not fabricate surface adjustments when the profile contains no surface-specific evidence. Future versions may add empirically estimated surface interaction coefficients.

## Next layer

`MATCHUP MODEL → TACTICAL SCENARIO GENERATOR → OPPONENT RESPONSE → COUNTERFACTUAL → SEARCH/SIMULATION → WIN PATHS`.

The useful lesson from external tennis AI references is to preserve sequential point structure and search over possible tactical responses. Our implementation keeps that search downstream of canonical evidence and state, rather than allowing a search policy to become the source of truth.
