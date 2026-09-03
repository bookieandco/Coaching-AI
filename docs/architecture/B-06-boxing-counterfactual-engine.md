# B-06 — Boxing Counterfactual State Transition Engine

## Purpose

Convert an explicit coaching intervention, a plausible opponent response, and an optional counter into a versioned hypothetical fight state.

This is a counterfactual transformation layer, not the simulation engine and not the prediction engine.

## Contract

```text
CURRENT CANONICAL STATE
        +
INTERVENTION
        +
OPPONENT RESPONSE
        +
OPTIONAL COUNTER
        ↓
HYPOTHETICAL STATE
```

Every branch records:

- parent state version
- hypothetical state version
- intervention
- response
- counter
- changed paths
- assumptions
- uncertainty
- evidence references
- engine/model provenance

## Semantics

A counterfactual state means:

> "What would the canonical state look like if we explicitly assume this branch occurred?"

It does **not** mean:

> "This is what will happen."

The simulation engine will later use these states as branch inputs and generate distributions over subsequent transitions.

## Branch isolation

Counterfactuals must never mutate the canonical live state. Each branch receives a new state object and a new state version.

This permits multiple branches to coexist:

```text
Live State v42
├── Scenario A → v43A
├── Scenario B → v43B
└── Scenario C → v43C
```

## Evidence discipline

Every branch carries forward the evidence supporting the intervention, response, and counter. Unknown evidence must remain unknown rather than being silently converted into confidence.

## Next dependency

B-07 — Deterministic Boxing Simulation Kernel.

That layer will consume counterfactual states, apply temporal transitions, and produce reproducible outcome distributions using explicit seeds and versioned configuration.
