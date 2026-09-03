import type { EvidenceRef } from "@coaching-ai/sports-core";

export type BoxingInterventionType =
  | "increase_pressure"
  | "change_distance"
  | "increase_body_attack"
  | "change_exit_direction"
  | "increase_countering"
  | "reduce_exchange_frequency"
  | "change_tempo"
  | "force_clinch_reset";

export interface BoxingIntervention {
  type: BoxingInterventionType;
  fighterId: string;
  intensity: number;
  durationRounds?: number;
  assumptions: string[];
  evidenceRefs: EvidenceRef[];
}

export interface BoxingOpponentResponse {
  responseType: string;
  probability: number;
  expectedEffect: string;
  evidenceRefs: EvidenceRef[];
}

export interface BoxingCounterPath {
  trigger: string;
  response: string;
  probability: number;
  evidenceRefs: EvidenceRef[];
}

export interface BoxingScenarioSeed {
  scenarioId: string;
  fighterId: string;
  currentStateVersion: number;
  intervention: BoxingIntervention;
  opponentResponses: BoxingOpponentResponse[];
  counterPaths: BoxingCounterPath[];
}

export interface BoxingScenarioObjective {
  objective: "win_round" | "win_fight" | "reduce_damage" | "increase_finish_probability" | "protect_lead" | "change_fight_shape";
  priority: number;
}

export interface BoxingScenario {
  seed: BoxingScenarioSeed;
  objectives: BoxingScenarioObjective[];
  baselineReference?: string;
  evidenceRefs: EvidenceRef[];
}

/**
 * Converts prediction-derived matchup information into explicit coaching
 * experiments. It intentionally returns candidate interventions, not advice.
 */
export function generateCandidateInterventions(
  fighterId: string,
  opportunities: Array<{ area: string; opportunity: number; evidenceRefs: EvidenceRef[] }>,
): BoxingIntervention[] {
  return opportunities
    .filter((opportunity) => opportunity.opportunity > 0)
    .map((opportunity) => ({
      type: mapAreaToIntervention(opportunity.area),
      fighterId,
      intensity: Math.min(1, opportunity.opportunity),
      assumptions: [`Opportunity estimate applies to ${opportunity.area}.`],
      evidenceRefs: opportunity.evidenceRefs,
    }));
}

function mapAreaToIntervention(area: string): BoxingInterventionType {
  const normalized = area.toLowerCase();
  if (normalized.includes("pressure")) return "increase_pressure";
  if (normalized.includes("body")) return "increase_body_attack";
  if (normalized.includes("distance")) return "change_distance";
  if (normalized.includes("counter")) return "increase_countering";
  if (normalized.includes("tempo")) return "change_tempo";
  if (normalized.includes("exit")) return "change_exit_direction";
  return "change_tempo";
}
