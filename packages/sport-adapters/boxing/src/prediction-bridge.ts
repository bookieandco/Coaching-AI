import type { EvidenceRef } from "@coaching-ai/sports-core";

/**
 * Shared prediction → coaching contract.
 *
 * Prediction models provide evidence-backed state estimates and baseline
 * distributions. They do not own coaching decisions or interventions.
 */
export interface BoxingPredictionSnapshot {
  fightId: string;
  generatedAt: string;
  modelVersion: string;
  evidenceRefs: EvidenceRef[];
  fighters: Record<string, BoxingFighterPredictionState>;
  matchup: BoxingMatchupPrediction;
  baseline: BoxingBaselineOutcome;
}

export interface BoxingFighterPredictionState {
  fighterId: string;
  form: FeatureEstimate;
  pace: FeatureEstimate;
  offensiveOutput: FeatureEstimate;
  defensiveEffectiveness: FeatureEstimate;
  powerImpact: FeatureEstimate;
  durability: FeatureEstimate;
  recovery: FeatureEstimate;
  distanceControl: FeatureEstimate;
  pressureEffectiveness: FeatureEstimate;
  countering: FeatureEstimate;
  bodyAttack: FeatureEstimate;
  ringControl: FeatureEstimate;
  evidenceRefs: EvidenceRef[];
}

export interface FeatureEstimate {
  value: number;
  uncertainty: number;
  recency: number;
  context: string;
  evidenceRefs: EvidenceRef[];
}

export interface BoxingMatchupPrediction {
  styleInteraction: Record<string, number>;
  advantageAreas: string[];
  vulnerabilityAreas: string[];
  evidenceRefs: EvidenceRef[];
}

export interface BoxingBaselineOutcome {
  winProbability: Record<string, number>;
  finishProbability: Record<string, number>;
  decisionProbability: number;
  expectedFightShape: string[];
  uncertainty: number;
  evidenceRefs: EvidenceRef[];
}

export interface CoachingInputFromPrediction {
  snapshot: BoxingPredictionSnapshot;
  baselineIsInformational: true;
  decisionOwner: "coach";
}

export function toCoachingInput(
  snapshot: BoxingPredictionSnapshot,
): CoachingInputFromPrediction {
  return {
    snapshot,
    baselineIsInformational: true,
    decisionOwner: "coach",
  };
}
