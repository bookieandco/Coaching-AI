import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { BoxingIntervention } from "./tactical-scenarios";

export interface BoxingAdaptiveObservation {
  observationId: string;
  fighterId: string;
  opponentId: string;
  interventionType: BoxingIntervention["type"];
  responseType: string;
  phase?: string;
  distance?: string;
  effectiveness: number;
  source: "observed" | "simulated";
  evidenceRefs: EvidenceRef[];
}

export interface BoxingAdaptiveResponseWeight {
  responseType: string;
  priorWeight: number;
  observedEvidence: number;
  adaptiveWeight: number;
  exposureCount: number;
  lastObservedStep?: number;
}

export interface BoxingAdaptiveState {
  fighterId: string;
  opponentId: string;
  interventionExposures: Record<string, number>;
  responses: BoxingAdaptiveResponseWeight[];
  uncertainty: number;
  evidenceRefs: EvidenceRef[];
}

export interface BoxingAdaptationRule {
  exposureDecay: number;
  evidenceGain: number;
  effectivenessGain: number;
  adaptationPressure: number;
  minimumWeight: number;
  maximumWeight: number;
}

export interface BoxingAdaptiveBranch {
  responseType: string;
  relativeWeight: number;
  adaptationDelta: number;
  reason: string;
  evidenceRefs: EvidenceRef[];
}

export interface BoxingAdaptiveCounterEngineConfig {
  modelVersion?: string;
  rule?: Partial<BoxingAdaptationRule>;
}

export interface BoxingAdaptiveCounterEngineResult {
  state: BoxingAdaptiveState;
  branches: BoxingAdaptiveBranch[];
  uncertainty: number;
  provenance: {
    engineVersion: string;
    modelVersion: string;
    updateCount: number;
  };
}

const DEFAULT_RULE: BoxingAdaptationRule = {
  exposureDecay: 0.9,
  evidenceGain: 1,
  effectivenessGain: 0.75,
  adaptationPressure: 0.2,
  minimumWeight: 0.05,
  maximumWeight: 4,
};

/**
 * Updates the opponent model after an explicit observed or simulated response.
 * Weights remain relative model weights; they are not calibrated probabilities.
 * Repeated exposure increases adaptation pressure without asserting that the
 * opponent will choose a specific response.
 */
export function updateAdaptiveOpponent(
  current: BoxingAdaptiveState | undefined,
  observation: BoxingAdaptiveObservation,
  candidateResponses: Array<{ responseType: string; weight: number; evidenceRefs: EvidenceRef[] }>,
  config: BoxingAdaptiveCounterEngineConfig = {},
): BoxingAdaptiveCounterEngineResult {
  const rule = { ...DEFAULT_RULE, ...(config.rule ?? {}) };
  const previous = current ?? createInitialAdaptiveState(observation, candidateResponses);
  const exposures = { ...previous.interventionExposures };
  const exposureKey = `${observation.interventionType}:${observation.phase ?? "any"}:${observation.distance ?? "any"}`;
  const priorExposure = exposures[exposureKey] ?? 0;
  exposures[exposureKey] = priorExposure + 1;

  const responseMap = new Map(previous.responses.map((response) => [response.responseType, { ...response }]));
  for (const candidate of candidateResponses) {
    if (!responseMap.has(candidate.responseType)) {
      responseMap.set(candidate.responseType, {
        responseType: candidate.responseType,
        priorWeight: Math.max(rule.minimumWeight, candidate.weight),
        observedEvidence: 0,
        adaptiveWeight: Math.max(rule.minimumWeight, candidate.weight),
        exposureCount: 0,
      });
    }
  }

  const target = responseMap.get(observation.responseType);
  if (target) {
    const effectiveness = clamp01(observation.effectiveness);
    target.observedEvidence += rule.evidenceGain;
    target.exposureCount += 1;
    target.lastObservedStep = priorExposure + 1;
    const learning = rule.effectivenessGain * (0.5 + effectiveness * 0.5);
    target.adaptiveWeight = clamp(
      target.adaptiveWeight * rule.exposureDecay + learning,
      rule.minimumWeight,
      rule.maximumWeight,
    );
  }

  const pressure = Math.min(1, priorExposure * rule.adaptationPressure);
  for (const response of responseMap.values()) {
    if (response.responseType === observation.responseType) continue;
    response.adaptiveWeight = clamp(
      response.adaptiveWeight * (1 - pressure * 0.05),
      rule.minimumWeight,
      rule.maximumWeight,
    );
  }

  const responses = [...responseMap.values()].sort((a, b) => a.responseType.localeCompare(b.responseType));
  const evidenceRefs = dedupeEvidence([
    ...previous.evidenceRefs,
    ...observation.evidenceRefs,
    ...candidateResponses.flatMap((candidate) => candidate.evidenceRefs),
  ]);
  const branches = responses.map((response) => ({
    responseType: response.responseType,
    relativeWeight: response.adaptiveWeight,
    adaptationDelta: response.adaptiveWeight - response.priorWeight,
    reason: response.responseType === observation.responseType
      ? `Observed ${response.responseType} after ${observation.interventionType}; adaptive weight updated.`
      : `Response weight retained with exposure-aware adaptation pressure from ${observation.interventionType}.`,
    evidenceRefs,
  }));

  const uncertainty = calculateUncertainty(responses, observation.source, previous.uncertainty);
  const state: BoxingAdaptiveState = {
    fighterId: previous.fighterId,
    opponentId: previous.opponentId,
    interventionExposures: exposures,
    responses,
    uncertainty,
    evidenceRefs,
  };

  return {
    state,
    branches,
    uncertainty,
    provenance: {
      engineVersion: "boxing-adaptive-opponent-v1",
      modelVersion: config.modelVersion ?? "boxing-adaptive-model-v1",
      updateCount: responses.reduce((sum, response) => sum + response.exposureCount, 0),
    },
  };
}

export function createInitialAdaptiveState(
  observation: BoxingAdaptiveObservation,
  candidateResponses: Array<{ responseType: string; weight: number; evidenceRefs: EvidenceRef[] }>,
): BoxingAdaptiveState {
  return {
    fighterId: observation.fighterId,
    opponentId: observation.opponentId,
    interventionExposures: {},
    responses: candidateResponses
      .map((candidate) => ({
        responseType: candidate.responseType,
        priorWeight: Math.max(DEFAULT_RULE.minimumWeight, candidate.weight),
        observedEvidence: 0,
        adaptiveWeight: Math.max(DEFAULT_RULE.minimumWeight, candidate.weight),
        exposureCount: 0,
      }))
      .sort((a, b) => a.responseType.localeCompare(b.responseType)),
    uncertainty: 0.75,
    evidenceRefs: dedupeEvidence(candidateResponses.flatMap((candidate) => candidate.evidenceRefs)),
  };
}

function calculateUncertainty(
  responses: BoxingAdaptiveResponseWeight[],
  source: BoxingAdaptiveObservation["source"],
  prior: number,
): number {
  const evidence = responses.reduce((sum, response) => sum + response.observedEvidence, 0);
  const evidenceConfidence = Math.min(1, evidence / 6);
  const sourcePenalty = source === "simulated" ? 0.1 : 0;
  return clamp01(prior * 0.7 + (1 - evidenceConfidence) * 0.3 + sourcePenalty);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
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
