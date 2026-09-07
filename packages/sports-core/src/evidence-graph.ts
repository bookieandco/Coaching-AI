import type { EvidenceRef } from "./index";

export type EvidenceGraphNodeType =
  | "observation"
  | "inference"
  | "hypothesis"
  | "scenario"
  | "simulation"
  | "outcome"
  | "evaluation"
  | "unknown";

export type EvidenceGraphRelation =
  | "supports"
  | "contradicts"
  | "derived_from"
  | "tests"
  | "simulates"
  | "observes"
  | "evaluates"
  | "requires";

export interface EvidenceGraphNode {
  nodeId: string;
  type: EvidenceGraphNodeType;
  label: string;
  statement?: string;
  confidence: number;
  uncertainty: number;
  evidenceRefs: EvidenceRef[];
  provenance?: { engineVersion: string; modelVersion?: string };
}

export interface EvidenceGraphEdge {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  relation: EvidenceGraphRelation;
  strength: number;
  evidenceRefs: EvidenceRef[];
}

export interface EvidenceGraph {
  graphId: string;
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
  unresolvedNodeIds: string[];
  coverage: number;
  uncertainty: number;
  provenance: { engineVersion: string; evidenceRefs: EvidenceRef[] };
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function uniqueRefs(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.evidenceId)) return false;
    seen.add(ref.evidenceId);
    return true;
  });
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function buildEvidenceGraph(input: {
  graphId: string;
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
  engineVersion?: string;
}): EvidenceGraph {
  const nodeIds = new Set(input.nodes.map((node) => node.nodeId));
  const nodes = input.nodes.map((node) => ({
    ...node,
    confidence: clamp01(node.confidence),
    uncertainty: clamp01(node.uncertainty),
    evidenceRefs: uniqueRefs(node.evidenceRefs),
  }));
  const edges = input.edges.filter(
    (edge) => nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId),
  ).map((edge) => ({
    ...edge,
    strength: clamp01(edge.strength),
    evidenceRefs: uniqueRefs(edge.evidenceRefs),
  }));

  const unresolved = nodes.filter(
    (node) => node.type === "unknown" || node.evidenceRefs.length === 0,
  ).map((node) => node.nodeId);

  const supported = nodes.length === 0
    ? 0
    : nodes.filter((node) => node.evidenceRefs.length > 0).length / nodes.length;
  const meanUncertainty = nodes.length === 0
    ? 1
    : nodes.reduce((sum, node) => sum + node.uncertainty, 0) / nodes.length;

  const refs = uniqueRefs([
    ...nodes.flatMap((node) => node.evidenceRefs),
    ...edges.flatMap((edge) => edge.evidenceRefs),
  ]);

  return {
    graphId: input.graphId,
    nodes,
    edges,
    unresolvedNodeIds: uniqueStrings(unresolved),
    coverage: clamp01(supported),
    uncertainty: clamp01(meanUncertainty),
    provenance: {
      engineVersion: input.engineVersion ?? "universal-evidence-graph-v1",
      evidenceRefs: refs,
    },
  };
}

export function traceEvidenceGraph(
  graph: EvidenceGraph,
  nodeId: string,
): { node: EvidenceGraphNode | undefined; ancestors: EvidenceGraphNode[]; descendants: EvidenceGraphNode[] } {
  const nodeById = new Map(graph.nodes.map((node) => [node.nodeId, node]));
  const ancestors = new Set<string>();
  const descendants = new Set<string>();

  const walk = (current: string, direction: "in" | "out", seen: Set<string>) => {
    for (const edge of graph.edges) {
      const next = direction === "in"
        ? edge.toNodeId === current ? edge.fromNodeId : undefined
        : edge.fromNodeId === current ? edge.toNodeId : undefined;
      if (!next || seen.has(next)) continue;
      seen.add(next);
      walk(next, direction, seen);
    }
  };

  walk(nodeId, "in", ancestors);
  walk(nodeId, "out", descendants);

  return {
    node: nodeById.get(nodeId),
    ancestors: [...ancestors].map((id) => nodeById.get(id)).filter((node): node is EvidenceGraphNode => Boolean(node)),
    descendants: [...descendants].map((id) => nodeById.get(id)).filter((node): node is EvidenceGraphNode => Boolean(node)),
  };
}
