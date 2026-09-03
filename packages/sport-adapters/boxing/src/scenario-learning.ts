import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { BoxingScenario } from "./tactical-scenarios";
import type { BoxingSimulationResult } from "./simulation-kernel";
import type { BoxingWinPathReport } from "./win-path-engine";
import type { BoxingAdaptiveObservation, BoxingAdaptiveState } from "./adaptive-opponent";

export type BoxingEvaluationStatus = "pending" | "evaluated" | "insufficient_evidence";

export interface BoxingScenarioOutcomeObservation {
  outcomeId: string;
  scenarioId: string;
  source: "observed" | "simulated";
  winnerParticipantId?: string;
  terminalReason?: string;
  objectiveScores: Record<string, number>;
  keyTransitionMatches: number;
  damageDelta?: number;
  evidenceRefs: EvidenceRef[];
}

export interface BoxingScenarioEvaluation {
  scenarioId: string;
  baselineReference?: string;
  status: BoxingEvaluationStatus;
  objectiveScores: Record<string, number>;
  observedVsSimulatedDelta: Record<string, number>;
  calibrationSignals: Record<string, number>;
  robustness: number;
  uncertainty: number;
  learningSignals: string[];
  evidenceRefs: EvidenceRef[];
  provenance: {
    engineVersion: string;
    modelVersion: string;
    evaluationVersion: string;
  };
}

export interface BoxingScenarioLearningResult {
  evaluation: BoxingScenarioEvaluation;
  adaptiveObservation?: BoxingAdaptiveObservation;
  nextAdaptiveState?: BoxingAdaptiveState;
}

export interface BoxingScenarioLearningConfig {
  modelVersion?: string;
  minimumObservedEvidence?: number;
  robustnessWeight?: number;
}

/**
 * Evaluates a scenario against simulation output and, when real observations
 * exist, produces bounded learning signals. It never turns evaluation into a
 * coaching recommendation. Observed evidence is kept distinct from simulation.
 */
export function evaluateBoxingScenario(
  scenario: BoxingScenario,
  simulation: BoxingSimulationResult,
  winPaths: BoxingWinPathReport,
  observed?: BoxingScenarioOutcomeObservation,
  adaptiveState?: BoxingAdaptiveState,
  config: BoxingScenarioLearningConfig = {},
): BoxingScenarioLearningResult {
  const modelVersion = config.modelVersion ?? simulation.provenance.modelVersion;
  const simulatedObjectives = deriveSimulatedObjectives(scenario, simulation, winPaths);
  const observedObjectives = observed?.objectiveScores ?? {};
  const objectiveKeys = new Set([...Object.keys(simulatedObjectives), ...Object.keys(observedObjectives)]);
  const observedVsSimulatedDelta: Record<string, number> = {};
  const calibrationSignals: Record<string, number> = {};

  for (const key of objectiveKeys) {
    const simulated = clamp01(simulatedObjectives[key] ?? 0);
    const actual = clamp01(observedObjectives[key] ?? simulated);
    observedVsSimulatedDelta[key] = actual - simulated;
    calibrationSignals[key] = observed ? 1 - Math.abs(actual - simulated) : 0;
  }

  const evidenceCount = observed ? 1 : 0;
  const minimumEvidence = config.minimumObservedEvidence ?? 1;
  const status: BoxingEvaluationStatus = evidenceCount >= minimumEvidence ? "evaluated" : "insufficient_evidence";
  const robustness = clamp01(winPaths.paths.reduce((sum, path) => sum + path.frequency * path.robustness, 0));
  const uncertainty = observed
    ? clamp01((winPaths.uncertainty + (1 - meanCalibration(calibrationSignals))) / 2)
    : clamp01(0.5 + winPaths.uncertainty * 0.5);

  const evidenceRefs = dedupeEvidence([
    ...scenario.evidenceRefs,
    ...simulationEvidence(simulation),
    ...(observed?.evidenceRefs ?? []),
  ]);

  const learningSignals = buildLearningSignals(observed, observedVsSimulatedDelta, robustness, adaptiveState);
  const evaluation: BoxingScenarioEvaluation = {
    scenarioId: scenario.seed.scenarioId,
    baselineReference: scenario.baselineReference,
    status,
    objectiveScores: observed ? observedObjectives : simulatedObjectives,
    observedVsSimulatedDelta,
    calibrationSignals,
    robustness,
    uncertainty,
    learningSignals,
    evidenceRefs,
    provenance: {
      engineVersion: "boxing-scenario-learning-v1",
      modelVersion,
      evaluationVersion: "scenario-evaluation-v1",
    },
  };

  let adaptiveObservation: BoxingAdaptiveObservation | undefined;
  if (observed) {
    adaptiveObservation = buildAdaptiveObservation(scenario, observed);
  }

  return {
    evaluation,
    adaptiveObservation,
    nextAdaptiveState: adaptiveState,
  };
}

function deriveSimulatedObjectives(
  scenario: BoxingScenario,
  simulation: BoxingSimulationResult,
  winPaths: BoxingWinPathReport,
): Record<string, number> {
  const objectives: Record<string, number> = {};
  const winnerCounts = simulation.distribution.winnerCounts;
  const controlledId = scenario.seed.fighterId;
  const total = simulation.distribution.trajectories.length || 1;
  const controlledWins = winnerCounts[controlledId] ?? 0;
  const finishCount = Object.entries(simulation.distribution.terminalCounts)
    .filter(([reason]) => reason === "knockout" || reason === "technical_knockout")
    .reduce((sum, [, count]) => sum + count, 0);

  for (const objective of scenario.objectives) {
    switch (objective.objective) {
      case "win_round":
      case "win_fight":
        objectives[objective.objective] = controlledWins / total;
        break;
      case "increase_finish_probability":
        objectives[objective.objective] = finishCount / total;
        break;
      case "reduce_damage":
        objectives[objective.objective] = clamp01(1 - winPaths.failurePathCoverage);
        break;
      case "protect_lead":
        objectives[objective.objective] = clamp01(winPaths.winPathCoverage);
        break;
      case "change_fight_shape":
        objectives[objective.objective] = clamp01(winPaths.paths.length / Math.max(1, simulation.distribution.trajectories.length));
        break;
    }
  }
  return objectives;
}

function buildAdaptiveObservation(
  scenario: BoxingScenario,
  observed: BoxingScenarioOutcomeObservation,
): BoxingAdaptiveObservation {
  const objectiveValues = Object.values(observed.objectiveScores);
  const effectiveness = objectiveValues.length
    ? objectiveValues.reduce((sum, value) => sum + clamp01(value), 0) / objectiveValues.length
    : 0.5;
  return {
    observationId: observed.outcomeId,
    fighterId: scenario.seed.fighterId,
    opponentId: "unknown",
    interventionType: scenario.seed.intervention.type,
    responseType: "observed",
    effectiveness,
    source: "observed",
    evidenceRefs: observed.evidenceRefs,
  };
}

function buildLearningSignals(
  observed: BoxingScenarioOutcomeObservation | undefined,
  deltas: Record<string, number>,
  robustness: number,
  adaptiveState: BoxingAdaptiveState | undefined,
): string[] {
  const signals: string[] = [];
  if (!observed) signals.push("No real-world outcome supplied; evaluation remains simulation-only.");
  if (observed) {
    for (const [objective, delta] of Object.entries(deltas)) {
      if (Math.abs(delta) >= 0.2) signals.push(`${objective} diverged from simulation by ${delta.toFixed(2)}.`);
    }
  }
  if (robustness < 0.4) signals.push("Scenario path structure is sensitive to simulated trajectory variation.");
  if (adaptiveState && adaptiveState.uncertainty > 0.6) signals.push("Opponent adaptation model remains high-uncertainty.");
  return signals;
}

function meanCalibration(values: Record<string, number>): number {
  const entries = Object.values(values);
  return entries.length ? entries.reduce((sum, value) => sum + value, 0) / entries.length : 0;
}

function simulationEvidence(simulation: BoxingSimulationResult): EvidenceRef[] {
  return [{
    sourceId: `simulation:${simulation.scenarioId}`,
    sourceType: "simulation",
    locator: `${simulation.provenance.engineVersion}:${simulation.provenance.seed}`,
  } as EvidenceRef];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function dedupeEvidence(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = JSON.stringify(ref);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
