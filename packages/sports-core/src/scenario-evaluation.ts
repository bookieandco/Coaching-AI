import type { EvidenceRef } from "./index";

export type ScenarioEvaluationDimension =
  | "win_path_support"
  | "failure_avoidance"
  | "robustness"
  | "evidence_strength"
  | "opponent_response_resilience"
  | "execution_burden"
  | "adaptability"
  | "tactical_diversity";

export interface ScenarioEvaluationDimensionScore {
  dimension: ScenarioEvaluationDimension;
  score: number;
  confidence: number;
  uncertainty: number;
  evidenceRefs: EvidenceRef[];
  rationale?: string;
}

export interface ScenarioEvaluation {
  scenarioId: string;
  dimensions: ScenarioEvaluationDimensionScore[];
  aggregate?: number;
  paretoEligible: boolean;
  dominatedByScenarioIds: string[];
  robustness?: number;
  evidenceCoverage: number;
  uncertainty: number;
  provenance: {
    evaluatorVersion: string;
    stateSignature: string;
    seed?: number;
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function dedupeEvidence(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.evidenceId)) return false;
    seen.add(ref.evidenceId);
    return true;
  });
}

export function buildScenarioEvaluation(input: {
  scenarioId: string;
  stateSignature: string;
  dimensions: ScenarioEvaluationDimensionScore[];
  seed?: number;
}): ScenarioEvaluation {
  const dimensions = input.dimensions.map((dimension) => ({
    ...dimension,
    score: clamp01(dimension.score),
    confidence: clamp01(dimension.confidence),
    uncertainty: clamp01(dimension.uncertainty),
    evidenceRefs: dedupeEvidence(dimension.evidenceRefs),
  }));

  const aggregate = dimensions.length
    ? dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length
    : undefined;
  const evidenceCount = new Set(dimensions.flatMap((dimension) => dimension.evidenceRefs.map((ref) => ref.evidenceId))).size;
  const evidenceCoverage = dimensions.length
    ? evidenceCount / dimensions.length
    : 0;
  const uncertainty = dimensions.length
    ? dimensions.reduce((sum, dimension) => sum + dimension.uncertainty, 0) / dimensions.length
    : 1;
  const robustness = dimensions.find((dimension) => dimension.dimension === "robustness")?.score;

  return {
    scenarioId: input.scenarioId,
    dimensions,
    aggregate,
    paretoEligible: true,
    dominatedByScenarioIds: [],
    robustness,
    evidenceCoverage: clamp01(evidenceCoverage),
    uncertainty: clamp01(uncertainty),
    provenance: {
      evaluatorVersion: "multidimensional-scenario-evaluation-v1",
      stateSignature: input.stateSignature,
      seed: input.seed,
    },
  };
}

export function markParetoDominance(
  evaluations: ScenarioEvaluation[],
): ScenarioEvaluation[] {
  return evaluations.map((candidate) => {
    const dominatedByScenarioIds = evaluations
      .filter((other) => other.scenarioId !== candidate.scenarioId)
      .filter((other) => dominates(other, candidate))
      .map((other) => other.scenarioId)
      .sort();
    return {
      ...candidate,
      paretoEligible: dominatedByScenarioIds.length === 0,
      dominatedByScenarioIds,
    };
  });
}

function dominates(a: ScenarioEvaluation, b: ScenarioEvaluation): boolean {
  const bByDimension = new Map(b.dimensions.map((dimension) => [dimension.dimension, dimension.score]));
  let strictlyBetter = false;
  for (const dimension of a.dimensions) {
    const bScore = bByDimension.get(dimension.dimension);
    if (bScore === undefined || dimension.score < bScore) return false;
    if (dimension.score > bScore) strictlyBetter = true;
  }
  return strictlyBetter;
}
