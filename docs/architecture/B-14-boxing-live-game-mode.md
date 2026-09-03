# B-14 — Boxing Live Game Mode

## Objective

Provide a deterministic coordination boundary for live boxing intelligence:

```text
LIVE EVIDENCE
    ↓
VIDEO / FEED PERCEPTION
    ↓
EVENT CANDIDATES
    ↓
CANONICAL EVENT VALIDATION
    ↓
GAME STATE
    ↓
COACHING READ MODEL
```

The live layer coordinates these boundaries. It does not become the source of truth for fight state and it does not choose actions for the coach.

## Responsibilities

- accept timestamped canonical event envelopes;
- deterministically order events;
- apply events through the boxing `SportAdapter`;
- validate every resulting state;
- retain evidence references;
- ingest already-extracted video evidence;
- project the resulting state through the Coach Command Center;
- surface rejected events rather than silently dropping them;
- preserve source state versions for provenance.

## Explicit non-responsibilities

B-14 does not:

- perform computer vision;
- invent fight events from raw pixels;
- directly mutate scenario models;
- execute a coaching action;
- turn model weights into real-world probabilities;
- replace the canonical event/state pipeline;
- hide conflicting or invalid events.

## Event ordering

Events are ordered by timestamp, then event ID. This provides deterministic replay for a batch. A production transport may provide stronger ordering guarantees, but the coordinator must remain deterministic when supplied the same input.

## Rejection behavior

An event is rejected when applying it produces an invalid canonical state. Rejections are returned with validation errors and are not silently incorporated into the live state.

## Video boundary

Video remains evidence. The B-12 ingestion layer produces observations and event candidates; B-14 only consumes canonical events and attaches validated evidence references. Computer-vision extraction remains replaceable.

## Freshness

The command-center projection exposes freshness using the configured observation timestamp and stale threshold. A stale state is a visible risk, not an implicit assumption that the latest model output is current.

## Replay and recovery

The coordinator is designed for later event-log replay. Given the same initial state and deterministically ordered events, the canonical adapter should produce the same state-version sequence. A future persistence layer should store event IDs, timestamps, evidence references, state versions, and adapter/ruleset versions.

## Live learning boundary

B-14 does not automatically update adaptive opponent models from every incoming event. Observations must first be classified and evaluated by the appropriate intelligence/learning layer. This prevents raw perception from becoming unvalidated learning data.

## Acceptance criteria

- canonical state changes only through `SportAdapter` transitions;
- event evidence is preserved;
- video evidence does not directly mutate tactical state;
- invalid transitions are surfaced as rejections;
- ordering is deterministic;
- dashboard freshness is explicit;
- provenance includes the resulting state version;
- no autonomous coaching execution is introduced.

## Next extension

The Boxing reference implementation is now complete through B-14. The next phase is to harden the shared sport-independent contracts and then lift the reusable intelligence layers into the universal multi-sport coaching architecture, using boxing as the first adapter rather than creating a boxing-only product silo.
