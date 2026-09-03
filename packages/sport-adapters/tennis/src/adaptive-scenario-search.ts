import type { EvidenceRef } from "@coaching-ai/sports-core";
import type { TennisMatchState } from "./index";
import type { TennisMatchupModel } from "./matchup-intelligence";
import { generateTennisTacticalScenarios, type TennisTacticalScenario, type TennisOpponentResponse } from "./tactical-scenarios";
import { buildTennisCounterfactualState } from "./counterfactual";
import { simulateTennisScenario, type TennisSimulationConfig, type TennisSimulationResult } from "./simulation-kernel";
import { buildTennisWinPathReport, type TennisWinPathReport } from "./win-path-engine";
import type { TennisAdaptiveState } from "./adaptive-opponent";

export type TennisScenarioObjective = "win_path_support" | "failure_avoidance" | "robustness" | "evidence_strength" | "tactical_diversity";
export interface TennisScenarioSearchConfig { populationSize:number; eliteCount:number; diversityFloor:number; maxGenerations:number; simulationCount:number; maxSteps:number; seed:number; modelVersion?:string; }
export interface TennisScenarioScore { objective:TennisScenarioObjective; value:number; uncertainty:number; evidenceRefs:EvidenceRef[]; }
export interface TennisScenarioRepair { repaired:boolean; reasons:string[]; }
export interface TennisScenarioCandidate { scenario:TennisTacticalScenario; scores:TennisScenarioScore[]; valid:boolean; repair:TennisScenarioRepair; generation:number; simulation?:TennisSimulationResult; winPathReport?:TennisWinPathReport; }
export interface TennisScenarioPopulation { generation:number; candidates:TennisScenarioCandidate[]; eliteScenarioIds:string[]; diversityScore:number; }
export interface TennisScenarioSearchInput { state:TennisMatchState; matchup:TennisMatchupModel; adaptiveState?:TennisAdaptiveState; }
export interface TennisScenarioSearchResult { population:TennisScenarioPopulation; frontier:TennisScenarioCandidate[]; elite:TennisScenarioCandidate[]; provenance:{engineVersion:string;seed:number;modelVersion:string;generationCount:number;simulationCount:number;maxSteps:number;evidenceRefs:EvidenceRef[]}; }

export const TENNIS_SCENARIO_SEARCH_ENGINE="tennis-adaptive-scenario-search-v3";
export const TENNIS_SCENARIO_OBJECTIVES:TennisScenarioObjective[]=["win_path_support","failure_avoidance","robustness","evidence_strength","tactical_diversity"];
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const score=(c:TennisScenarioCandidate,o:TennisScenarioObjective)=>c.scores.find(s=>s.objective===o)?.value??0;
const dominates=(a:TennisScenarioCandidate,b:TennisScenarioCandidate)=>{let strict=false;for(const o of TENNIS_SCENARIO_OBJECTIVES){const x=score(a,o),y=score(b,o);if(x<y)return false;if(x>y)strict=true;}return strict;};
export function paretoFront(cs:TennisScenarioCandidate[]):TennisScenarioCandidate[]{return cs.filter((c,i)=>cs.every((o,j)=>i===j||!dominates(o,c)));}
export function scenarioSignature(c:TennisScenarioCandidate):string{return `${c.scenario.intervention.type}|${c.scenario.opponentResponses.map(r=>r.type).sort().join(",")}|${c.scenario.counterPaths.map(r=>r.type).sort().join(",")}`;}
export function repairTennisScenario(s:TennisTacticalScenario):TennisScenarioRepair{const reasons:string[]=[];if(!Number.isInteger(s.sourceStateVersion)||s.sourceStateVersion<0)reasons.push("invalid_source_state_version");if(!s.intervention.actorParticipantId)reasons.push("missing_intervention_actor");if(!s.opponentResponses.length)reasons.push("missing_opponent_responses");const ids=new Set(s.opponentResponses.map(r=>r.responseId));if(s.counterPaths.some(c=>!ids.has(c.responseId)))reasons.push("orphan_counter_path");if(s.opponentResponses.some(r=>!Number.isFinite(r.relativeWeight)||r.relativeWeight<=0))reasons.push("invalid_response_weight");return{repaired:reasons.length>0,reasons};}
export function preserveElite(cs:TennisScenarioCandidate[],n:number):TennisScenarioCandidate[]{return paretoFront(cs.filter(c=>c.valid)).sort((a,b)=>a.scenario.scenarioId.localeCompare(b.scenario.scenarioId)).slice(0,Math.max(1,n));}
export function injectScenarioDiversity(cs:TennisScenarioCandidate[],config:TennisScenarioSearchConfig):TennisScenarioCandidate[]{const out:TennisScenarioCandidate[]=[];const seen=new Set<string>();for(const c of cs){const sig=scenarioSignature(c);if(seen.has(sig))continue;out.push(c);seen.add(sig);if(out.length>=Math.max(1,config.populationSize))break;}return out;}
const uniqueRefs=(refs:EvidenceRef[])=>{const seen=new Set<string>();return refs.filter(r=>{if(seen.has(r.evidenceId))return false;seen.add(r.evidenceId);return true;});};

function candidateFromScenario(s:TennisTacticalScenario,input:TennisScenarioSearchInput,config:TennisScenarioSearchConfig,generation:number,signatureCount:number):TennisScenarioCandidate{
 const repair=repairTennisScenario(s);if(repair.reasons.length)return{scenario:s,scores:[],valid:false,repair,generation};
 const cf=buildTennisCounterfactualState({state:input.state,scenarioId:s.scenarioId,intervention:s.intervention,engineVersion:"tennis-counterfactual-v1"});
 const simConfig:TennisSimulationConfig={simulationCount:Math.max(0,Math.floor(config.simulationCount)),maxSteps:Math.max(1,Math.floor(config.maxSteps)),seed:(config.seed+generation*1009+s.scenarioId.length)|0,modelVersion:config.modelVersion};
 const simulation=simulateTennisScenario(cf,s,simConfig);const winPathReport=buildTennisWinPathReport(s,simulation);const refs=uniqueRefs([...s.evidenceRefs,...winPathReport.provenance.evidenceRefs]);
 const win=clamp(winPathReport.coverage.winPathCoverage),fail=clamp(1-winPathReport.coverage.failurePathCoverage);const wins=winPathReport.paths.filter(p=>p.classification==="win_path");const robustness=wins.length?clamp(wins.reduce((a,p)=>a+p.robustness,0)/wins.length):0;const evidence=clamp(refs.length/10);const diversity=clamp(1/Math.max(1,signatureCount));const uncertainty=clamp(winPathReport.uncertainty);
 const mk=(objective:TennisScenarioObjective,value:number):TennisScenarioScore=>({objective,value,uncertainty,evidenceRefs:refs});
 return{scenario:s,scores:[mk("win_path_support",win),mk("failure_avoidance",fail),mk("robustness",robustness),mk("evidence_strength",evidence),mk("tactical_diversity",diversity)],valid:true,repair,generation,simulation,winPathReport};
}

/** B-30 constrained variation: only existing response weights are perturbed. No new evidence or player/opponent facts are invented. */
export function varyTennisScenario(parent:TennisScenarioCandidate,variant:number,generation:number):TennisTacticalScenario{
 const factor=variant%2===0?1.15:0.87;const scenarioId=`${parent.scenario.scenarioId}:g${generation}:v${variant+1}`;const intervention={...parent.scenario.intervention,interventionId:`${scenarioId}:intervention`};
 const responses:TennisOpponentResponse[]=parent.scenario.opponentResponses.map((r,i)=>({...r,responseId:`${intervention.interventionId}:response:${r.type}`,relativeWeight:clamp(Math.max(0.05,Math.min(4,r.relativeWeight*(i===variant%Math.max(1,parent.scenario.opponentResponses.length)?factor:1/factor))))*4}));
 const responseIds=new Set(responses.map(r=>r.responseId));const counters=parent.scenario.counterPaths.map(c=>({...c,counterId:`${intervention.interventionId}:counter:${c.type}`,responseId:`${intervention.interventionId}:response:${c.responseId.split(":").pop()}`})).filter(c=>responseIds.has(c.responseId));
 return{...parent.scenario,scenarioId,intervention,opponentResponses:responses,counterPaths:counters,provenance:{...parent.scenario.provenance,engineVersion:"tennis-tactical-scenarios-v3"}};
}
function evaluateGeneration(s:TennisTacticalScenario[],input:TennisScenarioSearchInput,config:TennisScenarioSearchConfig,generation:number){const ordered=[...s].sort((a,b)=>a.scenarioId.localeCompare(b.scenarioId));return ordered.map(x=>candidateFromScenario(x,input,config,generation,ordered.length)).filter(c=>c.valid);}

/** B-30 adaptive loop: evaluate -> Pareto/elite -> constrained variation -> re-evaluate. */
export function searchTennisScenarioPopulation(input:TennisScenarioSearchInput,config:TennisScenarioSearchConfig):TennisScenarioSearchResult{
 const generations=Math.max(1,Math.floor(config.maxGenerations));const populationSize=Math.max(1,Math.floor(config.populationSize));let current=generateTennisTacticalScenarios(input.state,input.matchup,input.adaptiveState);let finalPopulation:TennisScenarioCandidate[]=[];
 for(let generation=0;generation<generations;generation+=1){const evaluated=evaluateGeneration(current,input,config,generation);const elite=preserveElite(evaluated,Math.min(config.eliteCount,populationSize));const diverse=injectScenarioDiversity(evaluated,{...config,populationSize});finalPopulation=injectScenarioDiversity([...elite,...diverse],{...config,populationSize});if(generation===generations-1)break;const variants:TennisTacticalScenario[]=[];for(const parent of finalPopulation)for(let v=0;v<2;v+=1)variants.push(varyTennisScenario(parent,v,generation+1));const unique=new Map<string,TennisTacticalScenario>();for(const s of variants)unique.set(s.scenarioId,s);current=[...unique.values()].slice(0,Math.max(populationSize*2,populationSize));}
 const frontier=paretoFront(finalPopulation).sort((a,b)=>a.scenario.scenarioId.localeCompare(b.scenario.scenarioId));const elite=preserveElite(finalPopulation,Math.min(config.eliteCount,finalPopulation.length));const signatures=new Set(finalPopulation.map(scenarioSignature));const refs=uniqueRefs([...input.state.evidenceRefs,...input.matchup.evidenceRefs,...finalPopulation.flatMap(c=>c.scenario.evidenceRefs)]);
 return{population:{generation:Math.max(0,generations-1),candidates:finalPopulation,eliteScenarioIds:elite.map(c=>c.scenario.scenarioId),diversityScore:finalPopulation.length?clamp(signatures.size/finalPopulation.length):0},frontier,elite,provenance:{engineVersion:TENNIS_SCENARIO_SEARCH_ENGINE,seed:config.seed,modelVersion:config.modelVersion??"tennis-scenario-search-model-v2",generationCount:generations,simulationCount:Math.max(0,Math.floor(config.simulationCount)),maxSteps:Math.max(1,Math.floor(config.maxSteps)),evidenceRefs:refs}};
}
export function describeTennisScenarioSearch():TennisScenarioSearchResult{return{population:{generation:0,candidates:[],eliteScenarioIds:[],diversityScore:0},frontier:[],elite:[],provenance:{engineVersion:TENNIS_SCENARIO_SEARCH_ENGINE,seed:0,modelVersion:"tennis-scenario-search-model-v2",generationCount:0,simulationCount:0,maxSteps:0,evidenceRefs:[]}};}
