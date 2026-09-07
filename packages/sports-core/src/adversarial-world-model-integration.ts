import type { ScenarioSearchNode, ScenarioSearchWorldModel } from "./scenario-search-world-model";
import {
  expandCounterResponses,
  type CounterResponseCandidate,
  type CounterResponseExpansionConfig,
} from "./counter-response-expansion";

export interface AdversarialWorldModelUpdate {
  worldModel: ScenarioSearchWorldModel;
  parentNodeId: string;
  responseNodeIds: string[];
  principalVariation: string[];
  minimaxValue: number;
  depthReached: number;
}

function stableNodes(nodes: ScenarioSearchNode[]): ScenarioSearchNode[] {
  return [...nodes].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
}

export function persistCounterResponseBranches(
  model: ScenarioSearchWorldModel,
  parentNodeId: string,
  responses: CounterResponseCandidate[],
  config: CounterResponseExpansionConfig,
): AdversarialWorldModelUpdate {
  const parent = model.nodes.find((node) => node.nodeId === parentNodeId);
  if (!parent) throw new Error(`Unknown scenario-search parent node: ${parentNodeId}`);

  const expansion = expandCounterResponses(parent, responses, config);
  const existingIds = new Set(model.nodes.map((node) => node.nodeId));
  const newNodes = expansion.responseNodes.filter((node) => !existingIds.has(node.nodeId));
  const nextModel: ScenarioSearchWorldModel = {
    ...model,
    version: model.version + 1,
    activeNodeId: parentNodeId,
    nodes: stableNodes([...model.nodes, ...newNodes]),
    openQuestions: model.openQuestions.filter((question) => question !== `counter:${parentNodeId}`),
  };

  return {
    worldModel: nextModel,
    parentNodeId,
    responseNodeIds: expansion.responseNodes.map((node) => node.nodeId),
    principalVariation: expansion.minimax.principalVariation,
    minimaxValue: expansion.minimax.value,
    depthReached: expansion.minimax.depthReached,
  };
}

export function markCounterResponseQuestion(
  model: ScenarioSearchWorldModel,
  parentNodeId: string,
): ScenarioSearchWorldModel {
  const question = `counter:${parentNodeId}`;
  return model.openQuestions.includes(question)
    ? model
    : { ...model, openQuestions: [...model.openQuestions, question].sort() };
}
