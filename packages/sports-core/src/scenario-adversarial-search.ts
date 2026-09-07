import type { ScenarioEvaluation } from "./scenario-evaluation";
import type { ScenarioSearchNode } from "./scenario-search-world-model";

export type AdversarialRole = "coach" | "opponent";

export interface AdversarialSearchConfig {
  depth: number;
  maxChildren: number;
  resilienceWeight?: number;
}

export interface AdversarialSearchNode {
  node: ScenarioSearchNode;
  role: AdversarialRole;
  children: AdversarialSearchNode[];
}

export interface AdversarialSearchResult {
  nodeId: string;
  value: number;
  principalVariation: string[];
  depthReached: number;
  strategy: "minimax";
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function valueOf(evaluation?: ScenarioEvaluation, resilienceWeight = 0.5): number {
  if (!evaluation) return 0;
  const win = evaluation.dimensions.find((d) => d.dimension === "win_path_support")?.score ?? evaluation.aggregate ?? 0;
  const resilience = evaluation.dimensions.find((d) => d.dimension === "opponent_response_resilience")?.score ?? win;
  return clamp01((1 - resilienceWeight) * win + resilienceWeight * resilience);
}

function stableChildren(children: AdversarialSearchNode[], maxChildren: number): AdversarialSearchNode[] {
  return [...children]
    .sort((a, b) => a.node.nodeId.localeCompare(b.node.nodeId))
    .slice(0, Math.max(1, Math.floor(maxChildren)));
}

export function minimaxScenarioSearch(
  root: AdversarialSearchNode,
  config: AdversarialSearchConfig,
): AdversarialSearchResult {
  const maxDepth = Math.max(0, Math.floor(config.depth));
  const resilienceWeight = clamp01(config.resilienceWeight ?? 0.5);
  const maxChildren = Math.max(1, Math.floor(config.maxChildren));

  function visit(node: AdversarialSearchNode, depth: number): { value: number; pv: string[]; reached: number } {
    const children = stableChildren(node.children, maxChildren);
    if (depth >= maxDepth || !children.length) {
      return { value: valueOf(node.node.evaluation, resilienceWeight), pv: [node.node.nodeId], reached: depth };
    }

    const results = children.map((child) => ({ child, result: visit(child, depth + 1) }));
    const maximizing = node.role === "coach";
    results.sort((a, b) => maximizing
      ? b.result.value - a.result.value || a.child.node.nodeId.localeCompare(b.child.node.nodeId)
      : a.result.value - b.result.value || a.child.node.nodeId.localeCompare(b.child.node.nodeId));
    const selected = results[0];
    return {
      value: selected.result.value,
      pv: [node.node.nodeId, ...selected.result.pv],
      reached: selected.result.reached,
    };
  }

  const result = visit(root, 0);
  return {
    nodeId: root.node.nodeId,
    value: result.value,
    principalVariation: result.pv,
    depthReached: result.reached,
    strategy: "minimax",
  };
}
