import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { TennisMatchState } from "./index";
import { applyTennisPoint } from "./scoring";

export type TennisPointTransitionLabel = "server_point" | "receiver_point";

export interface TennisOutcomeTransitionModel {
  modelVersion: string;
  source: "inferred" | "observed" | "hybrid";
  serverPointWeight: number;
  receiverPointWeight: number;
  uncertainty: number;
  evidenceRefs: EvidenceRef[];
}

export interface TennisOutcomeTransitionResult {
  state: TennisMatchState;
  winnerParticipantId?: string;
  transitionLabel: TennisPointTransitionLabel;
  gameWon: boolean;
  setWon: boolean;
  matchWon: boolean;
  uncertainty: number;
  evidenceRefs: EvidenceRef[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Applies one already-selected point outcome. The selection model is deliberately
 * separate: this function never invents a winner or converts a heuristic edge into
 * a calibrated probability.
 */
export function applyTennisOutcomeTransition(
  state: TennisMatchState,
  winnerParticipantId: string,
  model: TennisOutcomeTransitionModel,
): TennisOutcomeTransitionResult {
  const serverId = state.attributes.serverParticipantId;
  const label: TennisPointTransitionLabel = winnerParticipantId === serverId ? "server_point" : "receiver_point";
  const transition = applyTennisPoint(state, winnerParticipantId);

  return {
    state: transition.state,
    winnerParticipantId: transition.winnerParticipantId,
    transitionLabel: label,
    gameWon: transition.gameWon,
    setWon: transition.setWon,
    matchWon: transition.matchWon,
    uncertainty: clamp(model.uncertainty, 0, 1),
    evidenceRefs: model.evidenceRefs,
  };
}

export function buildHeuristicOutcomeModel(
  serverEdge: number,
  uncertainty: number,
  evidenceRefs: EvidenceRef[] = [],
): TennisOutcomeTransitionModel {
  // Relative sampling weights only. They are NOT calibrated probabilities.
  const bounded = clamp(serverEdge, -1, 1);
  return {
    modelVersion: "tennis-outcome-transition-heuristic-v1",
    source: "inferred",
    serverPointWeight: 1 + bounded * 0.5,
    receiverPointWeight: 1 - bounded * 0.5,
    uncertainty: clamp(uncertainty, 0, 1),
    evidenceRefs,
  };
}
