import type { EvidenceId, GameState, SportCode } from "./index";
import type { ScenarioExplorationRequest, ScenarioExplorationResult } from "./scenario-exploration";

export interface CoachExplorationReceipt {
  receiptId: string;
  queryId: string;
  explorationId: string;
  sport: SportCode;
  gameId: string;
  stateSignature: string;
  stateVersion: number;
  rulesetVersion: string;
  scenarioIds: string[];
  paretoScenarioIds: string[];
  simulationSeeds: number[];
  simulationBudget?: number;
  evaluatorVersion: string;
  serviceVersion: string;
  evidenceIds: EvidenceId[];
  deterministicKey: string;
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function sortedUniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

export function buildCoachExplorationReceipt(
  request: ScenarioExplorationRequest,
  result: ScenarioExplorationResult,
  receiptId = `${request.explorationId}:receipt`,
): CoachExplorationReceipt {
  const scenarioIds = sortedUnique([
    ...request.candidates.map((candidate) => candidate.scenarioId),
    ...result.simulations.map((simulation) => simulation.scenarioId),
    ...result.evaluations.map((evaluation) => evaluation.scenarioId),
  ]);
  const paretoScenarioIds = sortedUnique(result.paretoScenarioIds);
  const simulationSeeds = sortedUniqueNumbers(result.provenance.seeds);
  const evidenceIds = sortedUnique([
    ...request.state.evidenceRefs.map((ref) => ref.evidenceId),
    ...request.candidates.flatMap((candidate) => candidate.evidenceRefs.map((ref) => ref.evidenceId)),
    ...result.simulations.flatMap((simulation) => simulation.evidenceRefs.map((ref) => ref.evidenceId)),
    ...result.evaluations.flatMap((evaluation) => evaluation.dimensions.flatMap((dimension) => dimension.evidenceRefs.map((ref) => ref.evidenceId))),
  ]) as EvidenceId[];
  const evaluatorVersion = "scenario-evaluation-v1";
  const canonical = [
    `sport=${request.sport}`,
    `gameId=${request.state.gameId}`,
    `stateSignature=${request.stateSignature}`,
    `stateVersion=${request.state.stateVersion}`,
    `rulesetVersion=${request.state.rulesetVersion}`,
    `serviceVersion=${result.provenance.serviceVersion}`,
    `evaluatorVersion=${evaluatorVersion}`,
    `scenarioIds=${scenarioIds.join(",")}`,
    `paretoScenarioIds=${paretoScenarioIds.join(",")}`,
    `simulationSeeds=${simulationSeeds.join(",")}`,
    `simulationBudget=${request.simulationBudget ?? ""}`,
    `evidenceIds=${evidenceIds.join(",")}`,
  ].join("|");

  return {
    receiptId,
    queryId: request.explorationId,
    explorationId: result.explorationId,
    sport: request.sport,
    gameId: request.state.gameId,
    stateSignature: request.stateSignature,
    stateVersion: request.state.stateVersion,
    rulesetVersion: request.state.rulesetVersion,
    scenarioIds,
    paretoScenarioIds,
    simulationSeeds,
    simulationBudget: request.simulationBudget,
    evaluatorVersion,
    serviceVersion: result.provenance.serviceVersion,
    evidenceIds,
    deterministicKey: canonical,
  };
}

export function validateCoachExplorationReceipt(
  receipt: CoachExplorationReceipt,
  request: ScenarioExplorationRequest,
  result: ScenarioExplorationResult,
): string[] {
  const expected = buildCoachExplorationReceipt(request, result, receipt.receiptId);
  const errors: string[] = [];
  if (receipt.queryId !== expected.queryId) errors.push("queryId does not match exploration");
  if (receipt.explorationId !== expected.explorationId) errors.push("explorationId does not match result");
  if (receipt.sport !== expected.sport) errors.push("sport does not match request");
  if (receipt.gameId !== expected.gameId) errors.push("gameId does not match state");
  if (receipt.stateSignature !== expected.stateSignature) errors.push("stateSignature does not match request");
  if (receipt.stateVersion !== expected.stateVersion) errors.push("stateVersion does not match state");
  if (receipt.rulesetVersion !== expected.rulesetVersion) errors.push("rulesetVersion does not match state");
  if (receipt.deterministicKey !== expected.deterministicKey) errors.push("deterministicKey does not match exploration inputs");
  return errors;
}

export function buildCoachExplorationRequestStateSignature(state: GameState): string {
  return `${state.gameId}@${state.stateVersion}:${state.rulesetVersion}`;
}
