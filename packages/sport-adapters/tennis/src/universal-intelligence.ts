import type { EvidenceRef } from "@coaching-ai/sports-core";
import {
  buildCoachingPolicyEvaluation,
  type CoachingEstimate,
  type CoachingPolicyEvaluation,
} from "@coaching-ai/sports-core/coaching-intelligence";
import {
  buildEvidenceGraph,
  type EvidenceGraph,
  type EvidenceGraphEdge,
  type EvidenceGraphNode,
} from "@coaching-ai/sports-core/evidence-graph";
import type { TennisPlayerProfile, TennisFeatureEstimate } from "./player-intelligence";
import type { TennisMatchupModel } from "./matchup-intelligence";
import type { TennisTacticalScenario } from "./tactical-scenarios";
import type { TennisEpistemicAssessment } from "./epistemic-awareness";

export interface TennisUniversalIntelligenceInput {
  profiles: TennisPlayerProfile[];
  matchup?: TennisMatchupModel;
  scenarios?: TennisTacticalScenario[];
  epistemic?: TennisEpistemicAssessment;
  stateSignature: string;
}

export interface TennisUniversalIntelligenceResult {
  estimates: CoachingEstimate[];
  policyEvaluations: CoachingPolicyEvaluation[];
  evidenceGraph: EvidenceGraph;
  unresolvedQuestions: string[];
  uncertainty: number;
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

function estimate(estimateId: string, feature: TennisFeatureEstimate, evidenceRefs: EvidenceRef[]): CoachingEstimate {
  return {
    estimateId,
    value: clamp(feature.value),
    lowerBound: clamp(feature.value - feature.uncertainty),
    upperBound: clamp(feature.value + feature.uncertainty),
    uncertainty: clamp(feature.uncertainty),
    sampleSize: Math.max(0, feature.sampleSize),
    level: "player",
    evidenceRefs,
  };
}

function node(nodeId: string, type: EvidenceGraphNode["type"], label: string, confidence: number, uncertainty: number, evidenceRefs: EvidenceRef[]): EvidenceGraphNode {
  return { nodeId, type, label, confidence: clamp(confidence), uncertainty: clamp(uncertainty), evidenceRefs };
}

function edge(edgeId: string, fromNodeId: string, toNodeId: string, relation: EvidenceGraphEdge["relation"], strength: number, evidenceRefs: EvidenceRef[]): EvidenceGraphEdge {
  return { edgeId, fromNodeId, toNodeId, relation, strength: clamp(strength), evidenceRefs };
}

function profileEstimates(profile: TennisPlayerProfile): CoachingEstimate[] {
  const groups: Array<[string, TennisFeatureEstimate]> = [
    ["serve.first_serve_rate", profile.serve.firstServeRate],
    ["serve.ace_rate", profile.serve.aceRate],
    ["serve.double_fault_rate", profile.serve.doubleFaultRate],
    ["serve.winner_rate", profile.serve.serveWinnerRate],
    ["return.point_win_rate", profile.return.returnPointWinRate],
    ["return.deep_rate", profile.return.returnDepth],
    ["return.aggression_rate", profile.return.returnAggression],
    ["rally.average_length", profile.rally.averageLength],
    ["rally.long_share", profile.rally.longRallyShare],
    ["rally.winner_rate", profile.rally.winnerRate],
    ["rally.error_rate", profile.rally.errorRate],
    ["court.net_rate", profile.courtPosition.netRate],
    ["court.transition_rate", profile.courtPosition.transitionRate],
    ["court.baseline_rate", profile.courtPosition.baselineRate],
  ];
  if (profile.pressure.breakPointWinRate) groups.push(["pressure.break_point_win_rate", profile.pressure.breakPointWinRate]);
  if (profile.pressure.tiebreakPointWinRate) groups.push(["pressure.tiebreak_point_win_rate", profile.pressure.tiebreakPointWinRate]);
  return groups.map(([key, feature]) => estimate(`tennis:${profile.playerId}:${key}`, feature, profile.evidenceRefs));
}

export function buildTennisUniversalIntelligence(input: TennisUniversalIntelligenceInput): TennisUniversalIntelligenceResult {
  const estimates = input.profiles.flatMap(profileEstimates);
  const policyEvaluations = (input.scenarios ?? []).map((scenario) =>
    buildCoachingPolicyEvaluation({
      policyId: scenario.scenarioId,
      stateSignature: input.stateSignature,
      interventionType: scenario.intervention.type,
      objectiveScores: {
        evidenceCoverage: scenario.evidenceRefs.length ? 1 : 0,
        responseSupport: scenario.opponentResponses.length ? 1 : 0,
        counterPathSupport: scenario.counterPaths.length ? 1 : 0,
      },
      uncertainty: clamp(
        scenario.matchupContext.serveReturnEdge.uncertainty +
        (scenario.opponentResponses.reduce((sum, response) => sum + response.uncertainty, 0) / Math.max(1, scenario.opponentResponses.length)) * 0.5,
      ),
      evidenceRefs: scenario.evidenceRefs,
    }),
  );

  const nodes: EvidenceGraphNode[] = [];
  const edges: EvidenceGraphEdge[] = [];

  for (const estimateItem of estimates) {
    const observationId = `${estimateItem.estimateId}:evidence`;
    nodes.push(
      node(observationId, "observation", `Evidence for ${estimateItem.estimateId}`, estimateItem.evidenceRefs.length ? 1 : 0, estimateItem.evidenceRefs.length ? 0 : 1, estimateItem.evidenceRefs),
      node(estimateItem.estimateId, "inference", estimateItem.estimateId, 1 - estimateItem.uncertainty, estimateItem.uncertainty, estimateItem.evidenceRefs),
    );
    edges.push(edge(`${observationId}->${estimateItem.estimateId}`, observationId, estimateItem.estimateId, "derived_from", 1 - estimateItem.uncertainty, estimateItem.evidenceRefs));
  }

  if (input.matchup) {
    const matchupId = `tennis:matchup:${input.matchup.serverParticipantId}:${input.matchup.receiverParticipantId}`;
    nodes.push(node(matchupId, "inference", "Tennis matchup model", 1 - input.matchup.serveReturnEdge.uncertainty, input.matchup.serveReturnEdge.uncertainty, input.matchup.evidenceRefs));
    for (const profile of input.profiles) {
      const related = estimates.filter((item) => item.estimateId.startsWith(`tennis:${profile.playerId}:`));
      for (const item of related) {
        edges.push(edge(`${item.estimateId}->${matchupId}`, item.estimateId, matchupId, "supports", 1 - item.uncertainty, profile.evidenceRefs));
      }
    }
  }

  for (const scenario of input.scenarios ?? []) {
    const scenarioId = `scenario:${scenario.scenarioId}`;
    nodes.push(node(scenarioId, "scenario", scenario.intervention.objective, scenario.evidenceRefs.length ? 0.6 : 0, scenario.evidenceRefs.length ? 0.4 : 1, scenario.evidenceRefs));
    for (const response of scenario.opponentResponses) {
      const responseId = `${scenarioId}:response:${response.responseId}`;
      nodes.push(node(responseId, "hypothesis", response.rationale, 1 - response.uncertainty, response.uncertainty, response.evidenceRefs));
      edges.push(edge(`${scenarioId}->${responseId}`, scenarioId, responseId, "requires", clamp(response.relativeWeight / 1.0), response.evidenceRefs));
    }
    const evaluation = policyEvaluations.find((item) => item.policyId === scenario.scenarioId);
    if (evaluation) {
      const evaluationId = `evaluation:${scenario.scenarioId}`;
      nodes.push(node(evaluationId, "evaluation", `Evaluation of ${scenario.intervention.type}`, 1 - evaluation.uncertainty, evaluation.uncertainty, evaluation.evidenceRefs));
      edges.push(edge(`${scenarioId}->${evaluationId}`, scenarioId, evaluationId, "evaluates", 1 - evaluation.uncertainty, evaluation.evidenceRefs));
    }
  }

  const unknowns = input.epistemic?.unknowns ?? [];
  for (const unknown of unknowns) nodes.push(node(unknown.id, "unknown", unknown.statement, 0, 1, unknown.evidenceRefs));

  const evidenceGraph = buildEvidenceGraph({
    graphId: `tennis-universal:${input.stateSignature}`,
    nodes,
    edges,
    engineVersion: "tennis-universal-intelligence-v1",
  });

  return {
    estimates,
    policyEvaluations,
    evidenceGraph,
    unresolvedQuestions: unknowns.map((item) => item.statement),
    uncertainty: clamp((input.epistemic?.uncertainty ?? 0) * 0.5 + evidenceGraph.uncertainty * 0.5),
  };
}
