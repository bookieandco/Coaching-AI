import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { TennisMatchState } from "./index";
import type { TennisOpponentResponse, TennisTacticalIntervention, TennisCounterPath } from "./tactical-scenarios";

export interface TennisStateDelta {
  changedPaths: string[];
  tacticalMode: {
    interventionType?: string;
    interventionObjective?: string;
    opponentResponseType?: string;
    counterType?: string;
  };
}

export interface TennisCounterfactualState {
  state: TennisMatchState;
  scenarioId: string;
  sourceStateVersion: number;
  stateVersion: number;
  delta: TennisStateDelta;
  evidenceRefs: EvidenceRef[];
  provenance: {
    engineVersion: string;
    source: "hypothetical";
  };
}

export interface TennisCounterfactualInput {
  state: TennisMatchState;
  scenarioId: string;
  intervention: TennisTacticalIntervention;
  response?: TennisOpponentResponse;
  counter?: TennisCounterPath;
  engineVersion?: string;
}

function uniqueRefs(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.evidenceId)) return false;
    seen.add(ref.evidenceId);
    return true;
  });
}

/**
 * Creates a versioned hypothetical state without pretending that the tactical
 * branch actually occurred. Score, participants, and canonical observed facts
 * remain unchanged; hypothetical choices live in tacticalMode.
 */
export function buildTennisCounterfactualState(input: TennisCounterfactualInput): TennisCounterfactualState {
  const { state, intervention, response, counter } = input;
  const evidenceRefs = uniqueRefs([
    ...state.evidenceRefs,
    ...intervention.evidenceRefs,
    ...(response?.evidenceRefs ?? []),
    ...(counter?.evidenceRefs ?? []),
  ]);

  const tacticalMode = {
    interventionType: intervention.type,
    interventionObjective: intervention.objective,
    opponentResponseType: response?.type,
    counterType: counter?.type,
  };

  const nextState: TennisMatchState = {
    ...state,
    attributes: {
      ...state.attributes,
      tacticalMode,
    },
    evidenceRefs,
    stateVersion: state.stateVersion + 1,
  };

  const changedPaths = [
    "attributes.tacticalMode",
    "evidenceRefs",
    "stateVersion",
  ];

  return {
    state: nextState,
    scenarioId: input.scenarioId,
    sourceStateVersion: state.stateVersion,
    stateVersion: nextState.stateVersion,
    delta: { changedPaths, tacticalMode },
    evidenceRefs,
    provenance: {
      engineVersion: input.engineVersion ?? "tennis-counterfactual-v1",
      source: "hypothetical",
    },
  };
}
