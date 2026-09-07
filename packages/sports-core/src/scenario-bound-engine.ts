import type { ScenarioEvaluation } from "./scenario-evaluation";
import type { ScenarioSearchNode } from "./scenario-search-world-model";

export interface ScenarioBounds {
  lowerBound: number;
  estimate: number;
  upperBound: number;
  confidence: number;
  evidenceCoverage: number;
}

export interface ScenarioBoundedNode {
  node: ScenarioSearchNode;
  bounds: ScenarioBounds;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function score(evaluation?: ScenarioEvaluation): number {
  return clamp01(evaluation?.aggregate ?? 0);
}

function evidenceCoverage(evaluation?: ScenarioEvaluation): number {
  if (!evaluation || !evaluation.dimensions.length) return 0;
  const supported = evaluation.dimensions.filter((dimension) => dimension.evidenceRefs.length > 0).length;
  return supported / evaluation.dimensions.length;
}

/**
 * Produces search bounds from existing evidence, without pretending that a
 * sports outcome is mathematically certified. Bounds are search heuristics
 * unless a downstream verifier explicitly supplies certified intervals.
 */
export function boundScenarioNode(node: ScenarioSearchNode): ScenarioBoundedNode {
  const estimate = score(node.evaluation);
  const coverage = evidenceCoverage(node.evaluation);
  const confidence = clamp01(node.evaluation?.confidence ?? coverage);
  const uncertainty = clamp01(node.evaluation?.uncertainty ?? 1 - confidence);
  const radius = clamp01(Math.max(uncertainty, 1 - coverage) * 0.5);

  return {
    node,
    bounds: {
      lowerBound: clamp01(estimate - radius),
      estimate,
      upperBound: clamp01(estimate + radius),
      confidence,
      evidenceCoverage: coverage,
    },
  };
}

export function canPruneForMaximization(
  candidate: ScenarioBoundedNode,
  incumbentLowerBound: number,
): boolean {
  return candidate.bounds.upperBound <= clamp01(incumbentLowerBound);
}

export function canPruneForMinimization(
  candidate: ScenarioBoundedNode,
  incumbentUpperBound: number,
): boolean {
  return candidate.bounds.lowerBound >= clamp01(incumbentUpperBound);
}

export function rankBoundedNodes(nodes: ScenarioBoundedNode[]): ScenarioBoundedNode[] {
  return [...nodes].sort((a, b) =>
    b.bounds.upperBound - a.bounds.upperBound ||
    b.bounds.confidence - a.bounds.confidence ||
    a.node.nodeId.localeCompare(b.node.nodeId),
  );
}
