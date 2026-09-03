import type { EvidenceRef, GameState } from "@coaching-ai/sports-core";
import type { BoxingAdaptiveState } from "./adaptive-opponent";
import type { BoxingScenario } from "./tactical-scenarios";
import type { BoxingScenarioEvaluation } from "./scenario-learning";
import type { BoxingWinPathReport } from "./win-path-engine";

export type BoxingEvidenceLabel = "OBSERVED" | "INFERRED" | "SIMULATED" | "HYPOTHETICAL";

export interface BoxingCoachEvidenceCard {
  evidenceId: string;
  label: BoxingEvidenceLabel;
  summary: string;
  evidenceRefs: EvidenceRef[];
}

export interface BoxingCoachRisk {
  riskId: string;
  severity: "low" | "medium" | "high" | "unknown";
  description: string;
  source: BoxingEvidenceLabel;
  evidenceRefs: EvidenceRef[];
}

export interface BoxingCoachScenarioCard {
  scenarioId: string;
  objective: string;
  intervention: BoxingScenario["seed"]["intervention"];
  whyConsidered: string[];
  modeledResponses: BoxingScenario["seed"]["opponentResponses"];
  counterPaths: BoxingScenario["seed"]["counterPaths"];
  pathReport?: BoxingWinPathReport;
  evaluation?: BoxingScenarioEvaluation;
  risks: BoxingCoachRisk[];
  evidence: BoxingCoachEvidenceCard[];
}

export interface BoxingCoachDecisionRecord {
  decisionId: string;
  scenarioId?: string;
  selectedAction?: string;
  recordedAt: string;
  notes?: string;
}

export interface BoxingCoachCommandCenterConfig {
  modelVersion?: string;
  maxScenarioCards?: number;
  staleAfterMs?: number;
}

export interface BoxingCoachDashboardState {
  gameId: string;
  sport: "boxing";
  stateVersion: number;
  freshness: "fresh" | "stale" | "unknown";
  currentState: {
    phase: string;
    clockLabel?: string;
    score: Record<string, number | string>;
    leaderParticipantId?: string;
    controlledParticipantId?: string;
  };
  baselineContext?: Record<string, unknown>;
  scenarios: BoxingCoachScenarioCard[];
  adaptiveOpponent?: BoxingAdaptiveState;
  recentEvaluation?: BoxingScenarioEvaluation;
  evidence: BoxingCoachEvidenceCard[];
  risks: BoxingCoachRisk[];
  provenance: {
    engineVersion: string;
    modelVersion: string;
    sourceStateVersion: number;
  };
}

export interface BoxingCoachCommandCenterInput {
  state: GameState;
  scenarios: BoxingScenario[];
  pathReports?: Record<string, BoxingWinPathReport>;
  evaluations?: Record<string, BoxingScenarioEvaluation>;
  adaptiveOpponent?: BoxingAdaptiveState;
  baselineContext?: Record<string, unknown>;
  now?: string;
  stateObservedAt?: string;
}

export function buildBoxingCoachCommandCenter(
  input: BoxingCoachCommandCenterInput,
  config: BoxingCoachCommandCenterConfig = {},
): BoxingCoachDashboardState {
  const max = config.maxScenarioCards ?? 6;
  const now = input.now ? Date.parse(input.now) : Date.now();
  const observed = input.stateObservedAt ? Date.parse(input.stateObservedAt) : Number.NaN;
  const staleAfter = config.staleAfterMs ?? 30_000;
  const freshness = Number.isNaN(observed)
    ? "unknown"
    : now - observed > staleAfter ? "stale" : "fresh";

  const scenarios = input.scenarios.slice(0, max).map((scenario) => {
    const report = input.pathReports?.[scenario.seed.scenarioId];
    const evaluation = input.evaluations?.[scenario.seed.scenarioId];
    return toScenarioCard(scenario, report, evaluation);
  });

  const evidence = dedupeEvidenceCards([
    ...scenarios.flatMap((scenario) => scenario.evidence),
    ...stateEvidence(input.state),
  ]);
  const risks = scenarios.flatMap((scenario) => scenario.risks);
  if (freshness === "stale") {
    risks.push({
      riskId: "command-center:stale-state",
      severity: "high",
      description: "Current fight state is older than the configured freshness threshold.",
      source: "OBSERVED",
      evidenceRefs: input.state.evidenceRefs,
    });
  }

  const latestEvaluation = scenarios
    .map((scenario) => scenario.evaluation)
    .filter((evaluation): evaluation is BoxingScenarioEvaluation => Boolean(evaluation))
    .at(-1);

  return {
    gameId: input.state.gameId,
    sport: "boxing",
    stateVersion: input.state.stateVersion,
    freshness,
    currentState: {
      phase: input.state.phase.label,
      clockLabel: input.state.clock.label,
      score: input.state.score.values,
      leaderParticipantId: input.state.score.leaderParticipantId,
      controlledParticipantId: input.state.control.controllerParticipantId,
    },
    baselineContext: input.baselineContext,
    scenarios,
    adaptiveOpponent: input.adaptiveOpponent,
    recentEvaluation: latestEvaluation,
    evidence,
    risks,
    provenance: {
      engineVersion: "boxing-coach-command-center-v1",
      modelVersion: config.modelVersion ?? "unknown",
      sourceStateVersion: input.state.stateVersion,
    },
  };
}

function toScenarioCard(
  scenario: BoxingScenario,
  report?: BoxingWinPathReport,
  evaluation?: BoxingScenarioEvaluation,
): BoxingCoachScenarioCard {
  const risks: BoxingCoachRisk[] = [];
  if (report && report.failurePathCoverage > report.winPathCoverage) {
    risks.push({
      riskId: `${scenario.seed.scenarioId}:failure-dominant`,
      severity: "high",
      description: "Simulation contains more retained failure-path coverage than win-path coverage.",
      source: "SIMULATED",
      evidenceRefs: scenario.evidenceRefs,
    });
  }
  if (report && report.uncertainty >= 0.5) {
    risks.push({
      riskId: `${scenario.seed.scenarioId}:uncertainty`,
      severity: "medium",
      description: "A substantial portion of simulated trajectories remains unresolved or uncertain.",
      source: "SIMULATED",
      evidenceRefs: scenario.evidenceRefs,
    });
  }
  if (evaluation?.uncertainty !== undefined && evaluation.uncertainty >= 0.6) {
    risks.push({
      riskId: `${scenario.seed.scenarioId}:evaluation-uncertainty`,
      severity: "medium",
      description: "Scenario evaluation remains high-uncertainty.",
      source: evaluation.status === "evaluated" ? "INFERRED" : "SIMULATED",
      evidenceRefs: evaluation.evidenceRefs,
    });
  }

  return {
    scenarioId: scenario.seed.scenarioId,
    objective: scenario.objectives.map((objective) => objective.objective).join(", "),
    intervention: scenario.seed.intervention,
    whyConsidered: scenario.seed.intervention.assumptions,
    modeledResponses: scenario.seed.opponentResponses,
    counterPaths: scenario.seed.counterPaths,
    pathReport: report,
    evaluation,
    risks,
    evidence: [
      {
        evidenceId: `${scenario.seed.scenarioId}:hypothesis`,
        label: "HYPOTHETICAL",
        summary: "Scenario intervention and assumptions are hypothetical until acted upon and observed.",
        evidenceRefs: scenario.evidenceRefs,
      },
      ...(report ? [{
        evidenceId: `${scenario.seed.scenarioId}:simulation`,
        label: "SIMULATED" as const,
        summary: "Path coverage and transitions are outputs of deterministic simulation.",
        evidenceRefs: report.paths.flatMap((path) => path.evidenceRefs),
      }] : []),
      ...(evaluation ? [{
        evidenceId: `${scenario.seed.scenarioId}:evaluation`,
        label: "INFERRED" as const,
        summary: "Evaluation compares simulation with available observed outcomes.",
        evidenceRefs: evaluation.evidenceRefs,
      }] : []),
    ],
  };
}

function stateEvidence(state: GameState): BoxingCoachEvidenceCard[] {
  return [{
    evidenceId: `${state.gameId}:state:${state.stateVersion}`,
    label: "OBSERVED",
    summary: `Current fight state version ${state.stateVersion}.`,
    evidenceRefs: state.evidenceRefs,
  }];
}

function dedupeEvidenceCards(cards: BoxingCoachEvidenceCard[]): BoxingCoachEvidenceCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (seen.has(card.evidenceId)) return false;
    seen.add(card.evidenceId);
    return true;
  });
}
