import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { TennisCounterfactualState } from "./counterfactual";
import type { TennisTacticalScenario } from "./tactical-scenarios";

export interface TennisSimulationConfig {
  simulationCount: number;
  maxSteps: number;
  seed: number;
  modelVersion?: string;
}

export interface TennisSimulationTrajectory {
  trajectoryId: string;
  scenarioId: string;
  seed: number;
  steps: number;
  terminalClass: "continuation" | "point" | "game" | "set" | "match";
  responseType?: string;
  counterType?: string;
}

export interface TennisSimulationResult {
  scenarioId: string;
  sourceStateVersion: number;
  trajectories: TennisSimulationTrajectory[];
  terminalCounts: Record<string, number>;
  provenance: {
    engineVersion: string;
    modelVersion: string;
    seed: number;
    simulationCount: number;
    maxSteps: number;
    evidenceRefs: EvidenceRef[];
  };
}

function nextRandom(seed: number): number {
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

function chooseWeighted(seed: number, weights: number[]): { index: number; seed: number } {
  const nextSeed = (Math.imul(seed, 1664525) + 1013904223) | 0;
  const r = nextRandom(nextSeed);
  const total = weights.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return { index: 0, seed: nextSeed };
  let cursor = r * total;
  for (let i = 0; i < weights.length; i += 1) {
    cursor -= Math.max(0, weights[i]);
    if (cursor <= 0) return { index: i, seed: nextSeed };
  }
  return { index: weights.length - 1, seed: nextSeed };
}

/**
 * B-22 intentionally simulates branch selection, not match outcomes. It provides
 * deterministic scenario trajectories so a downstream evaluator can compare
 * branches without treating these synthetic branches as calibrated probabilities.
 */
export function simulateTennisScenario(
  counterfactual: TennisCounterfactualState,
  scenario: TennisTacticalScenario,
  config: TennisSimulationConfig,
): TennisSimulationResult {
  const count = Math.max(0, Math.floor(config.simulationCount));
  const maxSteps = Math.max(1, Math.floor(config.maxSteps));
  const trajectories: TennisSimulationTrajectory[] = [];
  const terminalCounts: Record<string, number> = {};

  for (let i = 0; i < count; i += 1) {
    let seed = (config.seed ^ Math.imul(i + 1, 0x9e3779b9)) | 0;
    let steps = 0;
    let responseType: string | undefined;
    let counterType: string | undefined;

    while (steps < maxSteps) {
      const selection = chooseWeighted(seed, scenario.opponentResponses.map((r) => r.relativeWeight));
      seed = selection.seed;
      const response = scenario.opponentResponses[selection.index];
      responseType = response?.type;
      const counter = response ? scenario.counterPaths.find((c) => c.responseId === response.responseId) : undefined;
      counterType = counter?.type;
      steps += 1;

      // This kernel currently branches the tactical chain once. Point/game/set/match
      // dynamics remain downstream because they require a calibrated tennis transition model.
      break;
    }

    const terminalClass: TennisSimulationTrajectory["terminalClass"] = "continuation";
    terminalCounts[terminalClass] = (terminalCounts[terminalClass] ?? 0) + 1;
    trajectories.push({
      trajectoryId: `${scenario.scenarioId}:trajectory:${i + 1}`,
      scenarioId: scenario.scenarioId,
      seed,
      steps,
      terminalClass,
      responseType,
      counterType,
    });
  }

  return {
    scenarioId: scenario.scenarioId,
    sourceStateVersion: counterfactual.sourceStateVersion,
    trajectories,
    terminalCounts,
    provenance: {
      engineVersion: "tennis-deterministic-simulation-v1",
      modelVersion: config.modelVersion ?? "tennis-simulation-model-v1",
      seed: config.seed,
      simulationCount: count,
      maxSteps,
      evidenceRefs: counterfactual.evidenceRefs,
    },
  };
}
