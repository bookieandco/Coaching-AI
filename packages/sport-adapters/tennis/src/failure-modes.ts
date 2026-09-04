import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { TennisScenarioCandidate } from "./adaptive-scenario-search";

export type TennisFailureMode =
  | "opponent_response"
  | "counter_path"
  | "insufficient_terminal_support"
  | "low_robustness"
  | "simulation_budget"
  | "invalid_scenario";

export interface TennisFailureModeObservation {
  scenarioId: string;
  mode: TennisFailureMode;
  signature: string;
  severity: number;
  evidenceRefs: EvidenceRef[];
}

export interface TennisFailureModeCluster {
  clusterId: string;
  mode: TennisFailureMode;
  signature: string;
  scenarioIds: string[];
  count: number;
  meanSeverity: number;
  evidenceRefs: EvidenceRef[];
}

export interface TennisCrossScenarioStabilityReport {
  scenarioCount: number;
  stableScenarioCount: number;
  failureObservationCount: number;
  clusters: TennisFailureModeCluster[];
  crossScenarioFailureConcentration: number;
  uncertainty: number;
  provenance: { engineVersion: string; evidenceRefs: EvidenceRef[] };
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

function uniqueRefs(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.evidenceId)) return false;
    seen.add(ref.evidenceId);
    return true;
  });
}

function observationsForCandidate(candidate: TennisScenarioCandidate): TennisFailureModeObservation[] {
  const refs = candidate.scenario.evidenceRefs;
  if (!candidate.valid) {
    return [{ scenarioId: candidate.scenario.scenarioId, mode: "invalid_scenario", signature: candidate.repair.reasons.join("|") || "invalid", severity: 1, evidenceRefs: refs }];
  }

  const report = candidate.winPathReport;
  if (!report || report.paths.length === 0) {
    return [{ scenarioId: candidate.scenario.scenarioId, mode: "insufficient_terminal_support", signature: "no_terminal_path", severity: 1, evidenceRefs: refs }];
  }

  const observations: TennisFailureModeObservation[] = [];
  const failurePaths = report.paths.filter((path) => path.classification === "failure_path");
  for (const path of failurePaths) {
    const mode: TennisFailureMode = path.responseType ? "opponent_response" : path.counterType ? "counter_path" : "insufficient_terminal_support";
    const signature = `${mode}:${path.responseType ?? "unknown"}:${path.counterType ?? "none"}`;
    observations.push({ scenarioId: candidate.scenario.scenarioId, mode, signature, severity: clamp(path.frequency), evidenceRefs: uniqueRefs([...refs, ...path.evidenceRefs]) });
  }

  const robustness = candidate.perturbationRobustness?.perturbationStability;
  if (robustness !== undefined && robustness < 0.8) {
    observations.push({ scenarioId: candidate.scenario.scenarioId, mode: "low_robustness", signature: `stability:${robustness.toFixed(2)}`, severity: clamp(1 - robustness), evidenceRefs: refs });
  }

  if (failurePaths.length === 0 && report.coverage.winPathCoverage === 0) {
    observations.push({ scenarioId: candidate.scenario.scenarioId, mode: "insufficient_terminal_support", signature: "no_win_support", severity: 1, evidenceRefs: refs });
  }

  return observations;
}

/**
 * Groups failure evidence across scenarios. This is descriptive analysis only:
 * clusters explain recurring failure signatures but never select a tactic.
 */
export function buildTennisCrossScenarioStabilityReport(candidates: TennisScenarioCandidate[]): TennisCrossScenarioStabilityReport {
  const observations = candidates.flatMap(observationsForCandidate);
  const clusters = new Map<string, TennisFailureModeCluster>();
  for (const observation of observations) {
    const key = `${observation.mode}:${observation.signature}`;
    const existing = clusters.get(key);
    if (existing) {
      if (!existing.scenarioIds.includes(observation.scenarioId)) existing.scenarioIds.push(observation.scenarioId);
      existing.count += 1;
      existing.meanSeverity = (existing.meanSeverity * (existing.count - 1) + observation.severity) / existing.count;
      existing.evidenceRefs = uniqueRefs([...existing.evidenceRefs, ...observation.evidenceRefs]);
      continue;
    }
    clusters.set(key, {
      clusterId: `failure-cluster:${clusters.size + 1}`,
      mode: observation.mode,
      signature: observation.signature,
      scenarioIds: [observation.scenarioId],
      count: 1,
      meanSeverity: observation.severity,
      evidenceRefs: observation.evidenceRefs,
    });
  }

  const ordered = [...clusters.values()].sort((a, b) => b.count - a.count || b.meanSeverity - a.meanSeverity || a.clusterId.localeCompare(b.clusterId));
  const maxClusterCount = ordered[0]?.count ?? 0;
  const concentration = observations.length > 0 ? clamp(maxClusterCount / observations.length) : 0;
  const stableScenarioCount = candidates.filter((candidate) => candidate.perturbationRobustness?.perturbationStability === undefined || candidate.perturbationRobustness.perturbationStability >= 0.8).length;

  return {
    scenarioCount: candidates.length,
    stableScenarioCount,
    failureObservationCount: observations.length,
    clusters: ordered,
    crossScenarioFailureConcentration: concentration,
    uncertainty: candidates.length >= 2 ? clamp(0.5 + (1 - stableScenarioCount / Math.max(1, candidates.length)) * 0.5) : 1,
    provenance: {
      engineVersion: "tennis-cross-scenario-failure-clustering-v1",
      evidenceRefs: uniqueRefs(candidates.flatMap((candidate) => candidate.scenario.evidenceRefs)),
    },
  };
}
