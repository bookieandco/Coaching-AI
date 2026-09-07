import type { ScenarioEvaluation } from "./scenario-evaluation";
import type { ScenarioSearchNode } from "./scenario-search-world-model";
import { minimaxScenarioSearch, type AdversarialSearchNode, type AdversarialSearchConfig } from "./scenario-adversarial-search";

export interface CounterResponseCandidate {
  scenarioId: string;
  label: string;
  evaluation?: ScenarioEvaluation;
  evidenceRefs?: string[];
}

export interface CounterResponseExpansion {
  parentNodeId: string;
  responseNodes: ScenarioSearchNode[];
  adversarialTree: AdversarialSearchNode;
  minimax: ReturnType<typeof minimaxScenarioSearch>;
}

export interface CounterResponseExpansionConfig extends AdversarialSearchConfig {
  maxResponses: number;
}

function stableCandidates(candidates: CounterResponseCandidate[], maxResponses: number): CounterResponseCandidate[] {
  return [...candidates]
    .sort((a, b) => a.scenarioId.localeCompare(b.scenarioId))
    .slice(0, Math.max(1, Math.floor(maxResponses)));
}

export function expandCounterResponses(
  parent: ScenarioSearchNode,
  responses: CounterResponseCandidate[],
  config: CounterResponseExpansionConfig,
): CounterResponseExpansion {
  const selected = stableCandidates(responses, config.maxResponses);
  const responseNodes = selected.map((response, index) => ({
    nodeId: `${parent.nodeId}/counter:${response.scenarioId}`,
    parentNodeId: parent.nodeId,
    scenarioId: response.scenarioId,
    depth: parent.depth + 1,
    status: "evaluated" as const,
    evaluation: response.evaluation,
    action: "counter" as const,
    visits: 1,
    notes: `opponent response branch ${index + 1}`,
  }));

  const adversarialTree: AdversarialSearchNode = {
    node: parent,
    role: "coach",
    children: responseNodes.map((node) => ({ node, role: "opponent", children: [] })),
  };

  return {
    parentNodeId: parent.nodeId,
    responseNodes,
    adversarialTree,
    minimax: minimaxScenarioSearch(adversarialTree, config),
  };
}
