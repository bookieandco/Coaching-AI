import type { EvidenceRef, GameState } from "@coaching-ai/sports-core";
import type { BoxingIntervention } from "./tactical-scenarios";
import type { BoxingResponseCandidate, BoxingCounterCandidate, BoxingResponseChain } from "./opponent-response";

export interface BoxingStateDelta {
  path: string;
  before: unknown;
  after: unknown;
  rationale: string;
  confidence: number;
}

export interface BoxingCounterfactualState {
  scenarioId: string;
  parentStateVersion: number;
  hypotheticalStateVersion: number;
  state: GameState;
  intervention: BoxingIntervention;
  opponentResponse: BoxingResponseCandidate;
  counter?: BoxingCounterCandidate;
  deltas: BoxingStateDelta[];
  assumptions: string[];
  uncertainty: number;
  evidenceRefs: EvidenceRef[];
  provenance: {
    engineVersion: string;
    sourceStateVersion: number;
    responseModelVersion: string;
  };
}

/**
 * Applies one explicit intervention/response/counter branch to the canonical
 * GameState. This creates a hypothetical state only; it does not simulate time
 * or claim that the branch will occur.
 */
export function buildCounterfactualState(
  state: GameState,
  scenarioId: string,
  intervention: BoxingIntervention,
  response: BoxingResponseCandidate,
  counter?: BoxingCounterCandidate,
  chain?: BoxingResponseChain,
  engineVersion = "boxing-counterfactual-v1",
): BoxingCounterfactualState {
  const attributes = { ...state.attributes };
  const deltas: BoxingStateDelta[] = [];

  applyIntervention(attributes, intervention, deltas);
  applyOpponentResponse(attributes, response, deltas);
  if (counter) applyCounter(attributes, counter, deltas);

  const stateVersion = state.stateVersion + 1;
  const hypotheticalState: GameState = {
    ...state,
    attributes,
    stateVersion,
  };

  const evidenceRefs = dedupeEvidence([
    ...intervention.evidenceRefs,
    ...response.evidenceRefs,
    ...(counter?.evidenceRefs ?? []),
  ]);

  return {
    scenarioId,
    parentStateVersion: state.stateVersion,
    hypotheticalStateVersion: stateVersion,
    state: hypotheticalState,
    intervention,
    opponentResponse: response,
    counter,
    deltas,
    assumptions: [
      "The intervention is treated as successfully executed.",
      "The selected opponent response is a plausible branch, not a forecast certainty.",
      ...(counter ? ["The selected counter is treated as an explicit hypothetical branch."] : []),
    ],
    uncertainty: aggregateUncertainty(intervention, response, counter),
    evidenceRefs,
    provenance: {
      engineVersion,
      sourceStateVersion: state.stateVersion,
      responseModelVersion: chain?.modelVersion ?? "unknown",
    },
  };
}

function applyIntervention(
  attributes: Record<string, unknown>,
  intervention: BoxingIntervention,
  deltas: BoxingStateDelta[],
): void {
  const modes = { ...(attributes.tacticalMode as Record<string, string> | undefined) };
  const before = modes[intervention.fighterId];
  modes[intervention.fighterId] = intervention.type;
  attributes.tacticalMode = modes;
  deltas.push({
    path: `attributes.tacticalMode.${intervention.fighterId}`,
    before,
    after: intervention.type,
    rationale: `Hypothetically applies intervention ${intervention.type}.`,
    confidence: Math.max(0, Math.min(1, intervention.intensity)),
  });
}

function applyOpponentResponse(
  attributes: Record<string, unknown>,
  response: BoxingResponseCandidate,
  deltas: BoxingStateDelta[],
): void {
  const modes = { ...(attributes.tacticalMode as Record<string, string> | undefined) };
  const before = modes[response.fighterId];
  modes[response.fighterId] = response.responseType;
  attributes.tacticalMode = modes;
  deltas.push({
    path: `attributes.tacticalMode.${response.fighterId}`,
    before,
    after: response.responseType,
    rationale: response.expectedEffect,
    confidence: response.probability,
  });
}

function applyCounter(
  attributes: Record<string, unknown>,
  counter: BoxingCounterCandidate,
  deltas: BoxingStateDelta[],
): void {
  const modes = { ...(attributes.tacticalMode as Record<string, string> | undefined) };
  const before = modes[counter.fighterId];
  modes[counter.fighterId] = counter.counterType;
  attributes.tacticalMode = modes;
  deltas.push({
    path: `attributes.tacticalMode.${counter.fighterId}`,
    before,
    after: counter.counterType,
    rationale: counter.rationale,
    confidence: counter.plausibility,
  });
}

function aggregateUncertainty(
  intervention: BoxingIntervention,
  response: BoxingResponseCandidate,
  counter?: BoxingCounterCandidate,
): number {
  const interventionUncertainty = 1 - Math.max(0, Math.min(1, intervention.intensity));
  const values = [
    interventionUncertainty,
    response.uncertainty,
    ...(counter ? [counter.uncertainty] : []),
  ];
  return Math.min(1, values.reduce((sum, value) => sum + value, 0) / values.length);
}

function dedupeEvidence(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = JSON.stringify(ref);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
