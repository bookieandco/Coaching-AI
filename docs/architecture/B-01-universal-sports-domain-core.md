# B-01 — Universal Sports Domain Core

## Objective

Establish sport-agnostic primitives that can represent games across team, individual, timed, possession-based, turn-based, and continuous-action sports without embedding rules for a particular sport.

## Core entities

- Sport
- Competition
- Season
- Game
- Venue
- Team
- Player
- Participant
- Official
- Role
- Position
- GameClock
- ScoreState
- GamePhase
- Possession
- SpatialState
- GameState
- Action
- Event
- StateTransition
- Matchup
- TacticalPattern
- Observation
- Inference
- Hypothesis
- EvidenceReference
- Intervention
- OpponentResponse
- Scenario
- SimulationRun
- WinPath
- FailurePath
- CounterPath
- ScenarioEvaluation

## Semantic separation

```text
OBSERVATION
  └─ what the system has evidence that it observed

INFERENCE
  └─ interpretation derived from observations

HYPOTHESIS
  └─ testable explanation that may be true or false

SCENARIO
  └─ explicit intervention + assumptions applied to a state

SIMULATION
  └─ generated distribution of possible state transitions

OUTCOME
  └─ what actually happened
```

These are separate domain objects and must not be collapsed into a single opaque AI prediction.

## State model

A `GameState` represents the canonical state at a point in time. It should support:

- participants and availability
- score
- clock / phase
- possession or control where applicable
- positions / spatial state where applicable
- active tactical configuration
- substitutions / rotations where applicable
- accumulated workload / readiness
- recent events
- uncertainty metadata
- source evidence references

Sport adapters own the semantics required to construct and validate these fields.

## Action model

An `Action` represents an intentional or observed game action. The universal model captures identity, actor, timestamp, spatial context, pre-state, post-state, confidence, and evidence references. Sport adapters define the legal/action vocabulary.

## Scenario model

A scenario is not a prediction. It is a counterfactual experiment:

```text
CURRENT GAME STATE
        +
COACH OBJECTIVE
        +
INTERVENTION
        +
CONSTRAINTS
        +
EXPLICIT ASSUMPTIONS
        +
EVIDENCE
        ↓
COACHING SCENARIO
```

## Reproducibility

Every simulation must carry:

- scenario ID
- source game-state version
- model version
- ruleset version
- evidence-set version
- RNG seed
- simulation configuration
- creation timestamp

The same inputs must permit deterministic replay of the same simulation run.

## Sport adapter rule

No sport-specific scoring, clock, possession, event, tactical, or spatial assumption may be placed in the universal core when it can be expressed through an adapter contract.

## First implementation priority

Build the type/contract layer first. Do not implement sport-specific intelligence until the universal contracts are stable enough to support at least basketball, American football, soccer, baseball, hockey, and tennis without core redesign.
