import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { TennisTacticalInterventionType, TennisOpponentResponse } from "./tactical-scenarios";

export type TennisAdaptiveEvidenceSource = "observed" | "simulated";

export interface TennisAdaptiveObservation {
  observationId: string;
  initiatorParticipantId: string;
  opponentParticipantId: string;
  interventionType: TennisTacticalInterventionType;
  responseType: string;
  effectiveness: number;
  source: TennisAdaptiveEvidenceSource;
  surface?: string;
  phase?: "game" | "set" | "tiebreak" | "match";
  step?: number;
  evidenceRefs: EvidenceRef[];
}

export interface TennisAdaptiveResponseWeight {
  responseType: string;
  priorWeight: number;
  observedEvidence: number;
  adaptiveWeight: number;
  exposureCount: number;
  lastObservedStep?: number;
}

export interface TennisAdaptiveState {
  initiatorParticipantId: string;
  opponentParticipantId: string;
  interventionExposures: Record<string, number>;
  responses: TennisAdaptiveResponseWeight[];
  uncertainty: number;
  evidenceRefs: EvidenceRef[];
}

export interface TennisAdaptationRule {
  exposureDecay: number;
  evidenceGain: number;
  effectivenessGain: number;
  adaptationPressure: number;
  minimumWeight: number;
  maximumWeight: number;
  simulatedEvidenceFactor: number;
}

export interface TennisAdaptiveBranch {
  responseType: string;
  relativeWeight: number;
  adaptationDelta: number;
  reason: string;
  evidenceRefs: EvidenceRef[];
}

export interface TennisAdaptiveOpponentConfig {
  modelVersion?: string;
  rule?: Partial<TennisAdaptationRule>;
}

export interface TennisAdaptiveOpponentResult {
  state: TennisAdaptiveState;
  branches: TennisAdaptiveBranch[];
  uncertainty: number;
  provenance: { engineVersion: string; modelVersion: string; source: "inferred" };
}

export const DEFAULT_TENNIS_ADAPTATION_RULE: TennisAdaptationRule = {
  exposureDecay: 0.9,
  evidenceGain: 1,
  effectivenessGain: 0.75,
  adaptationPressure: 0.2,
  minimumWeight: 0.05,
  maximumWeight: 4,
  simulatedEvidenceFactor: 0.35,
};

function ruleFor(config?: TennisAdaptiveOpponentConfig): TennisAdaptationRule {
  return { ...DEFAULT_TENNIS_ADAPTATION_RULE, ...(config?.rule ?? {}) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function exposureKey(observation: TennisAdaptiveObservation): string {
  return `${observation.interventionType}:${observation.surface ?? "any"}:${observation.phase ?? "any"}`;
}

function dedupeEvidence(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.evidenceId)) return false;
    seen.add(ref.evidenceId);
    return true;
  });
}

function evidenceStrength(observation: TennisAdaptiveObservation, rule: TennisAdaptationRule): number {
  return observation.source === "observed" ? 1 : rule.simulatedEvidenceFactor;
}

export function createInitialTennisAdaptiveState(
  initiatorParticipantId: string,
  opponentParticipantId: string,
  candidateResponses: TennisOpponentResponse[],
): TennisAdaptiveState {
  const responses = candidateResponses
    .map((response) => ({
      responseType: response.type,
      priorWeight: clamp(response.relativeWeight, DEFAULT_TENNIS_ADAPTATION_RULE.minimumWeight, DEFAULT_TENNIS_ADAPTATION_RULE.maximumWeight),
      observedEvidence: 0,
      adaptiveWeight: clamp(response.relativeWeight, DEFAULT_TENNIS_ADAPTATION_RULE.minimumWeight, DEFAULT_TENNIS_ADAPTATION_RULE.maximumWeight),
      exposureCount: 0,
    }))
    .sort((a, b) => a.responseType.localeCompare(b.responseType));

  return {
    initiatorParticipantId,
    opponentParticipantId,
    interventionExposures: {},
    responses,
    uncertainty: responses.length > 0 ? 0.75 : 1,
    evidenceRefs: [],
  };
}

export function updateTennisAdaptiveOpponent(
  current: TennisAdaptiveState,
  observation: TennisAdaptiveObservation,
  candidateResponses: TennisOpponentResponse[],
  config?: TennisAdaptiveOpponentConfig,
): TennisAdaptiveOpponentResult {
  const rule = ruleFor(config);
  if (observation.initiatorParticipantId !== current.initiatorParticipantId || observation.opponentParticipantId !== current.opponentParticipantId) {
    throw new Error("Adaptive observation participants do not match adaptive state");
  }
  if (!Number.isFinite(observation.effectiveness) || observation.effectiveness < 0 || observation.effectiveness > 1) {
    throw new Error("Adaptive observation effectiveness must be between 0 and 1");
  }

  const strength = evidenceStrength(observation, rule);
  const key = exposureKey(observation);
  const exposures = { ...current.interventionExposures };
  exposures[key] = (exposures[key] ?? 0) * rule.exposureDecay + strength;

  const candidateTypes = [...new Set(candidateResponses.map((r) => r.type))].sort();
  const existing = new Map(current.responses.map((r) => [r.responseType, r]));
  const nextResponses = candidateTypes.map((type) => {
    const candidate = candidateResponses.find((r) => r.type === type)!;
    const previous = existing.get(type);
    const priorWeight = previous?.priorWeight ?? candidate.relativeWeight;
    const priorAdaptive = previous?.adaptiveWeight ?? candidate.relativeWeight;
    const priorEvidence = previous?.observedEvidence ?? 0;
    const priorExposure = previous?.exposureCount ?? 0;

    let adaptiveWeight = priorAdaptive;
    let observedEvidence = priorEvidence;
    let lastObservedStep = previous?.lastObservedStep;

    if (type === observation.responseType) {
      const gain = rule.evidenceGain * strength * (0.5 + observation.effectiveness * rule.effectivenessGain);
      adaptiveWeight += gain;
      observedEvidence += strength;
      lastObservedStep = observation.step;
    } else {
      adaptiveWeight -= rule.adaptationPressure * strength * 0.1;
    }

    return {
      responseType: type,
      priorWeight,
      observedEvidence,
      adaptiveWeight: clamp(adaptiveWeight, rule.minimumWeight, rule.maximumWeight),
      exposureCount: priorExposure + (type === observation.responseType ? 1 : 0),
      ...(lastObservedStep === undefined ? {} : { lastObservedStep }),
    };
  });

  const refs = dedupeEvidence([
    ...current.evidenceRefs,
    ...observation.evidenceRefs,
  ]);
  const uncertainty = observation.source === "observed"
    ? Math.max(0.1, current.uncertainty * 0.9)
    : Math.min(1, current.uncertainty * 0.98 + 0.02);

  const branches = nextResponses
    .map((response) => ({
      responseType: response.responseType,
      relativeWeight: response.adaptiveWeight,
      adaptationDelta: response.adaptiveWeight - response.priorWeight,
      reason: response.responseType === observation.responseType
        ? `${observation.source} evidence observed for this response to ${observation.interventionType}`
        : "preserved as an alternative response branch",
      evidenceRefs: refs,
    }))
    .sort((a, b) => b.relativeWeight - a.relativeWeight || a.responseType.localeCompare(b.responseType));

  const state: TennisAdaptiveState = {
    initiatorParticipantId: current.initiatorParticipantId,
    opponentParticipantId: current.opponentParticipantId,
    interventionExposures: exposures,
    responses: nextResponses.sort((a, b) => a.responseType.localeCompare(b.responseType)),
    uncertainty,
    evidenceRefs: refs,
  };

  return {
    state,
    branches,
    uncertainty,
    provenance: {
      engineVersion: "tennis-adaptive-opponent-v1",
      modelVersion: config?.modelVersion ?? "tennis-adaptive-model-v1",
      source: "inferred",
    },
  };
}

export function adaptiveResponsesForScenario(
  candidateResponses: TennisOpponentResponse[],
  adaptiveState?: TennisAdaptiveState,
): TennisOpponentResponse[] {
  if (!adaptiveState) return candidateResponses;
  const weights = new Map(adaptiveState.responses.map((r) => [r.responseType, r.adaptiveWeight]));
  return candidateResponses.map((response) => ({
    ...response,
    relativeWeight: weights.get(response.type) ?? response.relativeWeight,
    uncertainty: Math.min(1, response.uncertainty + adaptiveState.uncertainty * 0.15),
    evidenceRefs: dedupeEvidence([...response.evidenceRefs, ...adaptiveState.evidenceRefs]),
  }));
}
