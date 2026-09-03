# B-02 — Sport Adapter Contract

## Objective

Define the boundary between the sport-agnostic Coaching AI core and sport-specific rules, semantics, event vocabularies, spatial models, scoring, clocks, and tactical structures.

The universal core must not know how a sport works. It asks an adapter to interpret a sport.

## Design Rule

> If a rule can differ between sports, it belongs behind the adapter boundary.

The core owns stable concepts such as `GameState`, `Action`, `Event`, `StateTransition`, `Scenario`, and `Evidence`. The adapter owns how those concepts are instantiated and validated for a sport.

## Adapter Responsibilities

Every adapter must provide:

1. **Identity** — sport code, display name, ruleset version.
2. **Participants** — teams, individuals, pairings, lineups, roles, and availability semantics.
3. **Game lifecycle** — phases, periods/innings/sets/rounds, start/end conditions.
4. **Clock model** — timed, untimed, turn-based, round-based, or continuous time.
5. **Control model** — possession, turn, rally, shared control, or continuous control.
6. **Scoring model** — legal scoring actions and score transitions.
7. **Event vocabulary** — canonical sport events and normalization of source events.
8. **Action vocabulary** — legal/meaningful actions that can appear in scenarios.
9. **Spatial model** — coordinates, zones, surfaces, lanes, tracks, or no spatial model.
10. **Tactical model** — formations, roles, rotations, matchups, phases, and tactical patterns where applicable.
11. **Substitution/roster model** — substitutions, rotations, replacements, or participant changes.
12. **State validation** — determine whether a proposed state is legal under the ruleset.
13. **State transition** — deterministically apply a canonical event/action to a state.
14. **Terminal evaluation** — determine whether a game/contest is complete and why.

## Contract Shape

```ts
interface SportAdapter {
  metadata(): SportMetadata;
  createInitialState(input: InitialStateInput): GameState;
  normalizeEvent(input: RawSportEvent): Event;
  normalizeAction(input: RawSportAction): Action;
  applyEvent(state: GameState, event: Event): StateTransition;
  applyAction(state: GameState, action: Action): StateTransition;
  validateState(state: GameState): ValidationResult;
  legalActions(context: ActionContext): ActionDefinition[];
  scoreTransition(context: ScoreContext): ScoreTransition;
  gamePhase(state: GameState): GamePhase;
  controlState(state: GameState): ControlState;
  isTerminal(state: GameState): TerminalResult;
  capabilities(): SportCapabilities;
}
```

The concrete implementation language may evolve, but the semantic contract is fixed independently of transport, UI, database, or model provider.

## Capability Model

Adapters declare capabilities rather than forcing every sport into the same shape.

```ts
interface SportCapabilities {
  hasTeams: boolean;
  hasPossession: boolean;
  hasClock: boolean;
  hasSpatialModel: boolean;
  hasLineups: boolean;
  hasSubstitutions: boolean;
  hasPeriods: boolean;
  hasSets: boolean;
  hasRounds: boolean;
  hasInnings: boolean;
  hasContinuousPlay: boolean;
  supportsTacticalFormation: boolean;
  supportsPlayerTracking: boolean;
  supportsObjectTracking: boolean;
}
```

This prevents the universal layer from assuming that every contest has a scoreboard, possession, five players, a clock, or a team formation.

## Sport-Family Challenge Set

The contract is deliberately tested against structurally different sports:

| Sport | Primary challenge |
|---|---|
| Basketball | timed team sport, possession, substitutions, spatial tactics |
| American Football | discrete plays, downs, field position, personnel packages |
| Soccer | continuous play, possession ambiguity, spatial tactics |
| Baseball | innings, at-bat state, asymmetric offense/defense, no conventional possession |
| Ice Hockey | timed continuous play, line changes, possession/control |
| Tennis | individual/pair contest, points/games/sets, rally control |
| Volleyball | rally scoring, rotations, sets, no continuous game clock |
| Rugby | continuous play, phases, territory, possession/control ambiguity |
| Cricket | innings, overs, wickets, batter/bowler state |
| Golf | stroke-based contest, holes/rounds, minimal shared possession |
| Lacrosse | team sport, possession, substitutions, spatial tactics |
| Combat Sports | individual contest, rounds, judging/finish conditions |
| Motorsports | continuous movement, laps, positions, pit strategy, no possession |

A sport adapter is complete only when the universal core can represent its game state and transitions without adding sport-specific fields to the core domain model.

## Forbidden Leakage

The universal core must not contain:

- basketball-only possession semantics
- football downs or yardage
- baseball innings or wickets
- soccer formations as universal fields
- tennis sets as universal clock state
- motorsport laps as a universal requirement
- sport-specific scoring constants
- sport-specific tactical vocabulary

These belong to adapter implementations and ruleset versions.

## Scenario Compatibility

The adapter must expose enough semantics for the scenario engine to construct:

`CURRENT STATE → INTERVENTION → OPPONENT RESPONSE → COUNTER → STATE TRANSITION → OUTCOME`

An intervention may be sport-specific, but its core representation remains universal. For example:

- basketball: change defensive coverage
- football: change personnel/package or play-call family
- soccer: change press intensity/shape
- baseball: alter pitcher/batter strategy
- tennis: target a return pattern
- motorsport: alter pit strategy

The universal Scenario object stores the intervention and assumptions without understanding the sport-specific meaning.

## Determinism Requirement

Adapter operations used by simulation must be deterministic for identical:

- ruleset version
- input state
- event/action
- configuration

Randomness belongs to the simulation layer and must never be hidden inside `applyEvent`, `applyAction`, or validation.

## Versioning

Every adapter exposes a ruleset version. A scenario and simulation run must retain that version so historical analysis can be replayed against the exact semantics that produced it.

## Acceptance Criteria

B-02 is complete when:

- the contract is defined independently of any single sport;
- basketball, American football, soccer, baseball, hockey, and tennis can implement it without core changes;
- volleyball, rugby, cricket, golf, lacrosse, combat sports, and motorsports expose their differences through capabilities rather than core exceptions;
- state transitions are deterministic;
- ruleset versioning is explicit;
- scenario interventions can cross the adapter boundary cleanly;
- no sport-specific scoring/clock/possession assumptions leak into the universal core.

## Next

B-03 builds the Evidence Ledger + Provenance layer. Every observation, inference, hypothesis, scenario assumption, simulation input, and outcome will be traceable to evidence and versioned state.
