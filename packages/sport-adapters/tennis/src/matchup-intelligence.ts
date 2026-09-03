import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { TennisCourtSurface } from "./index";
import type { TennisPlayerProfile, TennisFeatureEstimate } from "./player-intelligence";

export type TennisMatchupDimension =
  | "first_serve"
  | "second_serve"
  | "return"
  | "rally"
  | "court_position"
  | "pressure";

export interface TennisMatchupInteraction {
  dimension: TennisMatchupDimension;
  serverParticipantId: string;
  receiverParticipantId: string;
  advantage: number;
  uncertainty: number;
  basis: string;
  evidenceRefs: EvidenceRef[];
}

export interface TennisMatchupModel {
  serverParticipantId: string;
  receiverParticipantId: string;
  surface: TennisCourtSurface;
  interactions: TennisMatchupInteraction[];
  serveReturnEdge: TennisFeatureEstimate;
  rallyEdge: TennisFeatureEstimate;
  pressureEdge?: TennisFeatureEstimate;
  evidenceRefs: EvidenceRef[];
  provenance: { modelVersion: string; source: "inferred" };
}

function edge(a: number, b: number): number {
  return Math.max(-1, Math.min(1, a - b));
}

function interaction(
  dimension: TennisMatchupDimension,
  server: TennisPlayerProfile,
  receiver: TennisPlayerProfile,
  advantage: number,
  basis: string,
): TennisMatchupInteraction {
  const refs = [...server.evidenceRefs, ...receiver.evidenceRefs];
  const uncertainty = Math.min(1, (server.serve.firstServeRate.uncertainty + receiver.return.returnPointWinRate.uncertainty) / 2);
  return {
    dimension,
    serverParticipantId: server.playerId,
    receiverParticipantId: receiver.playerId,
    advantage,
    uncertainty,
    basis,
    evidenceRefs: refs,
  };
}

/**
 * Compares two evidence-backed player profiles. Values are matchup deltas, not win
 * probabilities and must not be presented as predictions without calibration.
 */
export function buildTennisMatchupModel(
  server: TennisPlayerProfile,
  receiver: TennisPlayerProfile,
  surface: TennisCourtSurface,
): TennisMatchupModel {
  const interactions = [
    interaction("first_serve", server, receiver,
      edge(server.serve.aceRate.value + server.serve.serveWinnerRate.value, receiver.return.returnPointWinRate.value),
      "server first-serve production versus receiver return-point performance"),
    interaction("second_serve", server, receiver,
      edge(1 - server.serve.doubleFaultRate.value, receiver.return.returnPointWinRate.value),
      "second-serve safety versus return conversion"),
    interaction("return", receiver, server,
      edge(receiver.return.returnPointWinRate.value, server.serve.serveWinnerRate.value),
      "receiver return conversion versus server serve-winner production"),
    interaction("rally", server, receiver,
      edge(server.rally.winnerRate.value - server.rally.errorRate.value, receiver.rally.winnerRate.value - receiver.rally.errorRate.value),
      "net rally efficiency comparison"),
    interaction("court_position", server, receiver,
      edge(server.courtPosition.netRate + server.courtPosition.transitionRate, receiver.courtPosition.netRate + receiver.courtPosition.transitionRate),
      "forward-court usage comparison"),
  ];

  const serveReturn = (interactions[0].advantage + interactions[1].advantage) / 2;
  const rally = interactions[3].advantage;
  const pressureValues = [server.pressure.breakPointWinRate?.value, receiver.pressure.breakPointWinRate?.value]
    .filter((v): v is number => Number.isFinite(v));
  const pressureEdge = pressureValues.length === 2
    ? {
        value: edge(server.pressure.breakPointWinRate!.value, receiver.pressure.breakPointWinRate!.value),
        uncertainty: Math.min(1, (server.pressure.breakPointWinRate!.uncertainty + receiver.pressure.breakPointWinRate!.uncertainty) / 2),
        sampleSize: Math.min(server.pressure.breakPointWinRate!.sampleSize, receiver.pressure.breakPointWinRate!.sampleSize),
        context: "pressure.break_point_win_rate_delta",
        evidenceRefs: [...server.evidenceRefs, ...receiver.evidenceRefs],
      }
    : undefined;

  return {
    serverParticipantId: server.playerId,
    receiverParticipantId: receiver.playerId,
    surface,
    interactions,
    serveReturnEdge: {
      value: serveReturn,
      uncertainty: Math.min(1, (server.serve.aceRate.uncertainty + receiver.return.returnPointWinRate.uncertainty) / 2),
      sampleSize: Math.min(server.serve.aceRate.sampleSize, receiver.return.returnPointWinRate.sampleSize),
      context: "serve_return_matchup_delta",
      evidenceRefs: [...server.evidenceRefs, ...receiver.evidenceRefs],
    },
    rallyEdge: {
      value: rally,
      uncertainty: Math.min(1, (server.rally.winnerRate.uncertainty + receiver.rally.winnerRate.uncertainty) / 2),
      sampleSize: Math.min(server.rally.winnerRate.sampleSize, receiver.rally.winnerRate.sampleSize),
      context: "rally_efficiency_matchup_delta",
      evidenceRefs: [...server.evidenceRefs, ...receiver.evidenceRefs],
    },
    pressureEdge,
    evidenceRefs: [...server.evidenceRefs, ...receiver.evidenceRefs],
    provenance: { modelVersion: "tennis-matchup-v1", source: "inferred" },
  };
}
