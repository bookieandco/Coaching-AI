import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { TennisScenarioCandidate } from "./adaptive-scenario-search";
import type { TennisTacticalScenario, TennisOpponentResponse } from "./tactical-scenarios";
import type { TennisCounterfactualState } from "./counterfactual";
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

export type TennisPerturbationKind = "response_weight" | "simulation_budget";

export interface TennisPerturbationSpec {
  perturbationId: string;
  kind: TennisPerturbationKind;
  responseType?: string;
  factor?: number;
  maxSteps?: number;
  description: string;
}

export interface TennisPerturbationSample {
  perturbation: TennisPerturbationSpec;
  seed: number;
  scenario: TennisTacticalScenario;
  simulation: TennisSimulationResult;
  winPathReport: TennisWinPathReport;
}

export interface TennisPerturbationRobustnessConfig {
  seed: number;
  simulationCount: number;
  maxSteps: number;
  responseWeightMagnitude?: number;
  testSimulationBudget?: boolean;
  modelVersion?: string;
}

export interface TennisPerturbationRobustnessReport {
  scenarioId: string;
  baselineWinPathCoverage: number;
  perturbedWinPathCoverageMean: number;
  perturbedWinPathCoverageMin: number;
  perturbedWinPathCoverageMax: number;
  sensitivity: number;
  perturbationStability: number;
  robust: boolean;
  samples: TennisPerturbationSample[];
  uncertainty: number;
  provenance: {
    engineVersion: string;
    baseSeed: number;
    simulationCount: number;
    maxSteps: number;
    evidenceRefs: EvidenceRef[];
  };
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const weightClamp = (value: number): number => Math.max(0.05, Math.min(4, value));

function uniqueRefs(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.evidenceId)) return false;
    seen.add(ref.evidenceId);
    return true;
  });
}

function perturbResponseWeight(
  scenario: TennisTacticalScenario,
  responseType: string,
  factor: number,
): TennisTacticalScenario {
  const scenarioId = `${scenario.scenarioId}:perturb:${responseType}:${factor.toFixed(3)}`;
  const interventionId = `${scenario.intervention.interventionId}:perturb:${responseType}`;
  const responses: TennisOpponentResponse[] = scenario.opponentResponses.map((response) => ({
    ...response,
    responseId: `${interventionId}:response:${response.type}`,
    relativeWeight: response.type === responseType
      ? weightClamp(response.relativeWeight * factor)
      : response.relativeWeight,
  }));

  const responseIds = new Set(responses.map((response) => response.responseId));
  const counters = scenario.counterPaths
    .map((counter) => ({
      ...counter,
      counterId: `${interventionId}:counter:${counter.type}`,
      responseId: `${interventionId}:response:${counter.responseId.split(":").pop()}`,
    }))
    .filter((counter) => responseIds.has(counter.responseId));

  return {
    ...scenario,
    scenarioId,
    intervention: { ...scenario.intervention, interventionId },
    opponentResponses: responses,
    counterPaths: counters,
    provenance: { ...scenario.provenance, engineVersion: "tennis-perturbation-robustness-v1" },
  };
}

function perturbSimulationBudget(
  scenario: TennisTacticalScenario,
  maxSteps: number,
): TennisTacticalScenario {
  return {
    ...scenario,
    scenarioId: `${scenario.scenarioId}:budget:${maxSteps}`,
    provenance: { ...scenario.provenance, engineVersion: "tennis-perturbation-robustness-v1" },
  };
}

/**
 * B-31: same counterfactual state + same scenario under independent seeds.
 * This measures stochastic stability, not calibrated probability or advice.
 */
export function evaluateTennisScenarioRobustness(
  candidate: TennisScenarioCandidate,
  counterfactual: TennisCounterfactualState,
  config: TennisRobustnessConfig,
): TennisRobustnessReport {
  if (!candidate.valid) {
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
      provenance: { engineVersion: "tennis-scenario-robustness-v2", seeds: [], simulationCount: 0, maxSteps: 0, evidenceRefs: candidate.scenario.evidenceRefs },
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
    const simulation = simulateTennisScenario(counterfactual, candidate.scenario, simulationConfig);
    samples.push({ seed, simulation, winPathReport: buildTennisWinPathReport(candidate.scenario, simulation) });
  }

  const coverages = samples.map((sample) => sample.winPathReport.coverage.winPathCoverage);
  const mean = coverages.length ? coverages.reduce((sum, value) => sum + value, 0) / coverages.length : 0;
  const min = coverages.length ? Math.min(...coverages) : 0;
  const max = coverages.length ? Math.max(...coverages) : 0;
  const range = max - min;
  const stability = clamp(1 - range);
  const evidenceRefs = uniqueRefs([
    ...counterfactual.evidenceRefs,
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
    robust: samples.length >= 2 && stability >= 0.8,
    samples,
    uncertainty: samples.length >= 2 ? clamp(0.5 + range * 0.5) : 1,
    provenance: {
      engineVersion: "tennis-scenario-robustness-v2",
      seeds,
      simulationCount: Math.max(1, Math.floor(config.simulationCount)),
      maxSteps: Math.max(1, Math.floor(config.maxSteps)),
      evidenceRefs,
    },
  };
}

/**
 * B-32: perturb only hypothetical simulation assumptions. Observed facts and
 * the canonical match state are never mutated. Each sample is independently
 * replayable from the same counterfactual state.
 */
export function evaluateTennisScenarioPerturbationRobustness(
  candidate: TennisScenarioCandidate,
  counterfactual: TennisCounterfactualState,
  config: TennisPerturbationRobustnessConfig,
): TennisPerturbationRobustnessReport {
  const baseline = candidate.winPathReport?.coverage.winPathCoverage ?? 0;
  if (!candidate.valid) {
    return {
      scenarioId: candidate.scenario.scenarioId,
      baselineWinPathCoverage: baseline,
      perturbedWinPathCoverageMean: 0,
      perturbedWinPathCoverageMin: 0,
      perturbedWinPathCoverageMax: 0,
      sensitivity: 1,
      perturbationStability: 0,
      robust: false,
      samples: [],
      uncertainty: 1,
      provenance: { engineVersion: "tennis-perturbation-robustness-v1", baseSeed: config.seed, simulationCount: 0, maxSteps: 0, evidenceRefs: candidate.scenario.evidenceRefs },
    };
  }

  const magnitude = clamp(config.responseWeightMagnitude ?? 0.1);
  const specs: TennisPerturbationSpec[] = [];
  for (const response of candidate.scenario.opponentResponses) {
    specs.push({ perturbationId: `${response.type}:down`, kind: "response_weight", responseType: response.type, factor: 1 - magnitude, description: `reduce ${response.type} response weight by ${Math.round(magnitude * 100)}%` });
    specs.push({ perturbationId: `${response.type}:up`, kind: "response_weight", responseType: response.type, factor: 1 + magnitude, description: `increase ${response.type} response weight by ${Math.round(magnitude * 100)}%` });
  }
  if (config.testSimulationBudget) {
    const baseSteps = Math.max(1, Math.floor(config.maxSteps));
    specs.push({ perturbationId: "budget:down", kind: "simulation_budget", maxSteps: Math.max(1, Math.floor(baseSteps * 0.8)), description: "reduce simulation horizon by 20%" });
    specs.push({ perturbationId: "budget:up", kind: "simulation_budget", maxSteps: Math.max(baseSteps + 1, Math.ceil(baseSteps * 1.2)), description: "increase simulation horizon by 20%" });
  }

  const samples: TennisPerturbationSample[] = [];
  const baseSimulationCount = Math.max(1, Math.floor(config.simulationCount));
  const baseMaxSteps = Math.max(1, Math.floor(config.maxSteps));
  specs.forEach((spec, index) => {
    const scenario = spec.kind === "response_weight"
      ? perturbResponseWeight(candidate.scenario, spec.responseType!, spec.factor!)
      : perturbSimulationBudget(candidate.scenario, spec.maxSteps!);
    const maxSteps = spec.kind === "simulation_budget" ? spec.maxSteps! : baseMaxSteps;
    const seed = (config.seed + (index + 1) * 1009) | 0;
    const simulation = simulateTennisScenario(counterfactual, scenario, {
      simulationCount: baseSimulationCount,
      maxSteps,
      seed,
      modelVersion: config.modelVersion,
    });
    samples.push({ perturbation: spec, seed, scenario, simulation, winPathReport: buildTennisWinPathReport(scenario, simulation) });
  });

  const coverages = samples.map((sample) => sample.winPathReport.coverage.winPathCoverage);
  const mean = coverages.length ? coverages.reduce((sum, value) => sum + value, 0) / coverages.length : baseline;
  const min = coverages.length ? Math.min(...coverages) : baseline;
  const max = coverages.length ? Math.max(...coverages) : baseline;
  const sensitivity = coverages.length
    ? clamp(coverages.reduce((sum, value) => sum + Math.abs(value - baseline), 0) / coverages.length)
    : 1;
  const stability = clamp(1 - sensitivity);
  const evidenceRefs = uniqueRefs([
    ...counterfactual.evidenceRefs,
    ...candidate.scenario.evidenceRefs,
    ...samples.flatMap((sample) => sample.winPathReport.provenance.evidenceRefs),
  ]);

  return {
    scenarioId: candidate.scenario.scenarioId,
    baselineWinPathCoverage: baseline,
    perturbedWinPathCoverageMean: mean,
    perturbedWinPathCoverageMin: min,
    perturbedWinPathCoverageMax: max,
    sensitivity,
    perturbationStability: stability,
    robust: samples.length >= 2 && stability >= 0.8,
    samples,
    uncertainty: samples.length >= 2 ? clamp(0.5 + sensitivity * 0.5) : 1,
    provenance: {
      engineVersion: "tennis-perturbation-robustness-v1",
      baseSeed: config.seed,
      simulationCount: baseSimulationCount,
      maxSteps: baseMaxSteps,
      evidenceRefs,
    },
  };
}
