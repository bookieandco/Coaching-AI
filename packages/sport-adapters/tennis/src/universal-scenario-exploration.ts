import type {
  ScenarioCandidate,
  ScenarioEvaluation,
  ScenarioExplorationRequest,
  ScenarioExplorationResult,
  ScenarioExplorationService,
  ScenarioSimulationResult,
} from "@coaching-ai/sports-core";
import type { TennisMatchState } from "./index";
import type { TennisMatchupModel } from "./matchup-intelligence";
import type { TennisAdaptiveState } from "./adaptive-opponent";
import {
  searchTennisScenarioPopulation,
  type TennisScenarioSearchConfig,
} from "./adaptive-scenario-search";

export interface TennisScenarioExplorationServiceConfig {
  matchup: TennisMatchupModel;
  adaptiveState?: TennisAdaptiveState;
  search: TennisScenarioSearchConfig;
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

type TennisScenarioCandidate = ReturnType<typeof searchTennisScenarioPopulation>["frontier"][number];

function candidateFromTennisScenario(candidate: TennisScenarioCandidate): ScenarioCandidate {
  return {
    scenarioId: candidate.scenario.scenarioId,
    title: candidate.scenario.intervention.type,
    intervention: candidate.scenario.intervention.type,
    assumptions: candidate.scenario.intervention.assumptions,
    evidenceRefs: candidate.scenario.evidenceRefs,
  };
}

function evaluationFromCandidate(
  candidate: TennisScenarioCandidate,
  stateSignature: string,
  seed: number,
): ScenarioEvaluation {
  const dimensions = candidate.scores.map((score) => ({
    dimension: score.objective,
    score: clamp(score.value),
    confidence: clamp(1 - score.uncertainty),
    uncertainty: clamp(score.uncertainty),
    evidenceRefs: score.evidenceRefs,
  }));

  const aggregate = dimensions.length
    ? dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length
    : undefined;

  return {
    scenarioId: candidate.scenario.scenarioId,
    dimensions,
    aggregate,
    paretoEligible: true,
    dominatedByScenarioIds: [],
    robustness: candidate.perturbationRobustness?.perturbationStability,
    evidenceCoverage: dimensions.length
      ? dimensions.filter((dimension) => dimension.evidenceRefs.length > 0).length / dimensions.length
      : 0,
    uncertainty: dimensions.length
      ? dimensions.reduce((sum, dimension) => sum + dimension.uncertainty, 0) / dimensions.length
      : 1,
    provenance: {
      evaluatorVersion: "tennis-adaptive-scenario-search-v6",
      stateSignature,
      seed,
    },
  };
}

function simulationFromCandidate(
  candidate: TennisScenarioCandidate,
  seed: number,
): ScenarioSimulationResult {
  const outcome = candidate.winPathReport
    ? `${candidate.winPathReport.paths.filter((path) => path.classification === "win_path").length} supported win paths`
    : "No simulation outcome available";

  return {
    scenarioId: candidate.scenario.scenarioId,
    seed,
    outcome,
    outcomeScore: candidate.winPathReport?.coverage.winPathCoverage,
    evidenceRefs: candidate.simulation?.provenance.evidenceRefs ?? candidate.scenario.evidenceRefs,
  };
}

export function createTennisScenarioExplorationService(
  config: TennisScenarioExplorationServiceConfig,
): ScenarioExplorationService {
  return {
    async explore(request: ScenarioExplorationRequest): Promise<ScenarioExplorationResult> {
      const state = request.state as TennisMatchState;
      const seed = request.seeds?.[0] ?? config.search.seed;
      const searchConfig: TennisScenarioSearchConfig = {
        ...config.search,
        seed,
        simulationCount: request.simulationBudget ?? config.search.simulationCount,
      };

      const search = searchTennisScenarioPopulation(
        { state, matchup: config.matchup, adaptiveState: config.adaptiveState },
        searchConfig,
      );

      const requestedIds = new Set(request.candidates.map((candidate) => candidate.scenarioId));
      const selectedCandidates = request.candidates.length
        ? search.frontier.filter((candidate) => requestedIds.has(candidate.scenario.scenarioId))
        : search.frontier;
      const candidates = selectedCandidates.length ? selectedCandidates : search.frontier;

      const evaluations = candidates.map((candidate) => evaluationFromCandidate(candidate, request.stateSignature, seed));
      const simulations = candidates.map((candidate) => simulationFromCandidate(candidate, seed));
      const paretoScenarioIds = search.frontier.map((candidate) => candidate.scenario.scenarioId).sort();

      return {
        explorationId: request.explorationId,
        stateSignature: request.stateSignature,
        simulations,
        evaluations,
        paretoScenarioIds,
        humanDecisionRequired: true,
        provenance: {
          serviceVersion: "tennis-scenario-exploration-v1",
          stateSignature: request.stateSignature,
          seeds: request.seeds?.length ? [...request.seeds] : [seed],
        },
      };
    },
  };
}

export function describeTennisScenarioExplorationService(): string {
  return "Tennis exploration delegates scenario generation, adaptive response search, simulation, win-path analysis, robustness, and epistemic lineage to the existing Tennis intelligence stack while exposing universal ScenarioExplorationService output.";
}
