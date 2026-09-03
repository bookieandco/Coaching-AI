import type { EvidenceRef, GameState } from "@coaching-ai/sports-core";
import type { BoxingIntervention } from "./tactical-scenarios";
import type { BoxingResponseCandidate, BoxingCounterCandidate, BoxingResponseChain } from "./opponent-response";
import { buildCounterfactualState, type BoxingCounterfactualState } from "./counterfactual";

export interface BoxingSimulationConfig {
  simulations: number;
  maxSteps: number;
  stepMs: number;
  modelVersion: string;
  rulesetVersion: string;
  evidenceSetVersion: string;
  seed: number;
}

export interface BoxingSimulationStep {
  step: number;
  stateVersion: number;
  elapsedMs: number;
  branchId: string;
  responseId?: string;
  counterId?: string;
  selectedWeight?: number;
  state: GameState;
  deltas: BoxingCounterfactualState["deltas"];
}

export interface BoxingSimulationTrajectory {
  trajectoryId: string;
  simulationIndex: number;
  seed: number;
  steps: BoxingSimulationStep[];
  terminal: boolean;
  terminalReason?: string;
  outcome: BoxingSimulationOutcome;
}

export interface BoxingSimulationOutcome {
  winnerParticipantId?: string;
  reason: "unfinished" | "decision" | "knockout" | "technical_knockout" | "retirement" | "unknown";
  finalStateVersion: number;
}

export interface BoxingSimulationDistribution {
  trajectories: BoxingSimulationTrajectory[];
  terminalCounts: Record<string, number>;
  winnerCounts: Record<string, number>;
  weightMassByResponse: Record<string, number>;
}

export interface BoxingSimulationResult {
  scenarioId: string;
  initialStateVersion: number;
  config: BoxingSimulationConfig;
  distribution: BoxingSimulationDistribution;
  provenance: {
    engineVersion: string;
    stateVersion: number;
    modelVersion: string;
    rulesetVersion: string;
    evidenceSetVersion: string;
    seed: number;
  };
}

/**
 * Deterministic Monte-Carlo-style branch traversal.
 *
 * Response `probability` values are treated only as normalized sampling
 * weights. They are not asserted to be calibrated real-world probabilities.
 * Given identical inputs, configuration, and seed, this function produces the
 * same trajectories and aggregates.
 */
export function simulateBoxingScenario(
  initialState: GameState,
  scenarioId: string,
  intervention: BoxingIntervention,
  responseChain: BoxingResponseChain,
  config: BoxingSimulationConfig,
): BoxingSimulationResult {
  validateConfig(config);
  if (responseChain.responses.length === 0) throw new Error("Simulation requires at least one opponent response candidate.");

  const trajectories: BoxingSimulationTrajectory[] = [];
  const terminalCounts: Record<string, number> = {};
  const winnerCounts: Record<string, number> = {};
  const weightMassByResponse: Record<string, number> = {};

  for (let simulationIndex = 0; simulationIndex < config.simulations; simulationIndex += 1) {
    const simulationSeed = mixSeed(config.seed, simulationIndex);
    const trajectory = simulateTrajectory(
      initialState,
      scenarioId,
      intervention,
      responseChain,
      config,
      simulationIndex,
      simulationSeed,
    );
    trajectories.push(trajectory);

    terminalCounts[trajectory.outcome.reason] = (terminalCounts[trajectory.outcome.reason] ?? 0) + 1;
    if (trajectory.outcome.winnerParticipantId) {
      const id = trajectory.outcome.winnerParticipantId;
      winnerCounts[id] = (winnerCounts[id] ?? 0) + 1;
    }
    for (const step of trajectory.steps) {
      if (step.responseId && step.selectedWeight !== undefined) {
        weightMassByResponse[step.responseId] = (weightMassByResponse[step.responseId] ?? 0) + step.selectedWeight;
      }
    }
  }

  return {
    scenarioId,
    initialStateVersion: initialState.stateVersion,
    config,
    distribution: { trajectories, terminalCounts, winnerCounts, weightMassByResponse },
    provenance: {
      engineVersion: "boxing-simulation-kernel-v1",
      stateVersion: initialState.stateVersion,
      modelVersion: config.modelVersion,
      rulesetVersion: config.rulesetVersion,
      evidenceSetVersion: config.evidenceSetVersion,
      seed: config.seed,
    },
  };
}

function simulateTrajectory(
  initialState: GameState,
  scenarioId: string,
  intervention: BoxingIntervention,
  chain: BoxingResponseChain,
  config: BoxingSimulationConfig,
  simulationIndex: number,
  seed: number,
): BoxingSimulationTrajectory {
  let state = initialState;
  let elapsedMs = 0;
  const steps: BoxingSimulationStep[] = [];
  let terminal = false;
  let terminalReason: string | undefined;

  for (let step = 1; step <= config.maxSteps; step += 1) {
    const rng = new DeterministicRng(seed + step * 0x9e3779b9);
    const response = weightedSelect(chain.responses, rng.next());
    const counters = chain.counters.filter((counter) => counter.responseId === response.responseId);
    const counter = counters.length > 0 && rng.next() < 0.5 ? weightedCounterSelect(counters, rng.next()) : undefined;

    const branchId = `${scenarioId}:sim:${simulationIndex}:step:${step}`;
    const hypothetical = buildCounterfactualState(
      state,
      branchId,
      intervention,
      response,
      counter,
      chain,
      config.modelVersion,
    );

    elapsedMs += config.stepMs;
    const nextState = advanceClock(hypothetical.state, config.stepMs);
    state = nextState;

    steps.push({
      step,
      stateVersion: state.stateVersion,
      elapsedMs,
      branchId,
      responseId: response.responseId,
      counterId: counter?.counterId,
      selectedWeight: response.probability,
      state,
      deltas: hypothetical.deltas,
    });

    const result = terminalFromState(state, elapsedMs);
    if (result.terminal) {
      terminal = true;
      terminalReason = result.reason;
      break;
    }
  }

  return {
    trajectoryId: `${scenarioId}:trajectory:${simulationIndex}`,
    simulationIndex,
    seed,
    steps,
    terminal,
    terminalReason,
    outcome: {
      winnerParticipantId: typeof state.attributes.winnerParticipantId === "string" ? state.attributes.winnerParticipantId : undefined,
      reason: mapOutcomeReason(terminalReason),
      finalStateVersion: state.stateVersion,
    },
  };
}

function advanceClock(state: GameState, stepMs: number): GameState {
  const remaining = Math.max(0, (state.clock.remainingMs ?? 0) - stepMs);
  const attributes = { ...state.attributes };
  if (remaining === 0) {
    attributes.roundComplete = true;
  }
  return { ...state, clock: { ...state.clock, remainingMs: remaining }, attributes, stateVersion: state.stateVersion + 1 };
}

function terminalFromState(state: GameState, elapsedMs: number): { terminal: boolean; reason?: string } {
  if (state.attributes.terminal === true) return { terminal: true, reason: String(state.attributes.terminalReason ?? "unknown") };
  if (elapsedMs >= 180_000) return { terminal: false };
  return { terminal: false };
}

function mapOutcomeReason(reason?: string): BoxingSimulationOutcome["reason"] {
  if (!reason) return "unfinished";
  if (reason === "decision") return "decision";
  if (reason === "knockout") return "knockout";
  if (reason === "technical_knockout") return "technical_knockout";
  if (reason === "retirement") return "retirement";
  return "unknown";
}

function weightedSelect<T extends { probability: number }>(items: T[], random: number): T {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.probability), 0) || items.length;
  let cursor = random * total;
  for (const item of items) {
    cursor -= Math.max(0, item.probability);
    if (cursor <= 0) return item;
  }
  return items[items.length - 1];
}

function weightedCounterSelect(items: BoxingCounterCandidate[], random: number): BoxingCounterCandidate {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.plausibility), 0) || items.length;
  let cursor = random * total;
  for (const item of items) {
    cursor -= Math.max(0, item.plausibility);
    if (cursor <= 0) return item;
  }
  return items[items.length - 1];
}

class DeterministicRng {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x100000000;
  }
}

function mixSeed(seed: number, index: number): number {
  let x = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

function validateConfig(config: BoxingSimulationConfig): void {
  if (!Number.isInteger(config.simulations) || config.simulations < 1) throw new Error("simulations must be >= 1");
  if (!Number.isInteger(config.maxSteps) || config.maxSteps < 1) throw new Error("maxSteps must be >= 1");
  if (!Number.isInteger(config.stepMs) || config.stepMs < 1) throw new Error("stepMs must be >= 1");
  if (!Number.isInteger(config.seed)) throw new Error("seed must be an integer");
}

export function simulationEvidenceRefs(result: BoxingSimulationResult): EvidenceRef[] {
  return [{
    sourceId: `simulation:${result.scenarioId}`,
    sourceType: "simulation",
    locator: `${result.provenance.engineVersion}:${result.config.seed}`,
  } as EvidenceRef];
}
