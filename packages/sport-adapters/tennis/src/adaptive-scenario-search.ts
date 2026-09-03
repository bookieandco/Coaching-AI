import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { TennisMatchState } from "./index";
import type { TennisMatchupModel } from "./matchup-intelligence";
import {
  generateTennisTacticalScenarios,
  type TennisTacticalScenario,
} from "./tactical-scenarios";
import {
  buildTennisCounterfactualState,
  type TennisCounterfactualState,
} from "./counterfactual";
import {
  simulateTennisScenario,
  type TennisSimulationConfig,
  type TennisSimulationResult,
} from "./simulation-kernel";
import {
  buildTennisWinPathReport,
  type TennisWinPathReport,
} from "./win-path-engine";
import type { TennisAdaptiveState } from "./adaptive-opponent";

export type TennisScenarioObjective =
  | "win_path_support"
  | "failure_avoidance"
  | "robustness"
  | "evidence_strength"
  | "tactical_diversity";

export interface TennisScenarioSearchConfig {
  populationSize: number;
  eliteCount: number;
  diversityFloor: number;
  maxGenerations: number;
  simulationCount: number;
  maxSteps: number;
  seed: number;
  modelVersion?: string;
}

export interface TennisScenarioScore {
  objective: TennisScenarioObjective;
  value: number;
  uncertainty: number;
  evidenceRefs: EvidenceRef[];
}

export interface TennisScenarioRepair {
  repaired: boolean;
  reasons: string[];
}

export interface TennisScenarioCandidate {
  scenario: TennisTacticalScenario;
  scores: TennisScenarioScore[];
  valid: boolean;
  repair: TennisScenarioRepair;
  generation: number;
  simulation?: TennisSimulationResult;
  winPathReport?: TennisWinPathReport;
}

export interface TennisScenarioPopulation {
  generation: number;
  candidates: TennisScenarioCandidate[];
  eliteScenarioIds: string[];
  diversityScore: number;
}

export interface TennisScenarioSearchInput {
  state: TennisMatchState;
  matchup: TennisMatchupModel;
  adaptiveState?: TennisAdaptiveState;
}

export interface TennisScenarioSearchResult {
  population: TennisScenarioPopulation;
  frontier: TennisScenarioCandidate[];
  elite: TennisScenarioCandidate[];
  provenance: {
    engineVersion: string;
    seed: number;
    modelVersion: string;
    generationCount: number;
    simulationCount: number;
    maxSteps: number;
    evidenceRefs: EvidenceRef[];
  };
}

export const TENNIS_SCENARIO_SEARCH_ENGINE = "tennis-adaptive-scenario-search-v2";
export const TENNIS_SCENARIO_OBJECTIVES: TennisScenarioObjective[] = [
  "win_path_support",
  "failure_avoidance",
  "robustness",
  "evidence_strength",
  "tactical_diversity",
];

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function score(
  candidate: TennisScenarioCandidate,
  objective: TennisScenarioObjective,
): number {
  return candidate.scores.find((s) => s.objective === objective)?.value ?? 0;
}

const dominates = (a: TennisScenarioCandidate, b: TennisScenarioCandidate): boolean => {
  let strict = false;
  for (const objective of TENNIS_SCENARIO_OBJECTIVES) {
    const x = score(a, objective);
    const y = score(b, objective);
    if (x < y) return false;
    if (x > y) strict = true;
  }
  return strict;
};

export function paretoFront(cs: TennisScenarioCandidate[]): TennisScenarioCandidate[] {
  return cs.filter((candidate, i) =>
    cs.every((other, j) => i === j || !dominates(other, candidate)),
  );
}

export function scenarioSignature(candidate: TennisScenarioCandidate): string {
  return `${candidate.scenario.intervention.type}|${candidate.scenario.opponentResponses
    .map((r) => r.type)
    .sort()
    .join(",")}|${candidate.scenario.counterPaths
    .map((r) => r.type)
    .sort()
    .join(",")}`;
}

export function repairTennisScenario(s: TennisTacticalScenario): TennisScenarioRepair {
  const reasons: string[] = [];
  if (!Number.isInteger(s.sourceStateVersion) || s.sourceStateVersion < 0) {
    reasons.push("invalid_source_state_version");
  }
  if (!s.intervention.actorParticipantId) reasons.push("missing_intervention_actor");
  if (!s.opponentResponses.length) reasons.push("missing_opponent_responses");
  const ids = new Set(s.opponentResponses.map((r) => r.responseId));
  if (s.counterPaths.some((c) => !ids.has(c.responseId))) reasons.push("orphan_counter_path");
  if (s.opponentResponses.some((r) => !Number.isFinite(r.relativeWeight) || r.relativeWeight <= 0)) {
    reasons.push("invalid_response_weight");
  }
  return { repaired: reasons.length > 0, reasons };
}

export function preserveElite(cs: TennisScenarioCandidate[], n: number): TennisScenarioCandidate[] {
  return paretoFront(cs.filter((c) => c.valid))
    .sort((a, b) => a.scenario.scenarioId.localeCompare(b.scenario.scenarioId))
    .slice(0, Math.max(1, n));
}

export function injectScenarioDiversity(
  cs: TennisScenarioCandidate[],
  config: TennisScenarioSearchConfig,
): TennisScenarioCandidate[] {
  const out: TennisScenarioCandidate[] = [];
  const seen = new Set<string>();
  for (const candidate of cs) {
    const signature = scenarioSignature(candidate);
    if (seen.has(signature)) continue;
    out.push(candidate);
    seen.add(signature);
    if (out.length >= Math.max(1, config.populationSize)) break;
  }
  return out;
}

function uniqueRefs(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.evidenceId)) return false;
    seen.add(ref.evidenceId);
    return true;
  });
}

function candidateFromScenario(
  scenario: TennisTacticalScenario,
  input: TennisScenarioSearchInput,
  config: TennisScenarioSearchConfig,
  generation: number,
  signatureCount: number,
): TennisScenarioCandidate {
  const repair = repairTennisScenario(scenario);
  if (repair.reasons.length > 0) {
    return { scenario, scores: [], valid: false, repair, generation };
  }

  const counterfactual: TennisCounterfactualState = buildTennisCounterfactualState({
    state: input.state,
    scenarioId: scenario.scenarioId,
    intervention: scenario.intervention,
    engineVersion: "tennis-counterfactual-v1",
  });
  const simulationConfig: TennisSimulationConfig = {
    simulationCount: Math.max(0, Math.floor(config.simulationCount)),
    maxSteps: Math.max(1, Math.floor(config.maxSteps)),
    seed: (config.seed + generation * 1009 + scenario.scenarioId.length) | 0,
    modelVersion: config.modelVersion,
  };
  const simulation = simulateTennisScenario(counterfactual, scenario, simulationConfig);
  const winPathReport = buildTennisWinPathReport(scenario, simulation);
  const refs = uniqueRefs([
    ...scenario.evidenceRefs,
    ...winPathReport.provenance.evidenceRefs,
  ]);

  const winPathSupport = clamp(winPathReport.coverage.winPathCoverage);
  const failureAvoidance = clamp(1 - winPathReport.coverage.failurePathCoverage);
  const winPaths = winPathReport.paths.filter((p) => p.classification === "win_path");
  const robustness = winPaths.length > 0
    ? clamp(winPaths.reduce((sum, path) => sum + path.robustness, 0) / winPaths.length)
    : 0;
  const evidenceStrength = clamp(refs.length / 10);
  const tacticalDiversity = clamp(1 / Math.max(1, signatureCount));
  const uncertainty = clamp(winPathReport.uncertainty);

  const makeScore = (objective: TennisScenarioObjective, value: number): TennisScenarioScore => ({
    objective,
    value,
    uncertainty,
    evidenceRefs: refs,
  });

  return {
    scenario,
    scores: [
      makeScore("win_path_support", winPathSupport),
      makeScore("failure_avoidance", failureAvoidance),
      makeScore("robustness", robustness),
      makeScore("evidence_strength", evidenceStrength),
      makeScore("tactical_diversity", tacticalDiversity),
    ],
    valid: true,
    repair,
    generation,
    simulation,
    winPathReport,
  };
}

/**
 * B-29 population search. It evaluates the scenario seeds against the existing
 * simulation and win-path layers, preserves a Pareto frontier, and injects
 * structurally distinct candidates. It does not select a coaching action.
 *
 * Multi-generation mutation is intentionally deferred to B-30. This function
 * therefore treats the current tactical scenario generator as generation zero
 * and makes the adaptive search contract executable without inventing tactics.
 */
export function searchTennisScenarioPopulation(
  input: TennisScenarioSearchInput,
  config: TennisScenarioSearchConfig,
): TennisScenarioSearchResult {
  const maxGenerations = Math.max(1, Math.floor(config.maxGenerations));
  const requestedPopulation = Math.max(1, Math.floor(config.populationSize));
  const seedScenarios = generateTennisTacticalScenarios(
    input.state,
    input.matchup,
    input.adaptiveState,
  );

  let candidates = seedScenarios.map((scenario) =>
    candidateFromScenario(scenario, input, config, 0, seedScenarios.length),
  );
  candidates = candidates.filter((candidate) => candidate.valid);

  // Keep deterministic ordering before diversity filtering. This prevents
  // array order from becoming an accidental source of search nondeterminism.
  candidates.sort((a, b) => a.scenario.scenarioId.localeCompare(b.scenario.scenarioId));
  const diverse = injectScenarioDiversity(candidates, {
    ...config,
    populationSize: requestedPopulation,
  });
  const frontier = paretoFront(diverse).sort((a, b) => a.scenario.scenarioId.localeCompare(b.scenario.scenarioId));
  const elite = preserveElite(diverse, Math.min(config.eliteCount, diverse.length));
  const signatures = new Set(diverse.map(scenarioSignature));
  const diversityScore = diverse.length > 0 ? clamp(signatures.size / diverse.length) : 0;
  const population: TennisScenarioPopulation = {
    generation: Math.min(0, maxGenerations - 1),
    candidates: diverse.slice(0, requestedPopulation),
    eliteScenarioIds: elite.map((candidate) => candidate.scenario.scenarioId),
    diversityScore,
  };

  const refs = uniqueRefs([
    ...input.state.evidenceRefs,
    ...input.matchup.evidenceRefs,
    ...diverse.flatMap((candidate) => candidate.scenario.evidenceRefs),
  ]);

  return {
    population,
    frontier,
    elite,
    provenance: {
      engineVersion: TENNIS_SCENARIO_SEARCH_ENGINE,
      seed: config.seed,
      modelVersion: config.modelVersion ?? "tennis-scenario-search-model-v1",
      generationCount: 1,
      simulationCount: Math.max(0, Math.floor(config.simulationCount)),
      maxSteps: Math.max(1, Math.floor(config.maxSteps)),
      evidenceRefs: refs,
    },
  };
}

export function describeTennisScenarioSearch(): TennisScenarioSearchResult {
  return {
    population: { generation: 0, candidates: [], eliteScenarioIds: [], diversityScore: 0 },
    frontier: [],
    elite: [],
    provenance: {
      engineVersion: TENNIS_SCENARIO_SEARCH_ENGINE,
      seed: 0,
      modelVersion: "tennis-scenario-search-model-v1",
      generationCount: 0,
      simulationCount: 0,
      maxSteps: 0,
      evidenceRefs: [],
    },
  };
}
