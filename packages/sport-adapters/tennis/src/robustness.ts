import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { TennisScenarioCandidate } from "./adaptive-scenario-search";
import { simulateTennisScenario, type TennisSimulationConfig, type TennisSimulationResult } from "./simulation-kernel";
import { buildTennisWinPathReport, type TennisWinPathReport } from "./win-path-engine";

export interface TennisRobustnessConfig {
  seeds: number[];
  simulationCount: number;
  maxSteps: number;
  modelVersion?: string;
}

export interface TennisRobustnessSample {
  seed: number;
  simulation: TennisSimulationResult;
  winPathReport: TennisWinPathReport;
}

export interface TennisRobustnessReport {
  scenarioId: string;
  sampleCount: number;
  winPathCoverageMean: number;
  winPathCoverageMin: number;
  winPathCoverageMax: number;
  winPathCoverageRange: number;
  crossSeedStability: number;
  robust: boolean;
  samples: TennisRobustnessSample[];
  uncertainty: number;
  provenance: {
    engineVersion: string;
    seeds: number[];
    simulationCount: number;
    maxSteps: number;
    evidenceRefs: EvidenceRef[];
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function uniqueRefs(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.evidenceId)) return false;
    seen.add(ref.evidenceId);
    return true;
  });
}

/**
 * Replays one already-generated scenario under independent deterministic seeds.
 * This measures stability of the simulated branch; it does not convert branch
 * frequency into a calibrated probability or recommend a coaching action.
 */
export function evaluateTennisScenarioRobustness(
  candidate: TennisScenarioCandidate,
  config: TennisRobustnessConfig,
): TennisRobustnessReport {
  if (!candidate.valid || !candidate.simulation) {
    return {
      scenarioId: candidate.scenario.scenarioId,
      sampleCount: 0,
      winPathCoverageMean: 0,
      winPathCoverageMin: 0,
      winPathCoverageMax: 0,
      winPathCoverageRange: 1,
      crossSeedStability: 0,
      robust: false,
      samples: [],
      uncertainty: 1,
      provenance: {
        engineVersion: "tennis-scenario-robustness-v1",
        seeds: [],
        simulationCount: 0,
        maxSteps: 0,
        evidenceRefs: candidate.scenario.evidenceRefs,
      },
    };
  }

  const seeds = [...new Set(config.seeds.map((seed) => seed | 0))].sort((a, b) => a - b);
  const samples: TennisRobustnessSample[] = [];
  for (const seed of seeds) {
    const simulationConfig: TennisSimulationConfig = {
      simulationCount: Math.max(1, Math.floor(config.simulationCount)),
      maxSteps: Math.max(1, Math.floor(config.maxSteps)),
      seed,
      modelVersion: config.modelVersion,
    };
    const simulation = simulateTennisScenario(
      candidate.simulation.trajectories[0]?.finalState
        ? {
            ...candidate.simulation.trajectories[0].finalState,
            scenarioId: candidate.scenario.scenarioId,
            sourceStateVersion: candidate.simulation.sourceStateVersion,
            stateVersion: candidate.simulation.trajectories[0].finalState.stateVersion,
            delta: {
              changedPaths: [],
              tacticalMode: candidate.simulation.trajectories[0].finalState.attributes.tacticalMode ?? {},
            },
            evidenceRefs: candidate.scenario.evidenceRefs,
            provenance: { engineVersion: "tennis-counterfactual-v1", source: "hypothetical" },
          },
      candidate.scenario,
      simulationConfig,
    );
    const report = buildTennisWinPathReport(candidate.scenario, simulation);
    samples.push({ seed, simulation, winPathReport: report });
  }

  const coverages = samples.map((sample) => sample.winPathReport.coverage.winPathCoverage);
  const mean = coverages.length ? coverages.reduce((sum, value) => sum + value, 0) / coverages.length : 0;
  const min = coverages.length ? Math.min(...coverages) : 0;
  const max = coverages.length ? Math.max(...coverages) : 0;
  const range = max - min;
  const stability = clamp(1 - range);
  const robust = samples.length >= 2 && stability >= 0.8;
  const evidenceRefs = uniqueRefs([
    ...candidate.scenario.evidenceRefs,
    ...samples.flatMap((sample) => sample.winPathReport.provenance.evidenceRefs),
  ]);

  return {
    scenarioId: candidate.scenario.scenarioId,
    sampleCount: samples.length,
    winPathCoverageMean: mean,
    winPathCoverageMin: min,
    winPathCoverageMax: max,
    winPathCoverageRange: range,
    crossSeedStability: stability,
    robust,
    samples,
    uncertainty: samples.length >= 2 ? clamp(0.5 + range * 0.5) : 1,
    provenance: {
      engineVersion: "tennis-scenario-robustness-v1",
      seeds,
      simulationCount: Math.max(1, Math.floor(config.simulationCount)),
      maxSteps: Math.max(1, Math.floor(config.maxSteps)),
      evidenceRefs,
    },
  };
}
