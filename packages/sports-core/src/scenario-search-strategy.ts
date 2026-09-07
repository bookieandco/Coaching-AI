import type { ScenarioEvaluation } from "./scenario-evaluation";
import type { ScenarioSearchNode, ScenarioSearchWorldModel } from "./scenario-search-world-model";

export type ScenarioSearchStrategy = "best_first" | "beam" | "mcts";

export interface ScenarioSearchStrategyConfig {
  strategy: ScenarioSearchStrategy;
  beamWidth?: number;
  explorationConstant?: number;
  maxNodes?: number;
}

export interface ScenarioSearchPriority {
  nodeId: string;
  score: number;
  visits: number;
  uncertainty: number;
}

export interface ScenarioSearchSelection {
  strategy: ScenarioSearchStrategy;
  selectedNodeIds: string[];
  priorities: ScenarioSearchPriority[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function evaluationScore(node: ScenarioSearchNode): number {
  const aggregate = node.evaluation?.aggregate;
  return clamp01(aggregate ?? 0);
}

function uncertainty(node: ScenarioSearchNode): number {
  if (!node.evaluation) return 1;
  const values = node.evaluation.dimensions.map((dimension) => clamp01(1 - dimension.score));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function priority(node: ScenarioSearchNode, explorationConstant: number): ScenarioSearchPriority {
  const score = evaluationScore(node);
  const visits = Math.max(0, node.visits);
  const parentVisits = Math.max(1, visits);
  const exploration = explorationConstant * Math.sqrt(Math.log(parentVisits + 1) / (visits + 1));
  return {
    nodeId: node.nodeId,
    score: score + exploration,
    visits,
    uncertainty: uncertainty(node),
  };
}

function openNodes(model: ScenarioSearchWorldModel): ScenarioSearchNode[] {
  return model.nodes.filter((node) => node.status === "open" || node.status === "unknown" || node.status === "evaluated");
}

export function rankScenarioSearchNodes(
  model: ScenarioSearchWorldModel,
  config: Pick<ScenarioSearchStrategyConfig, "explorationConstant"> = {},
): ScenarioSearchPriority[] {
  const explorationConstant = Math.max(0, config.explorationConstant ?? 1.41421356237);
  return openNodes(model)
    .map((node) => priority(node, explorationConstant))
    .sort((a, b) => b.score - a.score || b.uncertainty - a.uncertainty || a.nodeId.localeCompare(b.nodeId));
}

export function selectScenarioSearchNodes(
  model: ScenarioSearchWorldModel,
  config: ScenarioSearchStrategyConfig,
): ScenarioSearchSelection {
  const ranked = rankScenarioSearchNodes(model, config);
  const width = Math.max(1, Math.floor(config.beamWidth ?? 1));
  const limit = Math.max(1, Math.floor(config.maxNodes ?? width));
  const selectedNodeIds = config.strategy === "beam"
    ? ranked.slice(0, Math.min(width, limit)).map((item) => item.nodeId)
    : ranked.slice(0, Math.min(1, limit)).map((item) => item.nodeId);

  return {
    strategy: config.strategy,
    selectedNodeIds,
    priorities: ranked.slice(0, limit),
  };
}

export function chooseScenarioSearchStrategy(model: ScenarioSearchWorldModel): ScenarioSearchStrategy {
  if (model.stagnationRounds >= 3) return "mcts";
  const open = openNodes(model).length;
  if (open >= 4) return "beam";
  return "best_first";
}

export function scoreScenarioSearchNode(node: ScenarioSearchNode): number {
  return evaluationScore(node);
}
