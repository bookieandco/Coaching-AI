import type { EvidenceRef, GameState } from "./index";
import {
  chooseScenarioSearchAction,
  createScenarioSearchWorldModel,
  updateScenarioSearchWorldModel,
  type ScenarioSearchAction,
  type ScenarioSearchNode,
  type ScenarioSearchWorldModel,
} from "./scenario-search-world-model";
import {
  chooseScenarioSearchStrategy,
  selectScenarioSearchNodes,
  type ScenarioSearchStrategy,
} from "./scenario-search-strategy";
import type {
  ScenarioCandidate,
  ScenarioEvaluation,
  ScenarioExplorationRequest,
  ScenarioSimulationResult,
} from "./scenario-exploration";

export interface IterativeScenarioExplorationConfig {
  maxRounds: number;
  maxNodes: number;
  stagnationLimit: number;
  strategy?: ScenarioSearchStrategy;
  beamWidth?: number;
  explorationConstant?: number;
}

export interface IterativeScenarioExplorationRound {
  round: number;
  action: ScenarioSearchAction;
  strategy: ScenarioSearchStrategy;
  activeNodeId: string;
  scenarioIds: string[];
  improved: boolean;
  simulations: ScenarioSimulationResult[];
  evaluations: ScenarioEvaluation[];
}

export interface IterativeScenarioExplorationResult {
  worldModel: ScenarioSearchWorldModel;
  rounds: IterativeScenarioExplorationRound[];
  simulations: ScenarioSimulationResult[];
  evaluations: ScenarioEvaluation[];
  evidenceRefs: EvidenceRef[];
  stoppedBecause: "budget" | "stagnation" | "complete";
}

export interface IterativeScenarioExplorationEvaluator {
  evaluate(input: {
    request: ScenarioExplorationRequest;
    candidates: ScenarioCandidate[];
    state: GameState;
    round: number;
    action: ScenarioSearchAction;
  }): {
    simulations: ScenarioSimulationResult[];
    evaluations: ScenarioEvaluation[];
  };
}

function uniqueEvidence(refs: EvidenceRef[]): EvidenceRef[] {
  return [...new Map(refs.map((ref) => [ref.evidenceId, ref])).values()];
}

function score(evaluations: ScenarioEvaluation[]): number {
  if (!evaluations.length) return 0;
  const values = evaluations
    .map((evaluation) => evaluation.aggregate)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length ? Math.max(...values) : 0;
}

function nodeForCandidate(candidate: ScenarioCandidate, parentNodeId: string, round: number): ScenarioSearchNode {
  return {
    nodeId: `${parentNodeId}/${candidate.scenarioId}`,
    parentNodeId,
    scenarioId: candidate.scenarioId,
    depth: 1,
    status: "open",
    visits: 0,
    notes: `candidate introduced in round ${round}`,
  };
}

export function runIterativeScenarioExploration(
  request: ScenarioExplorationRequest,
  evaluator: IterativeScenarioExplorationEvaluator,
  config: IterativeScenarioExplorationConfig,
): IterativeScenarioExplorationResult {
  const maxRounds = Math.max(1, Math.floor(config.maxRounds));
  const maxNodes = Math.max(1, Math.floor(config.maxNodes));
  const stagnationLimit = Math.max(1, Math.floor(config.stagnationLimit));

  let worldModel = createScenarioSearchWorldModel({
    modelId: `scenario-search:${request.explorationId}`,
    explorationId: request.explorationId,
    stateSignature: request.stateSignature,
  });

  const rounds: IterativeScenarioExplorationRound[] = [];
  const simulations: ScenarioSimulationResult[] = [];
  const evaluations: ScenarioEvaluation[] = [];
  let bestScore = 0;

  for (let round = 1; round <= maxRounds; round += 1) {
    if (worldModel.nodes.length >= maxNodes || worldModel.stagnationRounds >= stagnationLimit) break;

    const action = chooseScenarioSearchAction(worldModel);
    if (action === "stop") break;

    const strategy = config.strategy ?? chooseScenarioSearchStrategy(worldModel);
    const selection = selectScenarioSearchNodes(worldModel, {
      strategy,
      beamWidth: config.beamWidth,
      explorationConstant: config.explorationConstant,
      maxNodes,
    });
    const selectedScenarioIds = new Set(
      selection.selectedNodeIds
        .map((nodeId) => worldModel.nodes.find((node) => node.nodeId === nodeId)?.scenarioId)
        .filter((scenarioId): scenarioId is string => Boolean(scenarioId)),
    );

    const candidates = request.candidates.filter((candidate) => {
      const existing = worldModel.nodes.find((node) => node.scenarioId === candidate.scenarioId);
      if (selectedScenarioIds.size) return selectedScenarioIds.has(candidate.scenarioId);
      return action === "replay" || !existing || existing.status !== "evaluated";
    });

    if (!candidates.length) {
      const fallback = request.candidates.find((candidate) => {
        const existing = worldModel.nodes.find((node) => node.scenarioId === candidate.scenarioId);
        return action === "replay" || !existing || existing.status !== "evaluated";
      });
      if (fallback) candidates.push(fallback);
    }

    if (!candidates.length) {
      worldModel = updateScenarioSearchWorldModel(worldModel, {
        node: {
          nodeId: `${worldModel.activeNodeId}/round-${round}`,
          parentNodeId: worldModel.activeNodeId,
          depth: worldModel.nodes.find((node) => node.nodeId === worldModel.activeNodeId)?.depth ?? 0,
          status: "unknown",
          visits: 0,
          notes: "no candidate selected by search strategy",
        },
        round,
        improved: false,
        nextAction: "counter",
      });
      continue;
    }

    const result = evaluator.evaluate({ request, candidates, state: request.state, round, action });
    const currentScore = score(result.evaluations);
    const improved = currentScore > bestScore;
    bestScore = Math.max(bestScore, currentScore);

    for (const candidate of candidates) {
      const existing = worldModel.nodes.find((node) => node.scenarioId === candidate.scenarioId);
      const node = {
        ...(existing ?? nodeForCandidate(candidate, worldModel.activeNodeId, round)),
        status: "evaluated" as const,
        visits: (existing?.visits ?? 0) + 1,
        evaluation: result.evaluations.find((evaluation) => evaluation.scenarioId === candidate.scenarioId),
        action,
        lastImprovedRound: improved ? round : existing?.lastImprovedRound,
      };
      worldModel = updateScenarioSearchWorldModel(worldModel, {
        node,
        round,
        improved,
        nextAction: chooseScenarioSearchAction(worldModel),
      });
    }

    simulations.push(...result.simulations);
    evaluations.push(...result.evaluations);
    rounds.push({
      round,
      action,
      strategy,
      activeNodeId: worldModel.activeNodeId,
      scenarioIds: candidates.map((candidate) => candidate.scenarioId).sort(),
      improved,
      simulations: result.simulations,
      evaluations: result.evaluations,
    });
  }

  const stoppedBecause = worldModel.stagnationRounds >= stagnationLimit
    ? "stagnation"
    : worldModel.nodes.length >= maxNodes || rounds.length >= maxRounds
      ? "budget"
      : "complete";

  return {
    worldModel,
    rounds,
    simulations,
    evaluations,
    evidenceRefs: uniqueEvidence([
      ...request.state.evidenceRefs,
      ...request.candidates.flatMap((candidate) => candidate.evidenceRefs),
      ...simulations.flatMap((simulation) => simulation.evidenceRefs),
      ...evaluations.flatMap((evaluation) => evaluation.dimensions.flatMap((dimension) => dimension.evidenceRefs)),
    ]),
    stoppedBecause,
  };
}
