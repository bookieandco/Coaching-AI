import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { TennisTacticalScenario } from "./tactical-scenarios";

export type TennisScenarioObjective = "win_path_support" | "failure_avoidance" | "robustness" | "evidence_strength" | "tactical_diversity";
export interface TennisScenarioSearchConfig { populationSize: number; eliteCount: number; diversityFloor: number; maxGenerations: number; simulationCount: number; maxSteps: number; seed: number; modelVersion?: string; }
export interface TennisScenarioScore { objective: TennisScenarioObjective; value: number; uncertainty: number; evidenceRefs: EvidenceRef[]; }
export interface TennisScenarioRepair { repaired: boolean; reasons: string[]; }
export interface TennisScenarioCandidate { scenario: TennisTacticalScenario; scores: TennisScenarioScore[]; valid: boolean; repair: TennisScenarioRepair; generation: number; }
export interface TennisScenarioPopulation { generation: number; candidates: TennisScenarioCandidate[]; eliteScenarioIds: string[]; diversityScore: number; }
export interface TennisScenarioSearchResult { population: TennisScenarioPopulation; frontier: TennisScenarioCandidate[]; elite: TennisScenarioCandidate[]; }
export const TENNIS_SCENARIO_SEARCH_ENGINE = "tennis-adaptive-scenario-search-v1";
export const TENNIS_SCENARIO_OBJECTIVES: TennisScenarioObjective[] = ["win_path_support","failure_avoidance","robustness","evidence_strength","tactical_diversity"];

const score=(c:TennisScenarioCandidate,o:TennisScenarioObjective)=>c.scores.find(s=>s.objective===o)?.value??0;
const dominates=(a:TennisScenarioCandidate,b:TennisScenarioCandidate)=>{let strict=false;for(const o of TENNIS_SCENARIO_OBJECTIVES){const x=score(a,o),y=score(b,o);if(x<y)return false;if(x>y)strict=true;}return strict;};
export function paretoFront(cs:TennisScenarioCandidate[]):TennisScenarioCandidate[]{return cs.filter((c,i)=>cs.every((o,j)=>i===j||!dominates(o,c)));}
export function scenarioSignature(c:TennisScenarioCandidate):string{return `${c.scenario.intervention.type}|${c.scenario.opponentResponses.map(r=>r.type).sort().join(",")}|${c.scenario.counterPaths.map(r=>r.type).sort().join(",")}`;}
export function repairTennisScenario(s:TennisTacticalScenario):TennisScenarioRepair{const reasons:string[]=[];if(!Number.isInteger(s.sourceStateVersion)||s.sourceStateVersion<0)reasons.push("invalid_source_state_version");if(!s.intervention.actorParticipantId)reasons.push("missing_intervention_actor");if(!s.opponentResponses.length)reasons.push("missing_opponent_responses");const ids=new Set(s.opponentResponses.map(r=>r.responseId));if(s.counterPaths.some(c=>!ids.has(c.responseId)))reasons.push("orphan_counter_path");if(s.opponentResponses.some(r=>!Number.isFinite(r.relativeWeight)||r.relativeWeight<=0))reasons.push("invalid_response_weight");return{repaired:reasons.length>0,reasons};}
export function preserveElite(cs:TennisScenarioCandidate[],n:number):TennisScenarioCandidate[]{return paretoFront(cs.filter(c=>c.valid)).sort((a,b)=>a.scenario.scenarioId.localeCompare(b.scenario.scenarioId)).slice(0,Math.max(1,n));}
export function injectScenarioDiversity(cs:TennisScenarioCandidate[],config:TennisScenarioSearchConfig):TennisScenarioCandidate[]{const out:TennisScenarioCandidate[]=[];const seen=new Set<string>();for(const c of cs){const sig=scenarioSignature(c);if(seen.has(sig))continue;out.push(c);seen.add(sig);if(out.length>=Math.max(1,config.populationSize))break;}return out;}
export function describeTennisScenarioSearch():TennisScenarioSearchResult{return{population:{generation:0,candidates:[],eliteScenarioIds:[],diversityScore:0},frontier:[],elite:[]};}
