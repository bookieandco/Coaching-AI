import type { EvidenceRef } from "@coaching-ai/sports-core";

export interface BoxingResponseCandidate {
  responseId: string;
  fighterId: string;
  responseType: string;
  probability: number;
  expectedEffect: string;
  uncertainty: number;
  evidenceRefs: EvidenceRef[];
}

export interface BoxingCounterCandidate {
  counterId: string;
  responseId: string;
  fighterId: string;
  counterType: string;
  plausibility: number;
  rationale: string;
  uncertainty: number;
  evidenceRefs: EvidenceRef[];
}

export interface BoxingResponseChain {
  responses: BoxingResponseCandidate[];
  counters: BoxingCounterCandidate[];
  modelVersion: string;
  evidenceRefs: EvidenceRef[];
}
