import type { EvidenceRef, Event, GameState } from "@coaching-ai/sports-core";

export type BoxingVideoEvidenceKind =
  | "fight_video"
  | "replay"
  | "corner_camera"
  | "broadcast_feed"
  | "tracking_overlay";

export interface BoxingVideoSource {
  sourceId: string;
  kind: BoxingVideoEvidenceKind;
  uri: string;
  durationMs?: number;
  frameRate?: number;
  observedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface BoxingVideoTimecode {
  startMs: number;
  endMs?: number;
  frame?: number;
}

export interface BoxingVideoObservation {
  observationId: string;
  sourceId: string;
  timecode: BoxingVideoTimecode;
  observationType:
    | "punch"
    | "defensive_action"
    | "movement"
    | "clinch"
    | "ring_position"
    | "stance"
    | "exchange"
    | "unknown";
  actorParticipantId?: string;
  targetParticipantId?: string;
  attributes: Record<string, unknown>;
  confidence: number;
  evidenceRef: EvidenceRef;
}

export interface BoxingVideoEventCandidate {
  observationId: string;
  event: Event;
  confidence: number;
  evidenceRef: EvidenceRef;
}

export interface BoxingVideoEvidenceBatch {
  source: BoxingVideoSource;
  observations: BoxingVideoObservation[];
  eventCandidates: BoxingVideoEventCandidate[];
  stateVersion?: number;
  provenance: {
    extractorVersion: string;
    sourceHash?: string;
  };
}

export interface BoxingVideoEvidenceConfig {
  extractorVersion?: string;
  minimumObservationConfidence?: number;
  maxTimeSkewMs?: number;
}

export interface BoxingVideoEvidenceResult {
  source: BoxingVideoSource;
  observations: BoxingVideoObservation[];
  eventCandidates: BoxingVideoEventCandidate[];
  evidenceRefs: EvidenceRef[];
  validation: {
    valid: boolean;
    errors: string[];
  };
  provenance: BoxingVideoEvidenceBatch["provenance"];
}

/**
 * Normalizes already-extracted video observations into evidence objects.
 * This layer deliberately does not perform computer vision itself and does not
 * mutate canonical GameState. A later perception adapter can produce the raw
 * observations; the event pipeline remains the source of truth.
 */
export function ingestBoxingVideoEvidence(
  batch: BoxingVideoEvidenceBatch,
  config: BoxingVideoEvidenceConfig = {},
): BoxingVideoEvidenceResult {
  const minimumConfidence = config.minimumObservationConfidence ?? 0.5;
  const maxTimeSkew = config.maxTimeSkewMs ?? 250;
  const errors: string[] = [];

  if (!batch.source.sourceId) errors.push("Video source must have a sourceId.");
  if (!batch.source.uri) errors.push("Video source must have a uri.");

  const observations = batch.observations
    .filter((observation) => observation.confidence >= minimumConfidence)
    .filter((observation) => validTimecode(observation.timecode))
    .sort((a, b) => a.timecode.startMs - b.timecode.startMs || a.observationId.localeCompare(b.observationId));

  for (const candidate of batch.eventCandidates) {
    if (!batch.observations.some((observation) => observation.observationId === candidate.observationId)) {
      errors.push(`Event candidate ${candidate.event.eventId} references an unknown observation.`);
    }
    if (candidate.confidence < minimumConfidence) {
      errors.push(`Event candidate ${candidate.event.eventId} is below the confidence threshold.`);
    }
  }

  if (batch.stateVersion !== undefined && batch.stateVersion < 0) {
    errors.push("stateVersion cannot be negative.");
  }

  const evidenceRefs = dedupeEvidence(observations.map((observation) => observation.evidenceRef));
  const eventCandidates = batch.eventCandidates.filter((candidate) => candidate.confidence >= minimumConfidence);

  return {
    source: batch.source,
    observations,
    eventCandidates,
    evidenceRefs,
    validation: { valid: errors.length === 0, errors },
    provenance: {
      extractorVersion: config.extractorVersion ?? batch.provenance.extractorVersion,
      sourceHash: batch.provenance.sourceHash,
    },
  };
}

export function attachVideoEvidenceToState(
  state: GameState,
  result: BoxingVideoEvidenceResult,
): GameState {
  const refs = dedupeEvidence([...state.evidenceRefs, ...result.evidenceRefs]);
  return { ...state, evidenceRefs: refs };
}

export function alignVideoObservationToEvent(
  observation: BoxingVideoObservation,
  event: Event,
  maxTimeSkewMs = 250,
): boolean {
  if (event.timestampMs === undefined) return false;
  return Math.abs(event.timestampMs - observation.timecode.startMs) <= maxTimeSkewMs;
}

function validTimecode(timecode: BoxingVideoTimecode): boolean {
  return Number.isFinite(timecode.startMs)
    && timecode.startMs >= 0
    && (timecode.endMs === undefined || timecode.endMs >= timecode.startMs);
}

function dedupeEvidence(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = JSON.stringify(ref);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
