export type TennisScenarioObjective = "win_path_support" | "failure_avoidance" | "robustness" | "evidence_strength" | "tactical_diversity";
export interface TennisScenarioSearchConfig { populationSize: number; eliteCount: number; diversityFloor: number; maxGenerations: number; simulationCount: number; maxSteps: number; seed: number; modelVersion?: string; }
export interface TennisScenarioSearchResult { engineVersion: string; objectives: TennisScenarioObjective[]; generation: number; note: string; }
export const TENNIS_SCENARIO_SEARCH_ENGINE = "tennis-adaptive-scenario-search-v1";
export const TENNIS_SCENARIO_OBJECTIVES: TennisScenarioObjective[] = ["win_path_support","failure_avoidance","robustness","evidence_strength","tactical_diversity"];
export function describeTennisScenarioSearch(): TennisScenarioSearchResult { return { engineVersion: TENNIS_SCENARIO_SEARCH_ENGINE, objectives: TENNIS_SCENARIO_OBJECTIVES, generation: 0, note: "Scenario frontier uses structural repair, Pareto evaluation, elite preservation, and diversity injection; it does not declare an optimal or recommended coaching decision." }; }
