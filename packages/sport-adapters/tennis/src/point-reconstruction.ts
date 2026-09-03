import type { EvidenceRef } from "@coaching-ai/sports-core";

export type TennisShotType =
  | "serve" | "return" | "groundstroke" | "volley" | "smash" | "lob"
  | "drop_shot" | "unknown";
export type TennisTerminalType =
  | "winner" | "forced_error" | "unforced_error" | "double_fault"
  | "ace" | "penalty" | "let" | "unknown";
export type TennisCourtZone = "baseline" | "transition" | "net" | "service_box" | "unknown";
export type TennisEvidenceLabel = "OBSERVED" | "INFERRED";

export interface TennisShotObservation {
  shotId: string;
  actorParticipantId: string;
  sequence: number;
  shotType: TennisShotType;
  evidenceLabel: TennisEvidenceLabel;
  confidence: number;
  timestampMs?: number;
  contactFrame?: number;
  bounceFrame?: number;
  direction?: "crosscourt" | "down_the_line" | "inside_out" | "inside_in" | "center" | "unknown";
  depth?: "short" | "medium" | "deep" | "unknown";
  zone?: TennisCourtZone;
  ballSpeedKph?: number;
  apexHeightM?: number;
  terminal?: TennisTerminalType;
  evidenceRefs: EvidenceRef[];
  sourceModel?: string;
  sourceVersion?: string;
}

export interface TennisRallyObservation {
  rallyId: string;
  pointId: string;
  shots: TennisShotObservation[];
  terminal?: TennisTerminalType;
  pointWinnerParticipantId?: string;
  confidence: number;
  evidenceRefs: EvidenceRef[];
  reconstructionVersion: string;
}

export interface TennisPointReconstructionInput {
  pointId: string;
  observations: TennisShotObservation[];
  pointWinnerParticipantId?: string;
  evidenceRefs?: EvidenceRef[];
  reconstructionVersion?: string;
}

export interface TennisPointReconstructionResult {
  rally: TennisRallyObservation;
  warnings: string[];
  validation: { valid: boolean; errors: string[] };
}

const TERMINALS = new Set<TennisTerminalType>([
  "winner", "forced_error", "unforced_error", "double_fault", "ace", "penalty",
]);

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function transitionLegal(previous: TennisShotObservation, current: TennisShotObservation): boolean {
  if (previous.actorParticipantId === current.actorParticipantId) return false;
  if (previous.terminal && previous.terminal !== "let") return false;
  return true;
}

/**
 * Reconstructs an ordered rally from already-extracted observations.
 * It never invents a shot and never changes an observation into an observed fact merely
 * because sequence rules make another interpretation more plausible.
 */
export function reconstructTennisPoint(input: TennisPointReconstructionInput): TennisPointReconstructionResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const shots = [...input.observations].sort((a, b) =>
    (a.timestampMs ?? Number.MAX_SAFE_INTEGER) - (b.timestampMs ?? Number.MAX_SAFE_INTEGER) ||
    a.sequence - b.sequence || a.shotId.localeCompare(b.shotId),
  );

  if (!input.pointId) errors.push("POINT_ID_REQUIRED");
  if (shots.length === 0) warnings.push("No shot observations were supplied; point remains unreconstructed.");

  for (let i = 0; i < shots.length; i += 1) {
    const shot = shots[i];
    if (!shot.actorParticipantId) errors.push(`SHOT_ACTOR_REQUIRED:${shot.shotId}`);
    if (shot.confidence < 0 || shot.confidence > 1) errors.push(`INVALID_CONFIDENCE:${shot.shotId}`);
    if (i > 0 && !transitionLegal(shots[i - 1], shot)) {
      warnings.push(`ILLEGAL_SEQUENCE:${shots[i - 1].shotId}->${shot.shotId}`);
    }
    if (shot.terminal && TERMINALS.has(shot.terminal) && i !== shots.length - 1) {
      warnings.push(`POST_TERMINAL_OBSERVATION:${shot.shotId}`);
    }
    if (shot.ballSpeedKph !== undefined && shot.ballSpeedKph < 0) errors.push(`INVALID_SPEED:${shot.shotId}`);
    if (shot.apexHeightM !== undefined && shot.apexHeightM < 0) errors.push(`INVALID_APEX:${shot.shotId}`);
  }

  const terminal = [...shots].reverse().find((shot) => shot.terminal)?.terminal;
  const inferredWinner = terminal === "double_fault" || terminal === "unforced_error" || terminal === "forced_error"
    ? shots[shots.length - 1]?.actorParticipantId
    : terminal === "winner" || terminal === "ace"
      ? shots[shots.length - 1]?.actorParticipantId
      : undefined;

  if (input.pointWinnerParticipantId && inferredWinner && input.pointWinnerParticipantId !== inferredWinner) {
    warnings.push("POINT_WINNER_CONFLICTS_WITH_SHOT_TERMINAL");
  }

  const confidence = shots.length
    ? clamp01(shots.reduce((sum, shot) => sum + clamp01(shot.confidence), 0) / shots.length)
    : 0;

  const rally: TennisRallyObservation = {
    rallyId: `rally:${input.pointId}`,
    pointId: input.pointId,
    shots,
    terminal,
    pointWinnerParticipantId: input.pointWinnerParticipantId,
    confidence,
    evidenceRefs: [...(input.evidenceRefs ?? []), ...shots.flatMap((shot) => shot.evidenceRefs)],
    reconstructionVersion: input.reconstructionVersion ?? "tennis-rally-reconstruction-v1",
  };

  return { rally, warnings, validation: { valid: errors.length === 0, errors } };
}

export function summarizeRally(rally: TennisRallyObservation) {
  const shotsByPlayer: Record<string, number> = {};
  for (const shot of rally.shots) shotsByPlayer[shot.actorParticipantId] = (shotsByPlayer[shot.actorParticipantId] ?? 0) + 1;
  return {
    rallyId: rally.rallyId,
    shotCount: rally.shots.length,
    rallyLength: rally.shots.length,
    terminal: rally.terminal ?? "unknown",
    pointWinnerParticipantId: rally.pointWinnerParticipantId,
    shotsByPlayer,
    confidence: rally.confidence,
    evidenceCount: rally.evidenceRefs.length,
  };
}
