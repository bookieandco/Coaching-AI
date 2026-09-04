import type { EvidenceRef } from "./index";

export type CoachingEvidenceLabel =
  | "OBSERVED"
  | "INFERRED"
  | "HYPOTHESIS"
  | "SIMULATED"
  | "UNKNOWN";

export type CoachingEvidenceLevel =
  | "sport"
  | "competition"
  | "team"
  | "player"
  | "game"
  | "situation";

export interface CoachingEstimate {
  estimateId: string;
  value: number;
  lowerBound?: number;
  upperBound?: number;
  uncertainty: number;
  sampleSize: number;
  level: CoachingEvidenceLevel;
  evidenceRefs: EvidenceRef[];
}

export interface HierarchicalEvidence {
  level: CoachingEvidenceLevel;
  key: string;
  observations: number;
  successes: number;
  priorMean?: number;
  priorStrength?: number;
  posteriorMean: number;
  uncertainty: number;
  evidenceRefs: EvidenceRef[];
}

export interface ConfidenceCalibrationRecord {
  estimateId: string;
  predictedConfidence: number;
  observedCorrect: boolean;
  absoluteError: number;
  brierContribution: number;
  evidenceRefs: EvidenceRef[];
}

export interface ConfidenceCalibrationSummary {
  sampleSize: number;
  meanAbsoluteError: number;
  brierScore: number;
  meanConfidence: number;
  observedAccuracy: number;
  uncertainty: number;
}

export interface ReferenceMotionComparison {
  comparisonId: string;
  actorParticipantId: string;
  referenceId: string;
  motionLabel: string;
  temporalAlignmentScore: number;
  spatialDifference: number;
  temporalDifference: number;
  observedEvidenceRefs: EvidenceRef[];
  referenceEvidenceRefs: EvidenceRef[];
  uncertainty: number;
}

export interface CoachingPolicyEvaluation {
  policyId: string;
  stateSignature: string;
  interventionType: string;
  temporalContext?: string;
  objectiveScores: Record<string, number>;
  uncertainty: number;
  evidenceRefs: EvidenceRef[];
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const uniqueEvidence = (refs: EvidenceRef[]): EvidenceRef[] => {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.evidenceId)) return false;
    seen.add(ref.evidenceId);
    return true;
  });
};

/**
 * Deterministic Beta-Binomial estimate for sparse performance data.
 * This is an estimate primitive, not a calibrated probability model.
 */
export function estimateBetaBinomial(
  estimateId: string,
  successes: number,
  trials: number,
  level: CoachingEvidenceLevel,
  evidenceRefs: EvidenceRef[] = [],
  priorAlpha = 1,
  priorBeta = 1,
): CoachingEstimate {
  const safeTrials = Math.max(0, Math.floor(trials));
  const safeSuccesses = Math.max(0, Math.min(safeTrials, Math.floor(successes)));
  const alpha = Math.max(0.001, priorAlpha);
  const beta = Math.max(0.001, priorBeta);
  const posteriorTrials = safeTrials + alpha + beta;
  const mean = (safeSuccesses + alpha) / posteriorTrials;
  const variance =
    (mean * (1 - mean)) / Math.max(1, posteriorTrials + 1);
  const sd = Math.sqrt(Math.max(0, variance));

  return {
    estimateId,
    value: mean,
    lowerBound: clamp01(mean - 2 * sd),
    upperBound: clamp01(mean + 2 * sd),
    uncertainty: clamp01(2 * sd),
    sampleSize: safeTrials,
    level,
    evidenceRefs: uniqueEvidence(evidenceRefs),
  };
}

/**
 * Partial-pooling estimate: the child estimate borrows strength from a
 * parent level without replacing the child's observations.
 */
export function estimateHierarchicalRate(
  level: CoachingEvidenceLevel,
  key: string,
  successes: number,
  observations: number,
  parentMean: number,
  parentStrength: number,
  evidenceRefs: EvidenceRef[] = [],
): HierarchicalEvidence {
  const n = Math.max(0, Math.floor(observations));
  const k = Math.max(0, Math.min(n, Math.floor(successes)));
  const strength = Math.max(0, parentStrength);
  const prior = clamp01(parentMean);
  const posteriorMean = (k + prior * strength) / Math.max(1, n + strength);
  const effectiveEvidence = n + strength;
  const uncertainty = clamp01(
    1 / Math.sqrt(Math.max(1, effectiveEvidence)),
  );

  return {
    level,
    key,
    observations: n,
    successes: k,
    priorMean: prior,
    priorStrength: strength,
    posteriorMean: posteriorMean,
    uncertainty,
    evidenceRefs: uniqueEvidence(evidenceRefs),
  };
}

/**
 * Evaluate confidence against what actually happened. Confidence is kept
 * separate from outcome probability and performance itself.
 */
export function calibrateConfidence(
  records: ConfidenceCalibrationRecord[],
): ConfidenceCalibrationSummary {
  if (records.length === 0) {
    return {
      sampleSize: 0,
      meanAbsoluteError: 1,
      brierScore: 1,
      meanConfidence: 0,
      observedAccuracy: 0,
      uncertainty: 1,
    };
  }

  const normalized = records.map((record) => {
    const confidence = clamp01(record.predictedConfidence);
    const outcome = record.observedCorrect ? 1 : 0;
    return {
      confidence,
      outcome,
      absoluteError: Math.abs(confidence - outcome),
      brier: (confidence - outcome) ** 2,
    };
  });

  const mean = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

  const meanConfidence = mean(normalized.map((item) => item.confidence));
  const observedAccuracy = mean(normalized.map((item) => item.outcome));
  const meanAbsoluteError = mean(normalized.map((item) => item.absoluteError));
  const brierScore = mean(normalized.map((item) => item.brier));

  return {
    sampleSize: records.length,
    meanAbsoluteError,
    brierScore,
    meanConfidence,
    observedAccuracy,
    uncertainty: clamp01(1 / Math.sqrt(records.length)),
  };
}

/**
 * Contract for reference-based motion analysis. The core accepts already
 * extracted temporal/spatial differences; it does not pretend to perform CV.
 */
export function compareReferenceMotion(input: {
  comparisonId: string;
  actorParticipantId: string;
  referenceId: string;
  motionLabel: string;
  temporalAlignmentScore: number;
  spatialDifference: number;
  temporalDifference: number;
  observedEvidenceRefs: EvidenceRef[];
  referenceEvidenceRefs: EvidenceRef[];
  uncertainty?: number;
}): ReferenceMotionComparison {
  return {
    comparisonId: input.comparisonId,
    actorParticipantId: input.actorParticipantId,
    referenceId: input.referenceId,
    motionLabel: input.motionLabel,
    temporalAlignmentScore: clamp01(input.temporalAlignmentScore),
    spatialDifference: Math.max(0, input.spatialDifference),
    temporalDifference: Math.max(0, input.temporalDifference),
    observedEvidenceRefs: uniqueEvidence(input.observedEvidenceRefs),
    referenceEvidenceRefs: uniqueEvidence(input.referenceEvidenceRefs),
    uncertainty: clamp01(input.uncertainty ?? 0.5),
  };
}

/**
 * Records a high-level intervention evaluation. It never selects or executes
 * a policy; selection remains outside the universal intelligence core.
 */
export function buildCoachingPolicyEvaluation(input: {
  policyId: string;
  stateSignature: string;
  interventionType: string;
  temporalContext?: string;
  objectiveScores: Record<string, number>;
  uncertainty?: number;
  evidenceRefs?: EvidenceRef[];
}): CoachingPolicyEvaluation {
  return {
    policyId: input.policyId,
    stateSignature: input.stateSignature,
    interventionType: input.interventionType,
    temporalContext: input.temporalContext,
    objectiveScores: Object.fromEntries(
      Object.entries(input.objectiveScores).map(([key, value]) => [
        key,
        Number.isFinite(value) ? value : 0,
      ]),
    ),
    uncertainty: clamp01(input.uncertainty ?? 0.5),
    evidenceRefs: uniqueEvidence(input.evidenceRefs ?? []),
  };
}
