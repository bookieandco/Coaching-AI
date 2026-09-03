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

function classifyTrajectory(
  scenario: TennisTacticalScenario,
  trajectory: TennisSimulationResult["trajectories"][number],
): TennisPathClass {
  // A trajectory is a coaching win/failure path only when the simulation actually
  // reaches a match terminal state. Partial point/game/set outcomes remain neutral.
  if (trajectory.terminalClass !== "match") return "neutral_path";

  const actorId = scenario.intervention.actorParticipantId;
  const actorScore = trajectory.finalState.attributes.tennisScore[actorId];
  if (!actorScore) return "neutral_path";

  const opponent = trajectory.finalState.participants.find((p) => p.participantId !== actorId);
  const opponentScore = opponent
    ? trajectory.finalState.attributes.tennisScore[opponent.participantId]
    : undefined;
  if (!opponentScore) return "neutral_path";

  if (actorScore.sets > opponentScore.sets) return "win_path";
  if (actorScore.sets < opponentScore.sets) return "failure_path";
  return "neutral_path";
}

/**
 * B-27 classifies only validated terminal match outcomes. It does not turn
 * trajectory frequency into calibrated win probability or recommend a path.
 */
export function buildTennisWinPathReport(
  scenario: TennisTacticalScenario,
  simulation: TennisSimulationResult,
): TennisWinPathReport {
  const total = simulation.trajectories.length;
  const groups = new Map<string, TennisWinPath>();

  for (const trajectory of simulation.trajectories) {
    const classification = classifyTrajectory(scenario, trajectory);
    const key = `${classification}:${trajectory.responseType ?? "unknown"}:${trajectory.counterType ?? "none"}`;
    const existing = groups.get(key);
    if (existing) {
      existing.frequency += 1;
      continue;
    }
    groups.set(key, {
      pathId: `${scenario.scenarioId}:path:${groups.size + 1}`,
      scenarioId: scenario.scenarioId,
      classification,
      responseType: trajectory.responseType,
      counterType: trajectory.counterType,
      frequency: 1,
      robustness: 0,
      evidenceRefs: simulation.provenance.evidenceRefs,
    });
  }

  const paths = [...groups.values()].map((path) => {
    const frequency = total > 0 ? path.frequency / total : 0;
    return {
      ...path,
      frequency,
      // B-27 robustness is intentionally conservative: branch support only.
      // Cross-seed and perturbation robustness are deferred to the evaluation layer.
      robustness: frequency,
    };
  });

  const winPathCoverage = paths.filter((p) => p.classification === "win_path").reduce((sum, p) => sum + p.frequency, 0);
  const failurePathCoverage = paths.filter((p) => p.classification === "failure_path").reduce((sum, p) => sum + p.frequency, 0);
  const neutralPathCoverage = paths.filter((p) => p.classification === "neutral_path").reduce((sum, p) => sum + p.frequency, 0);

  return {
    scenarioId: scenario.scenarioId,
    sourceStateVersion: simulation.sourceStateVersion,
    paths,
    coverage: { winPathCoverage, failurePathCoverage, neutralPathCoverage },
    uncertainty: total > 0 && (winPathCoverage + failurePathCoverage) > 0 ? 0.5 : 1,
    provenance: {
      engineVersion: "tennis-win-path-v2",
      simulationSeed: simulation.provenance.seed,
      simulationCount: total,
      evidenceRefs: simulation.provenance.evidenceRefs,
    },
  };
}
