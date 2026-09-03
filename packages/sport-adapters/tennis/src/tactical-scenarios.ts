import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { TennisMatchState } from "./index";
import type { TennisMatchupModel } from "./matchup-intelligence";
import { adaptiveResponsesForScenario, type TennisAdaptiveState } from "./adaptive-opponent";

export type TennisTacticalInterventionType =
  | "serve_direction_change"
  | "serve_speed_change"
  | "second_serve_shape_change"
  | "return_position_change"
  | "return_aggression_change"
  | "rally_length_change"
  | "court_position_change"
  | "tempo_change";

export interface TennisTacticalIntervention {
  interventionId: string;
  type: TennisTacticalInterventionType;
  actorParticipantId: string;
  objective: string;
  assumptions: string[];
  evidenceRefs: EvidenceRef[];
}

export interface TennisOpponentResponse {
  responseId: string;
  type: string;
  rationale: string;
  relativeWeight: number;
  uncertainty: number;
  evidenceRefs: EvidenceRef[];
}

export interface TennisCounterPath {
  counterId: string;
  responseId: string;
  type: string;
  rationale: string;
  evidenceRefs: EvidenceRef[];
}

export interface TennisTacticalScenario {
  scenarioId: string;
  sourceStateVersion: number;
  serverParticipantId?: string;
  receiverParticipantId?: string;
  intervention: TennisTacticalIntervention;
  opponentResponses: TennisOpponentResponse[];
  counterPaths: TennisCounterPath[];
  matchupContext: TennisMatchupModel;
  evidenceRefs: EvidenceRef[];
  provenance: { engineVersion: string; source: "inferred" | "hypothetical" };
}

function response(
  intervention: TennisTacticalIntervention,
  type: string,
  rationale: string,
  weight: number,
  uncertainty: number,
  refs: EvidenceRef[],
): TennisOpponentResponse {
  return {
    responseId: `${intervention.interventionId}:response:${type}`,
    type,
    rationale,
    relativeWeight: weight,
    uncertainty,
    evidenceRefs: refs,
  };
}

export function generateTennisTacticalScenarios(
  state: TennisMatchState,
  matchup: TennisMatchupModel,
  adaptiveState?: TennisAdaptiveState,
): TennisTacticalScenario[] {
  const actor = matchup.serverParticipantId;
  const refs = [...new Set(matchup.evidenceRefs.map((r) => r.evidenceId))]
    .map((id) => matchup.evidenceRefs.find((r) => r.evidenceId === id)!)
    .filter(Boolean);

  const seeds: Array<Omit<TennisTacticalIntervention, "interventionId">> = [
    { type: "serve_direction_change", actorParticipantId: actor, objective: "test a different serve lane against the current return matchup", assumptions: ["serve-direction change is technically available"], evidenceRefs: refs },
    { type: "serve_speed_change", actorParticipantId: actor, objective: "test a pace change while preserving serve intent", assumptions: ["pace can be varied without changing the target objective"], evidenceRefs: refs },
    { type: "second_serve_shape_change", actorParticipantId: actor, objective: "test a safer or differently shaped second-serve pattern", assumptions: ["second-serve variation is available"], evidenceRefs: refs },
    { type: "return_position_change", actorParticipantId: matchup.receiverParticipantId, objective: "test a different return position", assumptions: ["receiver can alter starting position"], evidenceRefs: refs },
    { type: "return_aggression_change", actorParticipantId: matchup.receiverParticipantId, objective: "test a change in return aggression", assumptions: ["receiver can alter return intent"], evidenceRefs: refs },
    { type: "rally_length_change", actorParticipantId: actor, objective: "test a different rally-length target", assumptions: ["both players can sustain the requested pattern"], evidenceRefs: refs },
    { type: "court_position_change", actorParticipantId: actor, objective: "test a change in forward-court positioning", assumptions: ["transition opportunities exist"], evidenceRefs: refs },
    { type: "tempo_change", actorParticipantId: actor, objective: "test a change in point tempo", assumptions: ["tempo can be intentionally varied"], evidenceRefs: refs },
  ];

  return seeds.map((seed, index) => {
    const intervention: TennisTacticalIntervention = {
      ...seed,
      interventionId: `tennis-scenario-${state.stateVersion}-${index + 1}`,
    };
    const baseUncertainty = Math.min(1, matchup.serveReturnEdge.uncertainty + 0.15);
    const responseTypes = seed.type.includes("serve")
      ? ["change_return_position", "increase_return_aggression", "hold_return_shape"]
      : seed.type.includes("return")
        ? ["serve_direction_change", "serve_speed_change", "extend_rally"]
        : ["match_tempo", "change_court_position", "attack_earlier"];
    const weights = [1, 0.8, 0.6];
    const baseResponses = responseTypes.map((type, i) => response(
      intervention,
      type,
      `hypothesized opponent response to ${seed.type}`,
      weights[i],
      baseUncertainty,
      refs,
    ));
    const opponentResponses = adaptiveResponsesForScenario(baseResponses, adaptiveState);
    const counterPaths = opponentResponses.map((r) => ({
      counterId: `${intervention.interventionId}:counter:${r.responseId.split(":").pop()}`,
      responseId: r.responseId,
      type: `counter_${r.type}`,
      rationale: `hypothesized counter-path after ${r.type}`,
      evidenceRefs: r.evidenceRefs,
    }));
    return {
      scenarioId: intervention.interventionId,
      sourceStateVersion: state.stateVersion,
      serverParticipantId: matchup.serverParticipantId,
      receiverParticipantId: matchup.receiverParticipantId,
      intervention,
      opponentResponses,
      counterPaths,
      matchupContext: matchup,
      evidenceRefs: refs,
      provenance: { engineVersion: "tennis-tactical-scenarios-v2", source: "hypothetical" },
    };
  });
}
