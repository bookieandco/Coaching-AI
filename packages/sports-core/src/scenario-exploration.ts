import type { EvidenceRef, GameState, SportCode } from "./index";
import type { CoachExplanationReadModel } from "./coach-explanation";
import type { ScenarioEvaluation } from "./scenario-evaluation";
import {
  advanceIterativeScenarioSearch,
  createIterativeScenarioSearch,
  type IterativeScenarioSearchConfig,
  type IterativeScenarioSearchState,
} from "./iterative-scenario-exploration";
import type { ScenarioSearchNode } from "./scenario-search-world-model";

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

export interface ScenarioExplorationSearchMetadata {
  modelId: string;
  version: number;
  roundsCompleted: number;
  stagnationRounds: number;
  nextAction: string;
  stopReason?: IterativeScenarioSearchState["stopReason"];
}

export interface ScenarioExplorationResult {
  explorationId: string;
  stateSignature: string;
  simulations: ScenarioSimulationResult[];
  evaluations: ScenarioEvaluation[];
  paretoScenarioIds: string[];
  explanation?: CoachExplanationReadModel;
  search?: ScenarioExplorationSearchMetadata;
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

export interface IterativeScenarioExplorationService extends ScenarioExplorationService {
  exploreIteratively(
    request: ScenarioExplorationRequest,
    config: IterativeScenarioSearchConfig,
  ): Promise<ScenarioExplorationResult>;
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

function nodeFromEvaluation(evaluation: ScenarioEvaluation, round: number): ScenarioSearchNode {
  return {
    nodeId: `round:${round}:${evaluation.scenarioId}`,
    scenarioId: evaluation.scenarioId,
    depth: round,
    status: "evaluated",
    evaluation,
    visits: 1,
  };
}

/**
 * Wrap an existing exploration implementation with persistent iterative search state.
 * The underlying sport adapter remains responsible for simulation/evaluation; this
 * layer only decides whether another exploration round should be attempted.
 */
export function withIterativeScenarioSearch(
  service: ScenarioExplorationService,
  config: IterativeScenarioSearchConfig,
  modelId = "scenario-search-v1",
): IterativeScenarioExplorationService {
  return {
    ...service,
    async exploreIteratively(request): Promise<ScenarioExplorationResult> {
      let searchState = createIterativeScenarioSearch({
        modelId,
        explorationId: request.explorationId,
        stateSignature: request.stateSignature,
        config,
      });
      let result = await service.explore(request);
      let round = 1;

      while (!searchState.stopped) {
        const best = [...result.evaluations]
          .sort((a, b) => (b.aggregate ?? 0) - (a.aggregate ?? 0))[0];
        if (!best) break;

        const previousBest = searchState.worldModel.nodes
          .map((node) => node.evaluation?.aggregate ?? -Infinity)
          .reduce((max, value) => Math.max(max, value), -Infinity);
        const improved = (best.aggregate ?? -Infinity) > previousBest;
        const node = nodeFromEvaluation(best, round);
        searchState = advanceIterativeScenarioSearch(
          searchState,
          { round, node, evaluation: best, improved },
          config,
        );
        if (searchState.stopped) break;
        round += 1;
        result = await service.explore(request);
      }

      return {
        ...result,
        search: {
          modelId: searchState.worldModel.modelId,
          version: searchState.worldModel.version,
          roundsCompleted: searchState.roundsCompleted,
          stagnationRounds: searchState.worldModel.stagnationRounds,
          nextAction: searchState.nextAction,
          stopReason: searchState.stopReason,
        },
      };
    },
  };
}

export function createScenarioExplorationResult(input: Omit<ScenarioExplorationResult, "humanDecisionRequired">): ScenarioExplorationResult {
  return { ...input, humanDecisionRequired: true };
}
