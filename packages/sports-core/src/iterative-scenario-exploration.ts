import type { ScenarioEvaluation } from "./scenario-evaluation";
import {
  chooseScenarioSearchAction,
  createScenarioSearchWorldModel,
  updateScenarioSearchWorldModel,
  type ScenarioSearchAction,
  type ScenarioSearchNode,
  type ScenarioSearchWorldModel,
} from "./scenario-search-world-model";

export interface IterativeScenarioRoundInput {
  round: number;
  node: ScenarioSearchNode;
  evaluation?: ScenarioEvaluation;
  improved: boolean;
}

export interface IterativeScenarioSearchConfig {
  maxRounds: number;
  stagnationWindow?: number;
  maxNodes?: number;
}

export interface IterativeScenarioSearchState {
  worldModel: ScenarioSearchWorldModel;
  roundsCompleted: number;
  stopped: boolean;
  stopReason?: "max_rounds" | "stagnation" | "node_budget" | "explicit_stop";
  nextAction: ScenarioSearchAction;
}

export function createIterativeScenarioSearch(input: {
  modelId: string;
  explorationId: string;
  stateSignature: string;
  config: IterativeScenarioSearchConfig;
}): IterativeScenarioSearchState {
  const model = createScenarioSearchWorldModel({
    modelId: input.modelId,
    explorationId: input.explorationId,
    stateSignature: input.stateSignature,
  });
  return {
    worldModel: model,
    roundsCompleted: 0,
    stopped: input.config.maxRounds <= 0,
    stopReason: input.config.maxRounds <= 0 ? "max_rounds" : undefined,
    nextAction: "expand",
  };
}

export function advanceIterativeScenarioSearch(
  state: IterativeScenarioSearchState,
  input: IterativeScenarioRoundInput,
  config: IterativeScenarioSearchConfig,
): IterativeScenarioSearchState {
  if (state.stopped) return state;

  const model = updateScenarioSearchWorldModel(state.worldModel, {
    node: {
      ...input.node,
      evaluation: input.evaluation ?? input.node.evaluation,
      visits: Math.max(0, input.node.visits),
    },
    round: input.round,
    improved: input.improved,
    nextAction: input.improved ? "refine" : chooseScenarioSearchAction(state.worldModel),
  });

  const roundsCompleted = Math.max(state.roundsCompleted, input.round);
  const stagnationWindow = Math.max(1, config.stagnationWindow ?? 5);
  const nodeBudget = config.maxNodes === undefined ? Infinity : Math.max(1, config.maxNodes);

  if (roundsCompleted >= Math.max(0, config.maxRounds)) {
    return { worldModel: model, roundsCompleted, stopped: true, stopReason: "max_rounds", nextAction: "stop" };
  }
  if (model.nodes.length >= nodeBudget) {
    return { worldModel: model, roundsCompleted, stopped: true, stopReason: "node_budget", nextAction: "stop" };
  }
  if (model.stagnationRounds >= stagnationWindow) {
    return { worldModel: model, roundsCompleted, stopped: true, stopReason: "stagnation", nextAction: "counter" };
  }

  const nextAction = chooseScenarioSearchAction(model);
  if (nextAction === "stop") {
    return { worldModel: model, roundsCompleted, stopped: true, stopReason: "explicit_stop", nextAction };
  }
  return { worldModel: model, roundsCompleted, stopped: false, nextAction };
}

export function replayIterativeScenarioSearch(
  rounds: IterativeScenarioRoundInput[],
  input: { modelId: string; explorationId: string; stateSignature: string; config: IterativeScenarioSearchConfig },
): IterativeScenarioSearchState {
  let state = createIterativeScenarioSearch(input);
  for (const round of [...rounds].sort((a, b) => a.round - b.round)) {
    state = advanceIterativeScenarioSearch(state, round, input.config);
    if (state.stopped) break;
  }
  return state;
}
