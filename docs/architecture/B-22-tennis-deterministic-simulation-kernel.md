# B-22 — Tennis Deterministic Simulation Kernel

## Purpose

Create reproducible synthetic branches from a tennis counterfactual state and tactical scenario.

## Reproducibility contract

A simulation is identified by:

- scenario ID
- source state version
- model version
- engine version
- seed
- simulation count
- maximum steps
- evidence references

The same configuration and seed produce the same branch-selection sequence.

## Current scope

B-22 samples the opponent-response branch deterministically. It deliberately does **not** invent point outcomes or claim calibrated win probabilities. Full tennis transition dynamics require a validated model for serve, return, rally, score, fatigue, and terminal outcomes.

## Why this staged kernel is useful

It gives the platform a deterministic branching substrate before adding outcome models. This lets us test scenario reproducibility, branch coverage, provenance, and later evaluation independently from the quality of an outcome predictor.

## Semantic boundary

Synthetic trajectories are SIMULATED. They are never promoted to OBSERVED evidence.

## Next

B-23 — Tennis Win-Path Engine: classify simulated branches into candidate win/failure/neutral paths once validated outcome-transition models are available.
