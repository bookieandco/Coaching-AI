import type { EvidenceRef } from "./index";
import type { ScenarioEvaluation } from "./scenario-evaluation";

export type ScenarioSearchNodeStatus = "open" | "evaluated" | "pruned" | "unknown";
export type ScenarioSearchAction = "expand" | "refine" | "counter" | "replay" | "stop";

export interface ScenarioSearchHypothesis {
  hypothesisId: string;
  statement: string;
  confidence: number;
  evidenceRefs: EvidenceRef[];
}

export interface ScenarioSearchNode {
  nodeId: string;
  parentNodeId?: string;
  scenarioId?: string;
  depth: number;
  status: ScenarioSearchNodeStatus;
  hypothesis?: ScenarioSearchHypothesis;
  evaluation?: ScenarioEvaluation;
  action?: ScenarioSearchAction;
  visits: number;
  lastImprovedRound?: number;
  notes?: string;
}

export interface ScenarioSearchWorldModel {
  modelId: string;
  version: number;
  explorationId: string;
  stateSignature: string;
  rootNodeId: string;
  activeNodeId: string;
  round: number;
  stagnationRounds: number;
  nodes: ScenarioSearchNode[];
  openQuestions: string[];
}

export interface ScenarioSearchUpdate {
  node: ScenarioSearchNode;
  round: number;
  improved: boolean;
  nextAction: ScenarioSearchAction;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function stableSort<T>(values: T[], key: (value: T) => string): T[] {
  return [...values].sort((a, b) => key(a).localeCompare(key(b)));
}

export function createScenarioSearchWorldModel(input: {
  modelId: string;
  explorationId: string;
  stateSignature: string;
  rootNode?: ScenarioSearchNode;
}): ScenarioSearchWorldModel {
  const rootNode: ScenarioSearchNode = input.rootNode ?? {
    nodeId: "root",
    depth: 0,
    status: "open",
    visits: 0,
  };
  return {
    modelId: input.modelId,
    version: 1,
    explorationId: input.explorationId,
    stateSignature: input.stateSignature,
    rootNodeId: rootNode.nodeId,
    activeNodeId: rootNode.nodeId,
    round: 0,
    stagnationRounds: 0,
    nodes: [rootNode],
    openQuestions: [],
  };
}

export function updateScenarioSearchWorldModel(
  model: ScenarioSearchWorldModel,
  update: ScenarioSearchUpdate,
): ScenarioSearchWorldModel {
  const existing = model.nodes.find((node) => node.nodeId === update.node.nodeId);
  const nodes = existing
    ? model.nodes.map((node) => (node.nodeId === update.node.nodeId ? update.node : node))
    : [...model.nodes, update.node];
  const nextRound = Math.max(model.round, update.round);
  return {
    ...model,
    version: model.version + 1,
    round: nextRound,
    activeNodeId: update.node.nodeId,
    stagnationRounds: update.improved ? 0 : model.stagnationRounds + 1,
    nodes: stableSort(nodes, (node) => node.nodeId),
  };
}

export function chooseScenarioSearchAction(model: ScenarioSearchWorldModel): ScenarioSearchAction {
  const active = model.nodes.find((node) => node.nodeId === model.activeNodeId);
  if (!active) return "expand";
  if (model.stagnationRounds >= 5) return "counter";
  if (active.status === "unknown") return "replay";
  if (active.status === "evaluated" && active.evaluation) return "refine";
  return "expand";
}

export function normalizeScenarioSearchHypothesis(
  hypothesis: ScenarioSearchHypothesis,
): ScenarioSearchHypothesis {
  return {
    ...hypothesis,
    confidence: clamp01(hypothesis.confidence),
    evidenceRefs: [...new Map(hypothesis.evidenceRefs.map((ref) => [ref.evidenceId, ref])).values()],
  };
}
