import type { EvidenceRef, GameState } from "@coaching-ai/sports-core";
import type { BoxingScenario } from "./tactical-scenarios";
import type { BoxingSimulationResult, BoxingSimulationTrajectory } from "./simulation-kernel";

export type BoxingPathClass = "win_path" | "failure_path" | "neutral_path";

export interface BoxingWinPath {
  pathId: string;
  scenarioId: string;
  classification: BoxingPathClass;
  terminalReason: string;
  frequency: number;
  robustness: number;
  keyTransitions: string[];
  evidenceRefs: EvidenceRef[];
}

export interface BoxingWinPathReport {
  scenarioId: string;
  sourceStateVersion: number;
  paths: BoxingWinPath[];
  winPathCoverage: number;
  failurePathCoverage: number;
  uncertainty: number;
  provenance: {
    engineVersion: string;
    simulationSeed: number;
    simulationConfigVersion: string;
  };
}

export interface BoxingWinPathConfig {
  engineVersion?: string;
  minimumFrequency?: number;
  robustnessFloor?: number;
}

export function buildWinPathReport(
  state: GameState,
  scenario: BoxingScenario,
  simulation: BoxingSimulationResult,
  config: BoxingWinPathConfig = {},
): BoxingWinPathReport {
  const minimumFrequency = config.minimumFrequency ?? 0.01;
  const robustnessFloor = config.robustnessFloor ?? 0.25;
  const paths = aggregateTrajectories(simulation.distribution.trajectories, scenario.seed.scenarioId)
    .map((group, index) => ({
      pathId: `${scenario.seed.scenarioId}:path:${index + 1}`,
      scenarioId: scenario.seed.scenarioId,
      classification: classify(group.terminalReason, group.winnerParticipantId, state),
      terminalReason: group.terminalReason,
      frequency: group.frequency,
      robustness: calculateRobustness(group.trajectories),
      keyTransitions: keyTransitions(group.trajectories[0]),
      evidenceRefs: dedupeEvidence(group.trajectories.flatMap((t) => t.steps.flatMap((s) => s.state.evidenceRefs))),
    } satisfies BoxingWinPath))
    .filter((path) => path.frequency >= minimumFrequency && path.robustness >= robustnessFloor);

  const winPathCoverage = sumFrequency(paths, "win_path");
  const failurePathCoverage = sumFrequency(paths, "failure_path");

  return {
    scenarioId: scenario.seed.scenarioId,
    sourceStateVersion: state.stateVersion,
    paths,
    winPathCoverage,
    failurePathCoverage,
    uncertainty: Math.min(1, Math.max(0, 1 - winPathCoverage - failurePathCoverage)),
    provenance: {
      engineVersion: config.engineVersion ?? "boxing-win-path-v1",
      simulationSeed: simulation.provenance.seed,
      simulationConfigVersion: simulation.config.modelVersion,
    },
  };
}

interface PathGroup {
  terminalReason: string;
  winnerParticipantId?: string;
  frequency: number;
  trajectories: BoxingSimulationTrajectory[];
}

function aggregateTrajectories(trajectories: BoxingSimulationTrajectory[], scenarioId: string): PathGroup[] {
  if (trajectories.length === 0) return [];
  const groups = new Map<string, PathGroup>();
  for (const trajectory of trajectories) {
    const terminalReason = trajectory.outcome.reason;
    const winnerParticipantId = trajectory.outcome.winnerParticipantId;
    const signature = `${scenarioId}|${terminalReason}|${winnerParticipantId ?? "none"}|${keyTransitions(trajectory).join(",")}`;
    const existing = groups.get(signature);
    if (existing) {
      existing.frequency += 1 / trajectories.length;
      existing.trajectories.push(trajectory);
    } else {
      groups.set(signature, {
        terminalReason,
        winnerParticipantId,
        frequency: 1 / trajectories.length,
        trajectories: [trajectory],
      });
    }
  }
  return [...groups.values()].sort((a, b) => b.frequency - a.frequency);
}

function classify(terminalReason: string, winnerParticipantId: string | undefined, state: GameState): BoxingPathClass {
  if (!winnerParticipantId) return terminalReason.toLowerCase().includes("loss") ? "failure_path" : "neutral_path";
  return winnerParticipantId === state.participants[0]?.participantId ? "win_path" : "failure_path";
}

function calculateRobustness(trajectories: BoxingSimulationTrajectory[]): number {
  if (trajectories.length <= 1) return 0.5;
  const lengths = trajectories.map((trajectory) => trajectory.steps.length);
  const mean = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
  const variance = lengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / lengths.length;
  const coefficient = mean === 0 ? 1 : Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(1, 1 - coefficient));
}

function keyTransitions(trajectory: BoxingSimulationTrajectory): string[] {
  return trajectory.steps.slice(0, 8).map((step) => step.branchId);
}

function sumFrequency(paths: BoxingWinPath[], classification: BoxingPathClass): number {
  return Math.min(1, paths.filter((path) => path.classification === classification).reduce((sum, path) => sum + path.frequency, 0));
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
