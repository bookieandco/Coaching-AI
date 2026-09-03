import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { TennisCourtSurface } from "./index";
import type { TennisRallyObservation, TennisShotObservation } from "./point-reconstruction";

export interface TennisFeatureEstimate {
  value: number;
  uncertainty: number;
  sampleSize: number;
  context: string;
  evidenceRefs: EvidenceRef[];
}

export interface TennisPlayerProfile {
  playerId: string;
  surface: TennisCourtSurface;
  serve: { firstServeRate: TennisFeatureEstimate; aceRate: TennisFeatureEstimate; doubleFaultRate: TennisFeatureEstimate; serveWinnerRate: TennisFeatureEstimate };
  return: { returnPointWinRate: TennisFeatureEstimate; returnDepth: TennisFeatureEstimate; returnAggression: TennisFeatureEstimate };
  rally: { averageLength: TennisFeatureEstimate; longRallyShare: TennisFeatureEstimate; winnerRate: TennisFeatureEstimate; errorRate: TennisFeatureEstimate };
  courtPosition: { netRate: TennisFeatureEstimate; transitionRate: TennisFeatureEstimate; baselineRate: TennisFeatureEstimate };
  pressure: { breakPointWinRate?: TennisFeatureEstimate; tiebreakPointWinRate?: TennisFeatureEstimate };
  evidenceRefs: EvidenceRef[];
}

export interface TennisIntelligenceInput {
  playerId: string;
  surface: TennisCourtSurface;
  rallies: TennisRallyObservation[];
  breakPointRallies?: TennisRallyObservation[];
  tiebreakRallies?: TennisRallyObservation[];
  evidenceRefs?: EvidenceRef[];
}

function estimate(values: number[], context: string, evidenceRefs: EvidenceRef[]): TennisFeatureEstimate {
  const clean = values.filter(Number.isFinite).map((v) => Math.min(1, Math.max(0, v)));
  if (!clean.length) return { value: 0, uncertainty: 1, sampleSize: 0, context, evidenceRefs };
  const mean = clean.reduce((a, b) => a + b, 0) / clean.length;
  const variance = clean.reduce((sum, v) => sum + (v - mean) ** 2, 0) / clean.length;
  return { value: mean, uncertainty: Math.min(1, Math.sqrt(variance) * 0.5 + 1 / Math.sqrt(clean.length)), sampleSize: clean.length, context, evidenceRefs };
}

function estimateRate(numerator: number, denominator: number, context: string, evidenceRefs: EvidenceRef[]): TennisFeatureEstimate {
  return denominator > 0 ? estimate([numerator / denominator], context, evidenceRefs) : estimate([], context, evidenceRefs);
}

function shotEvidence(shots: TennisShotObservation[]): EvidenceRef[] { return shots.flatMap((shot) => shot.evidenceRefs); }

export function buildTennisPlayerProfile(input: TennisIntelligenceInput): TennisPlayerProfile {
  const rallies = input.rallies;
  const playerShots = rallies.flatMap((r) => r.shots.filter((s) => s.actorParticipantId === input.playerId));
  const refs = [...(input.evidenceRefs ?? []), ...shotEvidence(playerShots)];
  const serves = playerShots.filter((s) => s.shotType === "serve");
  const aces = serves.filter((s) => s.terminal === "ace");
  const doubleFaults = serves.filter((s) => s.terminal === "double_fault");
  const winners = playerShots.filter((s) => s.terminal === "winner");
  const errors = playerShots.filter((s) => s.terminal === "forced_error" || s.terminal === "unforced_error" || s.terminal === "double_fault");
  const returns = playerShots.filter((s) => s.shotType === "return");
  const longRallies = rallies.filter((r) => r.shots.length >= 8);
  const netShots = playerShots.filter((s) => s.zone === "net");
  const transitionShots = playerShots.filter((s) => s.zone === "transition");
  const baselineShots = playerShots.filter((s) => s.zone === "baseline");
  const returnWins = rallies.filter((r) => r.shots.some((s) => s.actorParticipantId === input.playerId && s.shotType === "return") && r.pointWinnerParticipantId === input.playerId);
  const break = input.breakPointRallies ?? [];
  const tb = input.tiebreakRallies ?? [];

  return {
    playerId: input.playerId,
    surface: input.surface,
    serve: {
      firstServeRate: estimate(serves.map((s) => s.attributes?.firstServe === true ? 1 : 0), "serve.first_serve_rate", refs),
      aceRate: estimateRate(aces.length, serves.length, "serve.ace_rate", refs),
      doubleFaultRate: estimateRate(doubleFaults.length, serves.length, "serve.double_fault_rate", refs),
      serveWinnerRate: estimateRate(winners.filter((s) => s.shotType === "serve").length, serves.length, "serve.winner_rate", refs),
    },
    return: {
      returnPointWinRate: estimateRate(returnWins.length, Math.max(1, returns.length), "return.point_win_rate", refs),
      returnDepth: estimateRate(returns.filter((s) => s.depth === "deep").length, returns.length, "return.deep_rate", refs),
      returnAggression: estimateRate(returns.filter((s) => s.direction === "down_the_line" || s.direction === "inside_in").length, returns.length, "return.aggression_rate", refs),
    },
    rally: {
      averageLength: estimate(rallies.length ? [Math.min(1, rallies.reduce((sum, r) => sum + r.shots.length, 0) / rallies.length / 20)] : [], "rally.normalized_average_length", refs),
      longRallyShare: estimateRate(longRallies.length, rallies.length, "rally.long_share", refs),
      winnerRate: estimateRate(winners.length, playerShots.length, "rally.winner_rate", refs),
      errorRate: estimateRate(errors.length, playerShots.length, "rally.error_rate", refs),
    },
    courtPosition: {
      netRate: estimateRate(netShots.length, playerShots.length, "court.net_rate", refs),
      transitionRate: estimateRate(transitionShots.length, playerShots.length, "court.transition_rate", refs),
      baselineRate: estimateRate(baselineShots.length, playerShots.length, "court.baseline_rate", refs),
    },
    pressure: {
      breakPointWinRate: break.length ? estimateRate(break.filter((r) => r.pointWinnerParticipantId === input.playerId).length, break.length, "pressure.break_point_win_rate", shotEvidence(break.flatMap((r) => r.shots))) : undefined,
      tiebreakPointWinRate: tb.length ? estimateRate(tb.filter((r) => r.pointWinnerParticipantId === input.playerId).length, tb.length, "pressure.tiebreak_point_win_rate", shotEvidence(tb.flatMap((r) => r.shots))) : undefined,
    },
    evidenceRefs: refs,
  };
}

export function classifyTennisShotObservation(shot: TennisShotObservation): "OBSERVED" | "INFERRED" { return shot.evidenceLabel; }
