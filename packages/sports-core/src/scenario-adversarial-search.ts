import type { ScenarioEvaluation } from "./scenario-evaluation";
import type { ScenarioSearchNode } from "./scenario-search-world-model";
import { boundScenarioNode, canPruneForMaximization, canPruneForMinimization, rankBoundedNodes } from "./scenario-bound-engine";

export type AdversarialRole = "coach" | "opponent";

export interface AdversarialSearchConfig {
  depth: number;
  maxChildren: number;
  resilienceWeight?: number;
  allowHeuristicBoundPruning?: boolean;
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
  strategy: "minimax" | "alpha-beta";
  nodesVisited: number;
  prunedBranches: number;
  boundPrunedBranches: number;
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
  const allowHeuristicBoundPruning = config.allowHeuristicBoundPruning ?? false;
  let nodesVisited = 0;
  let prunedBranches = 0;
  let boundPrunedBranches = 0;

  function visit(node: AdversarialSearchNode, depth: number, alpha: number, beta: number): { value: number; pv: string[]; reached: number } {
    nodesVisited += 1;
    const children = stableChildren(node.children, maxChildren);
    if (depth >= maxDepth || !children.length) {
      return { value: valueOf(node.node.evaluation, resilienceWeight), pv: [node.node.nodeId], reached: depth };
    }

    const maximizing = node.role === "coach";
    const ranked = rankBoundedNodes(
      children.map((child) => boundScenarioNode(child.node)),
      node.role,
    ).map((bounded) => children.find((child) => child.node.nodeId === bounded.node.nodeId)!)
      .filter(Boolean);
    let bestValue = maximizing ? -Infinity : Infinity;
    let bestChild: AdversarialSearchNode | undefined;
    let bestResult: { value: number; pv: string[]; reached: number } | undefined;

    for (const child of ranked) {
      const bounded = boundScenarioNode(child.node);
      const boundPruned = maximizing
        ? canPruneForMaximization(bounded, bestValue, allowHeuristicBoundPruning)
        : canPruneForMinimization(bounded, bestValue, allowHeuristicBoundPruning);

      if (boundPruned) {
        boundPrunedBranches += 1;
        continue;
      }

      const result = visit(child, depth + 1, alpha, beta);
      const better = maximizing
        ? result.value > bestValue || (result.value === bestValue && child.node.nodeId.localeCompare(bestChild?.node.nodeId ?? "") < 0)
        : result.value < bestValue || (result.value === bestValue && child.node.nodeId.localeCompare(bestChild?.node.nodeId ?? "") < 0);
      if (better) {
        bestValue = result.value;
        bestChild = child;
        bestResult = result;
      }

      if (maximizing) alpha = Math.max(alpha, bestValue);
      else beta = Math.min(beta, bestValue);

      if (beta <= alpha) {
        prunedBranches += ranked.length - ranked.indexOf(child) - 1;
        break;
      }
    }

    return {
      value: bestValue === -Infinity || bestValue === Infinity ? valueOf(node.node.evaluation, resilienceWeight) : bestValue,
      pv: [node.node.nodeId, ...(bestResult?.pv ?? [])],
      reached: bestResult?.reached ?? depth,
    };
  }

  const result = visit(root, 0, -Infinity, Infinity);
  return {
    nodeId: root.node.nodeId,
    value: result.value,
    principalVariation: result.pv,
    depthReached: result.reached,
    strategy: "alpha-beta",
    nodesVisited,
    prunedBranches,
    boundPrunedBranches,
  };
}
