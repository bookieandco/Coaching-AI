import type { EvidenceRef } from "./index";
import type { EvidenceGraph, EvidenceGraphNode } from "./evidence-graph";

export type CoachExplanationKind =
  | "observed"
  | "inferred"
  | "hypothesis"
  | "scenario"
  | "simulation"
  | "outcome"
  | "evaluation"
  | "unknown"
  | "contradicted";

export interface CoachExplanationItem {
  id: string;
  kind: CoachExplanationKind;
  statement: string;
  confidence: number;
  uncertainty: number;
  evidenceRefs: EvidenceRef[];
  relatedNodeIds: string[];
}

export interface CoachExplanationReadModel {
  explanationId: string;
  stateSignature: string;
  items: CoachExplanationItem[];
  supportingEvidence: EvidenceRef[];
  unresolvedQuestions: string[];
  contradictions: string[];
  evidenceCoverage: number;
  uncertainty: number;
  provenance: { engineVersion: string };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function kindForNode(node: EvidenceGraphNode): CoachExplanationKind {
  return node.type === "observation" || node.type === "inference" || node.type === "hypothesis" ||
    node.type === "scenario" || node.type === "simulation" || node.type === "outcome" ||
    node.type === "evaluation" || node.type === "unknown" ? node.type : "unknown";
}

export function buildCoachExplanationReadModel(input: {
  explanationId: string;
  stateSignature: string;
  graph: EvidenceGraph;
}): CoachExplanationReadModel {
  const contradicted = new Set(
    input.graph.edges
      .filter((edge) => edge.relation === "contradicts")
      .map((edge) => edge.toNodeId),
  );

  const items = input.graph.nodes.map((node) => ({
    id: node.nodeId,
    kind: contradicted.has(node.nodeId) ? "contradicted" as const : kindForNode(node),
    statement: node.statement ?? node.label,
    confidence: clamp01(node.confidence),
    uncertainty: clamp01(node.uncertainty),
    evidenceRefs: node.evidenceRefs,
    relatedNodeIds: input.graph.edges
      .filter((edge) => edge.fromNodeId === node.nodeId || edge.toNodeId === node.nodeId)
      .map((edge) => edge.fromNodeId === node.nodeId ? edge.toNodeId : edge.fromNodeId)
      .sort(),
  }));

  return {
    explanationId: input.explanationId,
    stateSignature: input.stateSignature,
    items,
    supportingEvidence: input.graph.provenance.evidenceRefs,
    unresolvedQuestions: input.graph.unresolvedNodeIds
      .map((id) => input.graph.nodes.find((node) => node.nodeId === id)?.statement ?? id),
    contradictions: items
      .filter((item) => item.kind === "contradicted")
      .map((item) => item.statement),
    evidenceCoverage: clamp01(input.graph.coverage),
    uncertainty: clamp01(input.graph.uncertainty),
    provenance: { engineVersion: "universal-coach-explanation-v1" },
  };
}
