import type { EvidenceRef, GameState, SportCode } from "./index";
import type { CoachExplanationReadModel } from "./coach-explanation";

export type CoachQueryKind = "explain_state" | "trace_evidence" | "explore_scenario" | "compare_scenarios" | "review_outcome" | "identify_unknowns";
export interface CoachQuery { queryId: string; kind: CoachQueryKind; sport: SportCode; stateSignature: string; gameState?: GameState; scenarioIds?: string[]; evidenceIds?: string[]; question?: string; requestedAt?: string; }
export type CoachResponseKind = "explanation" | "evidence_trace" | "scenario_set" | "outcome_review" | "unknowns";
export interface CoachResponse { queryId: string; kind: CoachResponseKind; stateSignature: string; explanation?: CoachExplanationReadModel; evidenceRefs: EvidenceRef[]; humanDecisionRequired: true; generatedAt?: string; }
export interface CoachCommandBoundary { handle(query: CoachQuery): Promise<CoachResponse>; }

export function validateCoachQuery(query: CoachQuery): string[] {
  const errors: string[] = [];
  if (!query.queryId.trim()) errors.push("queryId is required");
  if (!query.sport) errors.push("sport is required");
  if (!query.stateSignature.trim()) errors.push("stateSignature is required");
  if (query.kind === "explore_scenario" && !query.question?.trim() && !query.scenarioIds?.length) errors.push("scenario exploration requires a question or scenarioIds");
  if (query.kind === "compare_scenarios" && (query.scenarioIds?.length ?? 0) < 2) errors.push("scenario comparison requires at least two scenarioIds");
  if (query.kind === "trace_evidence" && !(query.evidenceIds?.length || query.scenarioIds?.length)) errors.push("evidence tracing requires evidenceIds or scenarioIds");
  return errors;
}

export function createCoachResponse(input: Omit<CoachResponse, "humanDecisionRequired">): CoachResponse {
  return { ...input, humanDecisionRequired: true };
}
