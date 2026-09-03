import type { EvidenceRef } from "@coaching-ai/sports-core";

export type BoxingStance = "orthodox" | "southpaw" | "switch" | "unknown";
export type BoxingDistance = "inside" | "pocket" | "mid" | "long" | "unknown";

export interface BoxingFeatureEstimate {
  value: number;
  uncertainty: number;
  sampleSize?: number;
  recency: number;
  context: string;
  evidenceRefs: EvidenceRef[];
}

export interface BoxingFighterProfile {
  fighterId: string;
  stance: BoxingStance;
  experience: BoxingFeatureEstimate;
  activity: BoxingFeatureEstimate;
  recentForm: BoxingFeatureEstimate;
  pace: BoxingFeatureEstimate;
  punchVolume: BoxingFeatureEstimate;
  punchAccuracy: BoxingFeatureEstimate;
  defense: BoxingFeatureEstimate;
  power: BoxingFeatureEstimate;
  durability: BoxingFeatureEstimate;
  recovery: BoxingFeatureEstimate;
  pressure: BoxingFeatureEstimate;
  countering: BoxingFeatureEstimate;
  distanceControl: BoxingFeatureEstimate;
  ringControl: BoxingFeatureEstimate;
  bodyAttack: BoxingFeatureEstimate;
  lateRoundPerformance: BoxingFeatureEstimate;
  evidenceRefs: EvidenceRef[];
}

export interface BoxingTendency {
  tendencyId: string;
  fighterId: string;
  trigger: string;
  response: string;
  frequency: BoxingFeatureEstimate;
  reliability: BoxingFeatureEstimate;
  phase?: string;
  distance?: BoxingDistance;
  evidenceRefs: EvidenceRef[];
}

export interface BoxingMatchupInteraction {
  interactionId: string;
  attackerId: string;
  defenderId: string;
  context: string;
  expectedEffect: number;
  uncertainty: number;
  supportingTendencies: string[];
  evidenceRefs: EvidenceRef[];
}

export interface BoxingMatchupModel {
  fighterA: BoxingFighterProfile;
  fighterB: BoxingFighterProfile;
  interactions: BoxingMatchupInteraction[];
  exploitableAreas: Array<{
    fighterId: string;
    area: string;
    opportunity: number;
    uncertainty: number;
    evidenceRefs: EvidenceRef[];
  }>;
  counterRisks: Array<{
    fighterId: string;
    intervention: string;
    responseRisk: number;
    evidenceRefs: EvidenceRef[];
  }>;
}

export interface BoxingLiveAdjustment {
  fighterId: string;
  round: number;
  observedChanges: string[];
  inferredChanges: string[];
  confidence: number;
  evidenceRefs: EvidenceRef[];
}

export interface BoxingIntelligenceSnapshot {
  generatedAt: string;
  modelVersion: string;
  profiles: BoxingFighterProfile[];
  tendencies: BoxingTendency[];
  matchup: BoxingMatchupModel;
  liveAdjustments: BoxingLiveAdjustment[];
}

/**
 * Deliberately keeps features as estimates rather than absolute ratings.
 * This lets downstream coaching scenarios reason about uncertainty and evidence.
 */
export function buildMatchupModel(
  fighterA: BoxingFighterProfile,
  fighterB: BoxingFighterProfile,
  tendencies: BoxingTendency[],
): BoxingMatchupModel {
  const interactions: BoxingMatchupInteraction[] = [];

  const aPressureVsBDefense = fighterA.pressure.value - fighterB.defense.value;
  const bPressureVsADefense = fighterB.pressure.value - fighterA.defense.value;

  interactions.push({
    interactionId: `${fighterA.fighterId}:pressure:${fighterB.fighterId}:defense`,
    attackerId: fighterA.fighterId,
    defenderId: fighterB.fighterId,
    context: "pressure_vs_defense",
    expectedEffect: aPressureVsBDefense,
    uncertainty: combineUncertainty(fighterA.pressure, fighterB.defense),
    supportingTendencies: tendencies.filter((t) => t.fighterId === fighterB.fighterId && t.trigger.includes("pressure")).map((t) => t.tendencyId),
    evidenceRefs: [...fighterA.pressure.evidenceRefs, ...fighterB.defense.evidenceRefs],
  });

  interactions.push({
    interactionId: `${fighterB.fighterId}:pressure:${fighterA.fighterId}:defense`,
    attackerId: fighterB.fighterId,
    defenderId: fighterA.fighterId,
    context: "pressure_vs_defense",
    expectedEffect: bPressureVsADefense,
    uncertainty: combineUncertainty(fighterB.pressure, fighterA.defense),
    supportingTendencies: tendencies.filter((t) => t.fighterId === fighterA.fighterId && t.trigger.includes("pressure")).map((t) => t.tendencyId),
    evidenceRefs: [...fighterB.pressure.evidenceRefs, ...fighterA.defense.evidenceRefs],
  });

  return {
    fighterA,
    fighterB,
    interactions,
    exploitableAreas: [],
    counterRisks: [],
  };
}

function combineUncertainty(a: BoxingFeatureEstimate, b: BoxingFeatureEstimate): number {
  return Math.min(1, (Math.max(0, a.uncertainty) + Math.max(0, b.uncertainty)) / 2);
}
