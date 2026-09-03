# B-17 — Tennis Reference Stack Audit

## Purpose

Use the four supplied repositories as implementation references for the Tennis coaching stack without copying their architecture wholesale. The canonical Coaching-AI boundary remains:

`OBSERVATION → EVENT → GAME STATE → INTELLIGENCE → SCENARIO → SIMULATION → WIN PATH → COACH DECISION`

## Reference 1 — tennis-slams-tracker

The tracker demonstrates a strong operational data-ingestion pattern: scheduled refreshes, append-only historical archives, merge-only writes, explicit source attribution, fail-safe behavior, and no fabrication when a source is missing. It consumes ESPN's public tennis feeds for scores/draws/rankings and preserves completed Slam data in JSON archives. citeturn0search0

### Borrow
- Scheduled source adapters.
- Historical append-only match/edition memory.
- Source-aware match/player identifiers.
- Fail-safe ingestion: stale/empty upstream data must not erase good data.
- Explicit separation between live feed and durable history.
- Doubles-aware source parsing as a future requirement.

### Do not borrow
- Static-page architecture as the Coaching-AI runtime architecture.
- Market prices as coaching evidence.
- Browser-local state as authoritative game state.

## Reference 2 — Match Point AI

Match Point AI frames tennis strategy evaluation as a simulation problem and exposes rally objects, scoring, Monte Carlo Tree Search agents, a rally tree, and match simulation. Its README explicitly identifies MCTS, rally/scoring objects, and simulation as the core experimental components. fileciteturn47file0

The rally layer is useful because it preserves the ordered shot sequence until a terminal shot closes the rally; the rally-tree implementation also records visits, wins, UCT values and point-win rates for search. fileciteturn53file0 fileciteturn54file0

### Borrow
- Ordered rally representation.
- Shot-by-shot branching.
- Search tree statistics.
- MCTS as an optional scenario-search backend.
- Simulation experiments comparing fixed and adaptive strategies.

### Change for Coaching-AI
- Search nodes must reference canonical `GameState` versions rather than mutable UI/game objects.
- UCT/search values are simulation/search metrics, never observed facts.
- A search branch becomes a `Scenario` only when an explicit intervention and assumptions are attached.
- Search output must preserve provenance, seed, model/ruleset versions and evidence references.

## Reference 3 — TDASS

TDASS is not a sports system; it is a tactical simulation architecture with an environment, stateful neural inference, a what-if simulator, an action scorer, feasibility/risk evaluation, and an adversarial state machine. Its documented flow is state → prediction → tactical brain → next state. fileciteturn48file0

### Borrow conceptually
- Explicit environment/state boundary.
- Stateful inference over a rolling history.
- What-if simulation as a separate component.
- Adversarial response modeling.
- Feasibility/risk as a separate evaluation layer.

### Reject
- Autonomous action selection for coaching.
- Military-domain semantics.
- Treating an oracle prediction as the decision itself.

For Tennis, this becomes:

`CURRENT MATCH STATE → BASELINE INTELLIGENCE → WHAT-IF INTERVENTION → OPPONENT RESPONSE → COUNTERFACTUAL STATE → SIMULATION → COACH REVIEW`

## Reference 4 — Tennis-Vision

Tennis-Vision provides the strongest evidence-first video reference. It reconstructs ball position, court geometry, player tracks, shot events and 3-D trajectories from a single broadcast camera. Its central design rule is that measurements retain evidence and unsupported measurements are withheld or marked unknown. It also uses explicit validity gates before downstream real-world measurements. fileciteturn49file0

### Borrow
- Ball tracking.
- Court keypoint detection and homography.
- Player tracking.
- Contact/bounce event candidates.
- Serve detection from independently measurable conditions.
- 3-D trajectory reconstruction.
- Evidence-carrying measurements.
- Confidence/validity gates.
- Evaluation funnels that distinguish detector availability from actual accuracy.
- Explicit model/backend provenance.

### Do not collapse
Computer-vision observations must remain `OBSERVED` evidence. Shot type, tactical meaning, fatigue interpretation and strategic explanation are downstream inference/hypothesis layers.

## Integrated Tennis Coaching Stack

The references now map into Coaching-AI as follows:

`LIVE/ARCHIVE DATA`
→ tennis-slams ingestion + durable match history

`VIDEO PERCEPTION`
→ Tennis-Vision-style ball/court/player/event observations

`POINT / RALLY RECONSTRUCTION`
→ ordered rally + terminal point semantics

`CANONICAL TENNIS STATE`
→ Coaching-AI Tennis Adapter

`PLAYER INTELLIGENCE`
→ serve / return / rally / movement / pressure / surface / fatigue profiles

`MATCHUP MODEL`
→ player-vs-player interaction features

`TACTICAL SCENARIO ENGINE`
→ explicit intervention candidates

`ADVERSARIAL RESPONSE MODEL`
→ opponent adaptation branches

`COUNTERFACTUAL + MCTS SIMULATION`
→ deterministic scenario search and trajectory generation

`WIN-PATH ENGINE`
→ plausible successful and failure paths, not predictions

`EVIDENCE LEDGER`
→ every observation/inference/simulation keeps provenance

`COACH COMMAND CENTER`
→ presents evidence, scenarios, risks and alternatives; coach remains decision-maker

## Immediate Build Consequence

The Tennis adapter's scoring/state machine is now isolated in `src/scoring.ts` and the adapter has been hardened around singles semantics, including deuce/advantage, set completion, 6–6 tiebreak entry, tiebreak completion and match completion. The current reference adapter deliberately rejects four-participant doubles states until a team-aware participant model is added.

The next Tennis implementation layer is therefore **B-18 Point/Rally Reconstruction + Player Intelligence Foundation**, using the evidence-first principles from Tennis-Vision and the rally/search abstractions from Match Point AI.
