import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { TennisMatchState } from "./index";
import type { TennisCounterfactualState } from "./counterfactual";
import type { TennisTacticalScenario } from "./tactical-scenarios";
import { applyTennisOutcomeTransition, buildHeuristicOutcomeModel } from "./outcome-transition";

export interface TennisSimulationConfig {
  simulationCount: number;
  maxSteps: number;
  seed: number;
  modelVersion?: string;
}

export interface TennisSimulationStep {
  step: number;
  winnerParticipantId: string;
  transitionLabel: "server_point" | "receiver_point";
  gameWon: boolean;
  setWon: boolean;
  matchWon: boolean;
  stateVersion: number;
}

export interface TennisSimulationTrajectory {
  trajectoryId: string;
  scenarioId: string;
  seed: number;
  steps: number;
  terminalClass: "continuation" | "point" | "game" | "set" | "match";
  responseType?: string;
  counterType?: string;
  finalState: TennisMatchState;
  stepHistory: TennisSimulationStep[];
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

function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) | 0;
}

function randomUnit(seed: number): number {
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

function chooseWeighted<T extends { relativeWeight: number }>(seed: number, items: T[]): { item?: T; seed: number } {
  const next = nextSeed(seed);
  if (items.length === 0) return { seed: next };
  const total = items.reduce((sum, item) => sum + Math.max(0, item.relativeWeight), 0);
  if (total <= 0) return { item: items[0], seed: next };
  let cursor = randomUnit(next) * total;
  for (const item of items) {
    cursor -= Math.max(0, item.relativeWeight);
    if (cursor < 0) return { item, seed: next };
  }
  return { item: items[items.length - 1], seed: next };
}

function chooseWinner(seed: number, serverId: string, receiverId: string, serverWeight: number, receiverWeight: number): { winnerId: string; seed: number } {
  const next = nextSeed(seed);
  const total = Math.max(0, serverWeight) + Math.max(0, receiverWeight);
  const serverShare = total > 0 ? Math.max(0, serverWeight) / total : 0.5;
  return { winnerId: randomUnit(next) < serverShare ? serverId : receiverId, seed: next };
}

function branchSeed(base: number, index: number): number {
  return (base ^ Math.imul(index + 1, 0x9e3779b9)) | 0;
}

function swapServer(state: TennisMatchState): TennisMatchState {
  const ids = state.participants.map((p) => p.participantId);
  if (ids.length !== 2) return state;
  const current = state.attributes.serverParticipantId;
  const next = current === ids[0] ? ids[1] : ids[0];
  return { ...state, attributes: { ...state.attributes, serverParticipantId: next, receiverParticipantId: current } };
}

function terminalClass(result: { gameWon: boolean; setWon: boolean; matchWon: boolean }): TennisSimulationTrajectory["terminalClass"] {
  if (result.matchWon) return "match";
  if (result.setWon) return "set";
  if (result.gameWon) return "game";
  return "point";
}

/**
 * B-28 extends B-26 with adaptive response-weight sampling.
 * Relative weights are search/simulation weights, never calibrated probabilities.
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
    let state = counterfactual.state;
    let seed = branchSeed(config.seed, i);
    const selectedResult = chooseWeighted(seed, scenario.opponentResponses);
    const selected = selectedResult.item;
    seed = selectedResult.seed;
    const responseType = selected?.type;
    const counterType = selected ? scenario.counterPaths.find((c) => c.responseId === selected.responseId)?.type : undefined;
    const history: TennisSimulationStep[] = [];
    let terminal: TennisSimulationTrajectory["terminalClass"] = "continuation";

    for (let step = 1; step <= maxSteps; step += 1) {
      const ids = state.participants.map((p) => p.participantId);
      const serverId = state.attributes.serverParticipantId ?? scenario.serverParticipantId ?? ids[0];
      const receiverId = state.attributes.receiverParticipantId ?? scenario.receiverParticipantId ?? ids.find((id) => id !== serverId);
      if (!serverId || !receiverId || serverId === receiverId) break;

      const edge = scenario.matchupContext.serveReturnEdge.advantage;
      const uncertainty = Math.min(1, scenario.matchupContext.serveReturnEdge.uncertainty + (selected?.uncertainty ?? 0) * 0.25);
      const model = buildHeuristicOutcomeModel(edge, uncertainty, scenario.evidenceRefs);
      const choice = chooseWinner(seed, serverId, receiverId, model.serverPointWeight, model.receiverPointWeight);
      seed = choice.seed;
      const transition = applyTennisOutcomeTransition(state, choice.winnerId, model);
      state = { ...transition.state, stateVersion: state.stateVersion + 1 };
      history.push({ step, winnerParticipantId: choice.winnerId, transitionLabel: transition.transitionLabel, gameWon: transition.gameWon, setWon: transition.setWon, matchWon: transition.matchWon, stateVersion: state.stateVersion });
      terminal = terminalClass(transition);
      if (transition.matchWon || transition.setWon) break;
      if (transition.gameWon) {
        // The scoring engine enters a 6-6 tiebreak itself. Do not perform a
        // normal game-service swap on the transition that starts that tiebreak.
        const enteredTiebreak = Boolean(state.attributes.currentSetTiebreak);
        if (!enteredTiebreak) state = swapServer(state);
      }
    }

    trajectories.push({ trajectoryId: `${scenario.scenarioId}:trajectory:${i + 1}`, scenarioId: scenario.scenarioId, seed, steps: history.length, terminalClass: terminal, responseType, counterType, finalState: state, stepHistory: history });
    terminalCounts[terminal] = (terminalCounts[terminal] ?? 0) + 1;
  }

  return {
    scenarioId: scenario.scenarioId,
    sourceStateVersion: counterfactual.sourceStateVersion,
    trajectories,
    terminalCounts,
    provenance: {
      engineVersion: "tennis-deterministic-simulation-v3",
      modelVersion: config.modelVersion ?? "tennis-simulation-model-v1",
      seed: config.seed,
      simulationCount: count,
      maxSteps,
      evidenceRefs: scenario.evidenceRefs,
    },
  };
}
