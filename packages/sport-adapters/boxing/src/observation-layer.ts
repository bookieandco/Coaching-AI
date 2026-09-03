import type { EvidenceRef } from "@coaching-ai/sports-core";

export type BoxingPunchType = "jab" | "cross" | "hook" | "uppercut" | "other" | "unknown";
export type BoxingDefenseType = "forearm_block" | "high_guard" | "parry" | "slip" | "roll" | "step_out" | "clinch" | "other" | "unknown";
export type BoxingObservationKind = "punch" | "defense" | "pose" | "impact" | "target" | "movement";

export interface BoxingTemporalWindow {
  startMs: number;
  endMs: number;
  sourceFrameRate?: number;
}

export interface BoxingObservationBase {
  observationId: string;
  fighterId: string;
  kind: BoxingObservationKind;
  window: BoxingTemporalWindow;
  confidence: number;
  evidenceRefs: EvidenceRef[];
  sourceModel?: string;
  sourceVersion?: string;
  occlusion?: number;
}

export interface BoxingPunchObservation extends BoxingObservationBase {
  kind: "punch";
  punchType: BoxingPunchType;
  hand?: "lead" | "rear" | "unknown";
  targetArea?: "head" | "body" | "unknown";
  landed?: "yes" | "no" | "uncertain";
  contactConfidence?: number;
}

export interface BoxingDefenseObservation extends BoxingObservationBase {
  kind: "defense";
  defenseType: BoxingDefenseType;
  againstObservationId?: string;
  effectiveness?: number;
}

export interface BoxingPoseObservation extends BoxingObservationBase {
  kind: "pose";
  keypoints: Array<{
    name: string;
    x: number;
    y: number;
    confidence: number;
  }>;
}

export interface BoxingImpactObservation extends BoxingObservationBase {
  kind: "impact";
  source: "vision" | "sensor" | "official" | "inferred";
  magnitude?: number;
  targetFighterId: string;
}

export interface BoxingTargetObservation extends BoxingObservationBase {
  kind: "target";
  targetFighterId: string;
  area: "head" | "body" | "arms" | "unknown";
  relation: "exposed" | "covered" | "occupied" | "unknown";
}

export type BoxingObservation =
  | BoxingPunchObservation
  | BoxingDefenseObservation
  | BoxingPoseObservation
  | BoxingImpactObservation
  | BoxingTargetObservation;

export interface BoxingObservationQuality {
  observationId: string;
  cameraQuality: number;
  occlusion: number;
  temporalCompleteness: number;
  identityConfidence: number;
  annotationConfidence?: number;
  notes?: string[];
}

/**
 * Keeps computer-vision output separate from tactical inference.
 * A classifier may observe a hook; this layer must not decide that the hook
 * created an opening or that the opponent will respond in a particular way.
 */
export function observationUsableForScenario(
  observation: BoxingObservation,
  quality: BoxingObservationQuality,
): boolean {
  return (
    observation.confidence >= 0.5 &&
    quality.cameraQuality >= 0.4 &&
    quality.temporalCompleteness >= 0.5 &&
    quality.identityConfidence >= 0.7
  );
}
