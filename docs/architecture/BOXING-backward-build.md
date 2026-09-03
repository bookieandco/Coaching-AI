# Boxing — Backward Build Strategy

Boxing is the first concrete sport because it gives Coaching AI a clean way to work backwards from the Sports Prediction intelligence stack.

## Principle

Do not build a separate coaching intelligence stack from scratch.

Start with the predictive intelligence required to understand a fight, then add the coaching counterfactual layer on top:

`DATA → FIGHT STATE → FIGHTER MODEL → MATCHUP MODEL → TACTICAL MODEL → BASELINE OUTLOOK → INTERVENTION → OPPONENT RESPONSE → COUNTER → SCENARIO → COACH DECISION → OUTCOME → LEARNING`

## Shared Intelligence We Want From Prediction

The prediction system's reusable intelligence layer should eventually provide:

- fighter identity and historical profile
- opponent-adjusted form
- style/archetype representation
- offensive and defensive tendencies
- punch volume, accuracy, target selection and defensive response
- round-by-round performance
- pace and output changes
- power/impact indicators
- durability and recovery indicators
- stance and distance relationships
- activity and inactivity effects
- matchup interactions
- contextual factors
- uncertainty and evidence quality
- historical analogs
- live state updates
- baseline outcome distributions
- model calibration and evaluation

The coaching product consumes these as **state and evidence**, not as a final betting/prediction answer.

## Boxing-Specific Coaching Questions

The first coaching implementation should answer questions such as:

- What changes if Fighter A increases pressure?
- What happens if A stops chasing the knockout and wins exchanges at range?
- How does B respond to increased body work?
- Which defensive adjustment reduces B's best offensive sequence?
- If B adapts to the first adjustment, what is A's next counter?
- Which plan is most robust across plausible opponent responses?
- What failed assumptions should be reviewed after the round?

## Boxing State

The minimum live state needs:

- round and round clock
- fighters
- stance
- distance/range
- position/orientation
- recent exchanges
- punch attempts and landed actions
- target areas
- defensive actions
- clinch state
- knockdown/standing-count state where applicable
- cumulative workload/fatigue signals
- damage/impact signals with uncertainty
- tactical mode
- corner intervention history
- evidence references

## Tactical Intervention Vocabulary

Initial intervention families:

- increase/decrease pressure
- change distance
- change lead-hand activity
- increase body attacks
- change target priority
- change combination length
- change exit direction
- alter defensive shell/guard
- increase countering
- reduce exchange frequency
- force clinch/reset where legal
- attack after opponent's predictable action
- change tempo

These are scenario controls, not universal boxing ratings.

## Prediction → Coaching Boundary

The prediction layer may produce:

`Baseline: B currently has the stronger expected outcome under the observed state.`

The coaching layer then asks:

`What interventions could move the state toward A's preferred outcomes, and how might B respond?`

Therefore a prediction is an input to scenario generation, never the scenario itself.

## Build Order

1. Boxing adapter and canonical fight state.
2. Prediction-derived fighter feature contract.
3. Evidence-backed fighter/matchup model.
4. Tactical intervention vocabulary.
5. Counterfactual state transition engine.
6. Opponent response model.
7. Win-path generation.
8. Scenario simulation and robustness analysis.
9. Round/corner review loop.
10. Coach-facing fight plan and live adjustment interface.

## Generalization

After boxing works, the same architecture should be lifted back into the universal sports layer. Boxing-specific concepts remain in the boxing adapter; reusable concepts such as readiness, tendencies, matchup interactions, evidence, intervention, response, and scenario evaluation remain universal.
