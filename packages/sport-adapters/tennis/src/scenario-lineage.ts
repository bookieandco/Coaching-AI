import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { TennisTacticalScenario } from "./tactical-scenarios";
import type { TennisEpistemicAssessment } from "./epistemic-awareness";

export type TennisScenarioMutationType =
  | "seed"
  | "adaptive_response"
  | "failure_aware"
  | "robustness_variant"
  | "diversity_variant"
  | "manual"
  | "unknown";

export interface TennisScenarioLineageNode {
  scenarioId: string;
  parentScenarioId?: string;
  rootScenarioId: string;
  generation: number;
  mutationType: TennisScenarioMutationType;
  mutationReason?: string;
  mutationParameters?: Record<string, string | number | boolean>;
  failureSignalSignatures?: string[];
  epistemicItemIds?: string[];
  evidenceRefs: EvidenceRef[];
  provenance: { engineVersion: string; modelVersion?: string };
}

export interface TennisScenarioLineage {
  scenarioId: string;
  nodes: TennisScenarioLineageNode[];
  depth: number;
  rootScenarioId: string;
  evidenceRefs: EvidenceRef[];
  uncertainty: number;
  provenance: { engineVersion: string; evidenceRefs: EvidenceRef[] };
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function uniqueRefs(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.evidenceId)) return false;
    seen.add(ref.evidenceId);
    return true;
  });
}

export function createTennisScenarioLineageRoot(
  scenario: TennisTacticalScenario,
  generation = 0,
  evidenceRefs: EvidenceRef[] = [],
  modelVersion?: string,
): TennisScenarioLineage {
  const refs = uniqueRefs([...scenario.evidenceRefs, ...evidenceRefs]);
  const node: TennisScenarioLineageNode = {
    scenarioId: scenario.scenarioId,
    rootScenarioId: scenario.scenarioId,
    generation,
    mutationType: "seed",
    evidenceRefs: refs,
    provenance: { engineVersion: "tennis-scenario-lineage-v1", modelVersion },
  };
  return {
    scenarioId: scenario.scenarioId,
    nodes: [node],
    depth: 0,
    rootScenarioId: scenario.scenarioId,
    evidenceRefs: refs,
    uncertainty: 0,
    provenance: { engineVersion: "tennis-scenario-lineage-v1", evidenceRefs: refs },
  };
}

export function extendTennisScenarioLineage(
  parent: TennisScenarioLineage,
  childScenario: TennisTacticalScenario,
  mutationType: TennisScenarioMutationType,
  mutationReason?: string,
  failureSignalSignatures: string[] = [],
  epistemicItemIds: string[] = [],
  evidenceRefs: EvidenceRef[] = [],
  generation = parent.nodes[parent.nodes.length - 1]?.generation + 1,
  modelVersion?: string,
  epistemicAssessment?: TennisEpistemicAssessment,
): TennisScenarioLineage {
  const parentNode = parent.nodes[parent.nodes.length - 1];
  const refs = uniqueRefs([
    ...parent.evidenceRefs,
    ...childScenario.evidenceRefs,
    ...evidenceRefs,
    ...(epistemicAssessment?.provenance.evidenceRefs ?? []),
  ]);
  const node: TennisScenarioLineageNode = {
    scenarioId: childScenario.scenarioId,
    parentScenarioId: parentNode?.scenarioId,
    rootScenarioId: parent.rootScenarioId,
    generation,
    mutationType,
    mutationReason,
    failureSignalSignatures: [...new Set(failureSignalSignatures)].sort(),
    epistemicItemIds: [...new Set(epistemicItemIds)].sort(),
    evidenceRefs: refs,
    provenance: { engineVersion: "tennis-scenario-lineage-v1", modelVersion },
  };
  const nodes = [...parent.nodes, node];
  const uncertainty = clamp(Math.max(
    parent.uncertainty,
    epistemicAssessment?.uncertainty ?? 0,
  ));
  return {
    scenarioId: childScenario.scenarioId,
    nodes,
    depth: Math.max(0, nodes.length - 1),
    rootScenarioId: parent.rootScenarioId,
    evidenceRefs: refs,
    uncertainty,
    provenance: { engineVersion: "tennis-scenario-lineage-v1", evidenceRefs: refs },
  };
}

export function traceTennisScenarioLineage(lineage: TennisScenarioLineage): TennisScenarioLineageNode[] {
  return [...lineage.nodes].sort((a, b) => a.generation - b.generation || a.scenarioId.localeCompare(b.scenarioId));
}

export function calculateTennisLineageUncertainty(
  lineage: TennisScenarioLineage,
  epistemicAssessments: TennisEpistemicAssessment[] = [],
): number {
  return clamp(Math.max(lineage.uncertainty, ...epistemicAssessments.map((a) => a.uncertainty), 0));
}
