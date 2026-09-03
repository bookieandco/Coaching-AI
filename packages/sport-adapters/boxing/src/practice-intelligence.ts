import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { BoxingFighterProfile, BoxingMatchupModel } from "./fighter-intelligence";
import type { BoxingScenarioEvaluation } from "./scenario-learning";
import type { BoxingWinPathReport } from "./win-path-engine";

export type BoxingPracticeEvidenceLabel = "OBSERVED" | "INFERRED" | "HYPOTHETICAL";

export type BoxingPracticeSkillArea =
  | "defense"
  | "ring_control"
  | "pressure_response"
  | "exit_direction"
  | "body_attack"
  | "countering"
  | "distance_control"
  | "tempo"
  | "conditioning"
  | "damage_management"
  | "scenario_adaptation";

export interface BoxingPracticeObservation {
  observationId: string;
  skillArea: BoxingPracticeSkillArea;
  description: string;
  effectiveness?: number;
  source: "fight" | "video" | "simulation" | "manual";
  evidenceRefs: EvidenceRef[];
}

export interface BoxingPracticeGap {
  gapId: string;
  skillArea: BoxingPracticeSkillArea;
  description: string;
  basis: BoxingPracticeEvidenceLabel;
  severity: number;
  confidence: number;
  evidenceRefs: EvidenceRef[];
}

export interface BoxingPracticeObjective {
  objectiveId: string;
  skillArea: BoxingPracticeSkillArea;
  targetBehavior: string;
  targetMetric?: string;
  measurementMethod: string;
  priority: number;
  confidence: number;
  evidenceRefs: EvidenceRef[];
}

export interface BoxingDrillCandidate {
  drillId: string;
  name: string;
  skillArea: BoxingPracticeSkillArea;
  objectiveId: string;
  format: string;
  progression: string[];
  label: "HYPOTHETICAL";
  evidenceRefs: EvidenceRef[];
}

export interface BoxingPracticeSessionPlan {
  planId: string;
  fighterId: string;
  objectives: BoxingPracticeObjective[];
  drillCandidates: BoxingDrillCandidate[];
  gaps: BoxingPracticeGap[];
  evidenceRefs: EvidenceRef[];
  provenance: { engineVersion: string; sourceStateVersion?: number };
}

export interface BoxingPracticeIntelligenceInput {
  fighter: BoxingFighterProfile;
  matchup?: BoxingMatchupModel;
  observations?: BoxingPracticeObservation[];
  evaluation?: BoxingScenarioEvaluation;
  winPaths?: BoxingWinPathReport;
  sourceStateVersion?: number;
}

export interface BoxingPracticeIntelligenceResult {
  plan: BoxingPracticeSessionPlan;
  provenance: { engineVersion: string };
}

const ENGINE_VERSION = "boxing-practice-intelligence-v1";

export function buildBoxingPracticeIntelligence(
  input: BoxingPracticeIntelligenceInput,
): BoxingPracticeIntelligenceResult {
  const gaps = deriveGaps(input);
  const objectives = gaps.map(toObjective);
  const drillCandidates = objectives.map(toDrillCandidate);
  const evidenceRefs = dedupeEvidence([
    ...input.fighter.evidenceRefs,
    ...(input.observations ?? []).flatMap((o) => o.evidenceRefs),
    ...(input.evaluation?.evidenceRefs ?? []),
    ...(input.winPaths?.paths ?? []).flatMap((p) => p.evidenceRefs),
  ]);

  return {
    plan: {
      planId: `practice:${input.fighter.fighterId}:${ENGINE_VERSION}`,
      fighterId: input.fighter.fighterId,
      objectives,
      drillCandidates,
      gaps,
      evidenceRefs,
      provenance: { engineVersion: ENGINE_VERSION, sourceStateVersion: input.sourceStateVersion },
    },
    provenance: { engineVersion: ENGINE_VERSION },
  };
}

function deriveGaps(input: BoxingPracticeIntelligenceInput): BoxingPracticeGap[] {
  const gaps: BoxingPracticeGap[] = [];
  const observations = input.observations ?? [];

  const recurring = new Map<BoxingPracticeSkillArea, BoxingPracticeObservation[]>();
  for (const observation of observations) {
    const list = recurring.get(observation.skillArea) ?? [];
    list.push(observation);
    recurring.set(observation.skillArea, list);
  }

  for (const [skillArea, list] of recurring) {
    const weak = list.filter((o) => o.effectiveness !== undefined && o.effectiveness < 0.5).length;
    if (weak === 0) continue;
    const severity = Math.min(1, weak / Math.max(1, list.length));
    gaps.push({
      gapId: `gap:${skillArea}`,
      skillArea,
      description: `Recurring weakness observed in ${skillArea.replace(/_/g, " ")}.`,
      basis: "OBSERVED",
      severity,
      confidence: Math.min(1, 0.5 + 0.1 * list.length),
      evidenceRefs: dedupeEvidence(list.flatMap((o) => o.evidenceRefs)),
    });
  }

  const profileSignals: Array<[BoxingPracticeSkillArea, number, string]> = [
    ["defense", input.fighter.defense.value, "Improve defensive consistency."],
    ["ring_control", input.fighter.ringControl.value, "Improve ability to maintain preferred ring position."],
    ["pressure_response", input.fighter.pressure.value, "Improve response quality under pressure."],
    ["countering", input.fighter.countering.value, "Improve countering reliability."],
    ["distance_control", input.fighter.distanceControl.value, "Improve control of preferred fighting distance."],
    ["body_attack", input.fighter.bodyAttack.value, "Improve body-attack effectiveness."],
    ["conditioning", input.fighter.lateRoundPerformance.value, "Improve late-round performance stability."],
  ];

  for (const [skillArea, value, description] of profileSignals) {
    if (value >= 0.5) continue;
    if (gaps.some((g) => g.skillArea === skillArea)) continue;
    gaps.push({
      gapId: `profile-gap:${skillArea}`,
      skillArea,
      description,
      basis: "INFERRED",
      severity: 1 - value,
      confidence: input.fighter.defense.confidence,
      evidenceRefs: input.fighter.evidenceRefs,
    });
  }

  if (input.evaluation?.observedVsSimulatedDelta !== undefined && Math.abs(input.evaluation.observedVsSimulatedDelta) > 0.2) {
    gaps.push({
      gapId: "scenario-divergence",
      skillArea: "scenario_adaptation",
      description: "Observed execution diverged materially from the simulated scenario baseline; isolate the behavior causing the divergence.",
      basis: "INFERRED",
      severity: Math.min(1, Math.abs(input.evaluation.observedVsSimulatedDelta)),
      confidence: 0.6,
      evidenceRefs: input.evaluation.evidenceRefs,
    });
  }

  return gaps.sort((a, b) => (b.severity * b.confidence) - (a.severity * a.confidence));
}

function toObjective(gap: BoxingPracticeGap, index: number): BoxingPracticeObjective {
  return {
    objectiveId: `objective:${gap.gapId}`,
    skillArea: gap.skillArea,
    targetBehavior: gap.description,
    targetMetric: metricFor(gap.skillArea),
    measurementMethod: measurementFor(gap.skillArea),
    priority: Math.max(0.1, gap.severity * gap.confidence) + Math.max(0, 0.1 - index * 0.01),
    confidence: gap.confidence,
    evidenceRefs: gap.evidenceRefs,
  };
}

function toDrillCandidate(objective: BoxingPracticeObjective): BoxingDrillCandidate {
  return {
    drillId: `drill:${objective.objectiveId}`,
    name: `${labelFor(objective.skillArea)} drill`,
    skillArea: objective.skillArea,
    objectiveId: objective.objectiveId,
    format: formatFor(objective.skillArea),
    progression: ["isolated technique", "constrained repetition", "live resistance", "re-test under scenario pressure"],
    label: "HYPOTHETICAL",
    evidenceRefs: objective.evidenceRefs,
  };
}

function labelFor(skill: BoxingPracticeSkillArea): string {
  return skill.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function metricFor(skill: BoxingPracticeSkillArea): string | undefined {
  const metrics: Partial<Record<BoxingPracticeSkillArea, string>> = {
    defense: "successful defensive responses per relevant exchange",
    ring_control: "time or exchanges maintained in preferred ring position",
    pressure_response: "effective responses following opponent pressure",
    exit_direction: "successful exits without conceding the targeted follow-up",
    body_attack: "effective body attacks per committed exchange",
    countering: "effective counters following identified triggers",
    distance_control: "time maintained at intended distance",
    tempo: "successful tempo changes without loss of defensive structure",
    conditioning: "late-round performance relative to earlier-round baseline",
  };
  return metrics[skill];
}

function measurementFor(skill: BoxingPracticeSkillArea): string {
  if (skill === "conditioning") return "Compare tracked performance across late-round and early-round segments.";
  if (skill === "scenario_adaptation") return "Replay the relevant scenario and compare observed behavior with the prior baseline.";
  return "Use tagged practice repetitions and, where available, video/tracking evidence.";
}

function formatFor(skill: BoxingPracticeSkillArea): string {
  if (skill === "pressure_response") return "partner pressure rounds with predefined triggers";
  if (skill === "ring_control" || skill === "distance_control") return "constrained footwork and positioning rounds";
  if (skill === "countering") return "trigger-response partner rounds";
  if (skill === "conditioning") return "late-round fatigue-state technical rounds";
  if (skill === "defense") return "defense-first constrained exchanges";
  return "skill-isolation rounds progressing to live resistance";
}

function dedupeEvidence(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.evidenceId)) return false;
    seen.add(ref.evidenceId);
    return true;
  });
}
