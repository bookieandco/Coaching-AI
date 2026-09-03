import type { Event, EvidenceRef, GameState, SportAdapter } from "@coaching-ai/sports-core";
import { boxingAdapter } from "./index";
import { ingestBoxingVideoEvidence, type BoxingVideoEvidenceBatch, type BoxingVideoEvidenceResult } from "./video-evidence";
import { buildBoxingCoachCommandCenter, type BoxingCoachCommandCenterInput, type BoxingCoachDashboardState } from "./coach-command-center";
import type { BoxingScenario } from "./tactical-scenarios";
import type { BoxingWinPathReport } from "./win-path-engine";
import type { BoxingScenarioEvaluation } from "./scenario-learning";
import type { BoxingAdaptiveState } from "./adaptive-opponent";

export interface BoxingLiveEventEnvelope {
  event: Event;
  receivedAt: string;
  evidenceRefs: EvidenceRef[];
}

export interface BoxingLiveStateSnapshot {
  state: GameState;
  updatedAt: string;
  sourceEventId?: string;
  sourceEvidenceRefs: EvidenceRef[];
}

export interface BoxingLiveModeConfig {
  modelVersion?: string;
  staleAfterMs?: number;
  minimumVideoConfidence?: number;
}

export interface BoxingLiveModeInput {
  state: GameState;
  scenarios: BoxingScenario[];
  events?: BoxingLiveEventEnvelope[];
  videoBatches?: BoxingVideoEvidenceBatch[];
  pathReports?: Record<string, BoxingWinPathReport>;
  evaluations?: Record<string, BoxingScenarioEvaluation>;
  adaptiveOpponent?: BoxingAdaptiveState;
  baselineContext?: Record<string, unknown>;
  now?: string;
  stateObservedAt?: string;
}

export interface BoxingLiveModeResult {
  state: GameState;
  dashboard: BoxingCoachDashboardState;
  videoEvidence: BoxingVideoEvidenceResult[];
  appliedEvents: string[];
  rejectedEvents: Array<{ eventId: string; errors: string[] }>;
  provenance: {
    engineVersion: string;
    sourceStateVersion: number;
  };
}

const ENGINE_VERSION = "boxing-live-mode-v1";

/**
 * Coordinates live evidence and canonical event application. It intentionally
 * does not perform computer vision, choose coaching actions, or mutate scenario
 * models. Perception creates evidence; the boxing adapter remains the canonical
 * state transition boundary; the command center is a read-model projection.
 */
export function processBoxingLiveMode(
  input: BoxingLiveModeInput,
  config: BoxingLiveModeConfig = {},
  adapter: SportAdapter = boxingAdapter,
): BoxingLiveModeResult {
  let state = input.state;
  const videoEvidence = (input.videoBatches ?? []).map((batch) =>
    ingestBoxingVideoEvidence(batch, {
      minimumObservationConfidence: config.minimumVideoConfidence,
    }),
  );

  const appliedEvents: string[] = [];
  const rejectedEvents: Array<{ eventId: string; errors: string[] }> = [];

  const events = [...(input.events ?? [])].sort(
    (a, b) => (a.event.timestampMs ?? Number.MAX_SAFE_INTEGER) - (b.event.timestampMs ?? Number.MAX_SAFE_INTEGER)
      || a.event.eventId.localeCompare(b.event.eventId),
  );

  for (const envelope of events) {
    if (envelope.event.eventId === undefined) {
      rejectedEvents.push({ eventId: "unknown", errors: ["Live event is missing eventId."] });
      continue;
    }
    const transition = adapter.applyEvent(state, {
      ...envelope.event,
      evidenceRefs: dedupeEvidence([...envelope.event.evidenceRefs, ...envelope.evidenceRefs]),
    });
    const validation = adapter.validateState(transition.state);
    if (!validation.valid) {
      rejectedEvents.push({
        eventId: String(envelope.event.eventId),
        errors: validation.errors.map((error) => `${error.code}: ${error.message}`),
      });
      continue;
    }
    state = transition.state;
    appliedEvents.push(String(envelope.event.eventId));
  }

  const allVideoRefs = videoEvidence.flatMap((result) => result.evidenceRefs);
  if (allVideoRefs.length > 0) {
    state = {
      ...state,
      evidenceRefs: dedupeEvidence([...state.evidenceRefs, ...allVideoRefs]),
    };
  }

  const dashboardInput: BoxingCoachCommandCenterInput = {
    state,
    scenarios: input.scenarios,
    pathReports: input.pathReports,
    evaluations: input.evaluations,
    adaptiveOpponent: input.adaptiveOpponent,
    baselineContext: input.baselineContext,
    now: input.now,
    stateObservedAt: input.stateObservedAt ?? input.now,
  };

  const dashboard = buildBoxingCoachCommandCenter(dashboardInput, {
    modelVersion: config.modelVersion,
    staleAfterMs: config.staleAfterMs,
  });

  return {
    state,
    dashboard,
    videoEvidence,
    appliedEvents,
    rejectedEvents,
    provenance: {
      engineVersion: ENGINE_VERSION,
      sourceStateVersion: state.stateVersion,
    },
  };
}

export function applyBoxingLiveEvent(
  state: GameState,
  envelope: BoxingLiveEventEnvelope,
  adapter: SportAdapter = boxingAdapter,
): GameState {
  const transition = adapter.applyEvent(state, {
    ...envelope.event,
    evidenceRefs: dedupeEvidence([...envelope.event.evidenceRefs, ...envelope.evidenceRefs]),
  });
  const validation = adapter.validateState(transition.state);
  if (!validation.valid) {
    throw new Error(validation.errors.map((error) => `${error.code}: ${error.message}`).join("; "));
  }
  return transition.state;
}

function dedupeEvidence(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.evidenceId)) return false;
    seen.add(ref.evidenceId);
    return true;
  });
}
