import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { TennisTacticalScenario } from "./tactical-scenarios";
import type { TennisSimulationResult } from "./simulation-kernel";

export type TennisPathClass = "win_path" | "failure_path" | "neutral_path";

export interface TennisWinPath {
  pathId: string;
  scenarioId: string;
  classification: TennisPathClass;
  responseType?: string;
  counterType?: string;
  frequency: number;
  robustness: number;
  evidenceRefs: EvidenceRef[];
}

export interface TennisWinPathReport {
  scenarioId: string;
  sourceStateVersion: number;
  paths: TennisWinPath[];
  coverage: {
    winPathCoverage: number;
    failurePathCoverage: number;
    neutralPathCoverage: number;
  };
  uncertainty: number;
  provenance: {
    engineVersion: string;
    simulationSeed: number;
    simulationCount: number;
    evidenceRefs: EvidenceRef[];
  };
}

/**
 * B-23 deliberately does not infer a winner from tactical branch selection.
 * Until a validated tennis outcome-transition model exists, simulated branches
 * are neutral. This creates the aggregation contract without manufacturing win rates.
 */
export function buildTennisWinPathReport(
  scenario: TennisTacticalScenario,
  simulation: TennisSimulationResult,
): TennisWinPathReport {
  const total = simulation.trajectories.length;
  const groups = new Map<string, TennisWinPath>();

  for (const trajectory of simulation.trajectories) {
    const key = `${trajectory.terminalClass}:${trajectory.responseType ?? "unknown"}:${trajectory.counterType ?? "none"}`;
    const existing = groups.get(key);
    if (existing) {
      existing.frequency += 1;
      continue;
    }
    groups.set(key, {
      pathId: `${scenario.scenarioId}:path:${groups.size + 1}`,
      scenarioId: scenario.scenarioId,
      classification: "neutral_path",
      responseType: trajectory.responseType,
      counterType: trajectory.counterType,
      frequency: 1,
      robustness: 0,
      evidenceRefs: simulation.provenance.evidenceRefs,
    });
  }

  const paths = [...groups.values()].map((path) => ({
    ...path,
    frequency: total > 0 ? path.frequency / total : 0,
    robustness: total > 0 ? Math.min(1, path.frequency / total) : 0,
  }));

  return {
    scenarioId: scenario.scenarioId,
    sourceStateVersion: simulation.sourceStateVersion,
    paths,
    coverage: {
      winPathCoverage: 0,
      failurePathCoverage: 0,
      neutralPathCoverage: total > 0 ? 1 : 0,
    },
    uncertainty: 1,
    provenance: {
      engineVersion: "tennis-win-path-v1",
      simulationSeed: simulation.provenance.seed,
      simulationCount: total,
      evidenceRefs: simulation.provenance.evidenceRefs,
    },
  };
}
