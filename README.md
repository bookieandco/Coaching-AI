# Coaching AI

AI Coaching Intelligence & Scenario Planning Platform.

## Product principle

Coaching AI does not attempt to make autonomous coaching decisions. It reconstructs games, models player/team/opponent behavior, explores counterfactual scenarios, and presents evidence-backed plausible win paths for human coaches and analysts.

## Multi-sport by architecture

The platform is sport-agnostic at the core. Sport-specific adapters provide the rules, event semantics, spatial models, scoring systems, tactical vocabularies, and state-transition logic required by each sport.

Initial adapter targets:

- Basketball
- American Football
- Soccer
- Baseball
- Ice Hockey
- Tennis
- Volleyball
- Rugby
- Cricket
- Golf
- Lacrosse
- Combat Sports
- Motorsports
- Future sports through the adapter contract

## Core loop

WATCH → UNDERSTAND → DOCUMENT → MODEL → GENERATE SCENARIOS → SIMULATE → IDENTIFY WIN PATHS → EXPLAIN → COACH DECIDES → EVALUATE → LEARN

## Architecture

```text
COACHING AI
├── Capture
├── Video Perception
├── Event Reconstruction
├── Game State
├── Player Intelligence
├── Team Intelligence
├── Opponent Intelligence
├── Tactical Intelligence
├── Coach Model
├── Scenario Engine
├── Simulation Engine
├── Win-Path Engine
├── Counterfactual Engine
├── Evidence Ledger
├── Game Notebook
├── Practice Intelligence
├── Reporting
└── Coach Command Center

SPORT ADAPTERS
├── Basketball
├── American Football
├── Soccer
├── Baseball
├── Ice Hockey
├── Tennis
└── Additional sports
```

## Design invariants

1. Observation, inference, hypothesis, and simulation remain distinct.
2. Every important conclusion is traceable to evidence and, where applicable, video timestamps.
3. Simulations are reproducible from the same state, model version, scenario, evidence set, and seed.
4. The simulation engine does not invent observed reality; assumptions are explicit inputs.
5. Sport-specific logic lives behind adapter contracts.
6. The coach remains the decision authority.
7. No betting, sportsbook, financial execution, or Money Core logic belongs in this repository.

## Central primitive

`CoachingScenario` is the core commercial domain object. It combines current game state, coaching objective, intervention, constraints, assumptions, evidence, expected opponent responses, simulation distributions, win paths, failure paths, counter paths, robustness, provenance, and post-game evaluation.

## Build sequence

- B-01 Universal Sports Domain Core
- B-02 Sport Adapter Contract
- B-03 Evidence Ledger + Provenance
- B-04 Game Notebook
- B-05 Player / Team / Opponent Intelligence
- B-06 CoachingScenario Engine
- B-07 Deterministic Simulation Kernel
- B-08 Win-Path Engine
- B-09 Adaptive Opponent / Counter Engine
- B-10 Scenario Evaluation + Learning Loop
- B-11 Coach Command Center
- B-12 Video Evidence Integration
- B-13 Practice Intelligence
- B-14 Live Game Mode
