# B-12 — Boxing Video Evidence Integration

## Purpose

B-12 establishes the evidence boundary between fight video perception and the canonical boxing intelligence stack.

Video is an evidence source, not a competing source of truth. Perception systems may detect punches, movement, defensive actions, clinches, exchanges, ring position, and stance, but canonical events/state remain owned by the event/state pipeline.

## Flow

`VIDEO SOURCE → PERCEPTION ADAPTER → VIDEO OBSERVATIONS → EVIDENCE REFS → EVENT CANDIDATES → VALIDATION/ALIGNMENT → CANONICAL EVENT PIPELINE → GAME STATE`

## Contracts

`video-evidence.ts` provides:

- video source metadata
- timecode/frame references
- typed observation candidates
- confidence thresholds
- event-candidate validation
- evidence deduplication
- temporal event alignment
- state evidence attachment
- extractor provenance

## Evidence semantics

Video-derived claims remain traceable to the source and timecode. The system must preserve the distinction between:

- observed video evidence
- inferred tactical interpretation
- simulated scenario output
- hypothetical coaching intervention

A video detector's confidence is not treated as truth or as a calibrated game probability.

## Source-of-truth rule

`GameState` is never silently mutated by video ingestion. Video evidence is attached to state and event candidates are passed through the canonical event pipeline. This prevents duplicate ledgers and allows later correction/reconciliation when multiple feeds disagree.

## Reconciliation

Future perception work should support:

1. multi-camera observation clustering
2. event candidate deduplication
3. timecode synchronization
4. conflicting-observation retention
5. human annotation/override
6. detector version comparison
7. replay evidence links
8. event-to-video backreferences

Conflicts must remain auditable rather than being overwritten.

## B-12 acceptance criteria

- Every retained video observation has a source and timecode.
- Low-confidence observations can be filtered without deleting source provenance.
- Event candidates reference the observation that produced them.
- Temporal alignment is explicit and bounded.
- Video ingestion does not become a second event/state database.
- Extractor/model provenance is retained.
- The architecture can later accept CV/pose/tracking adapters without changing canonical domain contracts.
