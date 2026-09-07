import type { EvidenceRef, GameState, SportCode } from "./index";
import type { CoachExplanationReadModel } from "./coach-explanation";
import type { ScenarioExplorationResult, ScenarioExplorationService, ScenarioExplorationRequest } from "./scenario-exploration";
import { buildCoachExplorationReceipt, type CoachExplorationReceipt } from "./coach-exploration-receipt";

export type CoachQueryKind = "explain_state" | "trace_evidence" | "explore_scenario" | "compare_scenarios" | "review_outcome" | "identify_unknowns";
export interface CoachQuery { queryId: string; kind: CoachQueryKind; sport: SportCode; stateSignature: string; gameState?: GameState; scenarioIds?: string[]; evidenceIds?: string[]; question?: string; requestedAt?: string; }
export type CoachResponseKind = "explanation" | "evidence_trace" | "scenario_set" | "outcome_review" | "unknowns";
export interface CoachResponse { queryId: string; kind: CoachResponseKind; stateSignature: string; explanation?: CoachExplanationReadModel; scenarioExploration?: ScenarioExplorationResult; explorationReceipt?: CoachExplorationReceipt; evidenceRefs: EvidenceRef[]; humanDecisionRequired: true; generatedAt?: string; }
export interface CoachCommandBoundary { handle(query: CoachQuery): Promise<CoachResponse>; }
export interface ScenarioExplorationCommandBoundary extends CoachCommandBoundary { scenarioExplorationService: ScenarioExplorationService; }

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

export function createCoachResponse(input: Omit<CoachResponse, "humanDecisionRequired">): CoachResponse { return { ...input, humanDecisionRequired: true }; }

export function createScenarioExplorationCommandBoundary(service: ScenarioExplorationService): ScenarioExplorationCommandBoundary {
  return {
    scenarioExplorationService: service,
    async handle(query: CoachQuery): Promise<CoachResponse> {
      const errors = validateCoachQuery(query);
      if (errors.length) throw new Error(`Invalid coach query: ${errors.join("; ")}`);
      if (!query.gameState) throw new Error("gameState is required for scenario exploration");
      if (query.kind !== "explore_scenario" && query.kind !== "compare_scenarios") throw new Error(`Scenario exploration boundary does not handle query kind: ${query.kind}`);
      const request: ScenarioExplorationRequest = {
        explorationId: query.queryId,
        sport: query.sport,
        stateSignature: query.stateSignature,
        state: query.gameState,
        candidates: (query.scenarioIds ?? []).map((scenarioId) => ({ scenarioId, title: scenarioId, intervention: query.question?.trim() || "coach-requested scenario exploration", assumptions: [], evidenceRefs: query.gameState?.evidenceRefs ?? [] })),
      };
      const result = await service.explore(request);
      const explorationReceipt = buildCoachExplorationReceipt(request, result);
      const evidenceRefs = [...result.simulations.flatMap((simulation) => simulation.evidenceRefs), ...result.evaluations.flatMap((evaluation) => evaluation.dimensions.flatMap((dimension) => dimension.evidenceRefs))];
      const deduped = [...new Map(evidenceRefs.map((ref) => [ref.evidenceId, ref])).values()];
      return createCoachResponse({ queryId: query.queryId, kind: "scenario_set", stateSignature: query.stateSignature, scenarioExploration: result, explorationReceipt, evidenceRefs: deduped });
    },
  };
}
