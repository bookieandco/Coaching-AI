import type { EvidenceRef, GameState, SportCode } from "./index";
import type { CoachExplanationReadModel } from "./coach-explanation";
import type { ScenarioEvaluation } from "./scenario-evaluation";

export interface ScenarioCandidate {
  scenarioId: string;
  title: string;
  intervention: string;
  assumptions: string[];
  evidenceRefs: EvidenceRef[];
}

export interface ScenarioSimulationResult {
  scenarioId: string;
  seed: number;
  outcome: string;
  outcomeScore?: number;
  evidenceRefs: EvidenceRef[];
  actualOutcome?: string;
}

export interface ScenarioExplorationRequest {
  explorationId: string;
  sport: SportCode;
  stateSignature: string;
  state: GameState;
  candidates: ScenarioCandidate[];
  seeds?: number[];
  simulationBudget?: number;
}

export interface ScenarioExplorationResult {
  explorationId: string;
  stateSignature: string;
  simulations: ScenarioSimulationResult[];
  evaluations: ScenarioEvaluation[];
  paretoScenarioIds: string[];
  explanation?: CoachExplanationReadModel;
  humanDecisionRequired: true;
  provenance: {
    serviceVersion: string;
    stateSignature: string;
    seeds: number[];
  };
}

export interface ScenarioExplorationService {
  explore(request: ScenarioExplorationRequest): Promise<ScenarioExplorationResult>;
}

export function validateScenarioExplorationRequest(request: ScenarioExplorationRequest): string[] {
  const errors: string[] = [];
  if (!request.explorationId.trim()) errors.push("explorationId is required");
  if (!request.sport) errors.push("sport is required");
  if (!request.stateSignature.trim()) errors.push("stateSignature is required");
  if (!request.state) errors.push("state is required");
  if (!request.candidates.length) errors.push("at least one scenario candidate is required");
  const ids = new Set<string>();
  for (const candidate of request.candidates) {
    if (ids.has(candidate.scenarioId)) errors.push(`duplicate scenarioId: ${candidate.scenarioId}`);
    ids.add(candidate.scenarioId);
    if (!candidate.intervention.trim()) errors.push(`intervention is required: ${candidate.scenarioId}`);
  }
  if (request.simulationBudget !== undefined && request.simulationBudget < 1) errors.push("simulationBudget must be positive");
  return errors;
}

export function createScenarioExplorationResult(input: Omit<ScenarioExplorationResult, "humanDecisionRequired">): ScenarioExplorationResult {
  return { ...input, humanDecisionRequired: true };
}
