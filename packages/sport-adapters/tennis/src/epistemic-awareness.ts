import type { EvidenceRef } from "@coaching-ai/sports-core";

export type TennisEpistemicLabel = "OBSERVED" | "INFERRED" | "HYPOTHESIS" | "SIMULATED" | "UNKNOWN";

export interface TennisEpistemicItem {
  id: string;
  label: TennisEpistemicLabel;
  statement: string;
  confidence: number;
  evidenceRefs: EvidenceRef[];
  basis?: string;
}

export interface TennisEpistemicAssessment {
  observed: TennisEpistemicItem[];
  inferred: TennisEpistemicItem[];
  hypotheses: TennisEpistemicItem[];
  simulated: TennisEpistemicItem[];
  unknowns: TennisEpistemicItem[];
  evidenceCoverage: number;
  uncertainty: number;
  provenance: { engineVersion: string; evidenceRefs: EvidenceRef[] };
}

export interface TennisEpistemicInput {
  observed?: TennisEpistemicItem[];
  inferred?: TennisEpistemicItem[];
  hypotheses?: TennisEpistemicItem[];
  simulated?: TennisEpistemicItem[];
  requiredEvidenceIds?: string[];
}

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const unique=(items:TennisEpistemicItem[])=>{const seen=new Set<string>();return items.filter(i=>{if(seen.has(i.id))return false;seen.add(i.id);return true;});};

/**
 * Keeps epistemic states explicit. Missing evidence becomes UNKNOWN rather than
 * being silently promoted into an inference or prediction.
 */
export function assessTennisEpistemicState(input:TennisEpistemicInput={}):TennisEpistemicAssessment{
 const observed=unique(input.observed??[]), inferred=unique(input.inferred??[]), hypotheses=unique(input.hypotheses??[]), simulated=unique(input.simulated??[]);
 const evidenceIds=new Set(observed.flatMap(i=>i.evidenceRefs.map(r=>r.evidenceId)));
 const required=input.requiredEvidenceIds??[];
 const covered=required.length?required.filter(id=>evidenceIds.has(id)).length/required.length:(observed.length?1:0);
 const missing=required.filter(id=>!evidenceIds.has(id));
 const unknowns:TennisEpistemicItem[]=missing.map(id=>({id:`unknown:${id}`,label:"UNKNOWN",statement:`Required evidence ${id} is not available in the current evidence set.`,confidence:0,evidenceRefs:[],basis:"missing_required_evidence"}));
 const refs=Array.from(new Map([...observed,...inferred,...hypotheses,...simulated].flatMap(i=>i.evidenceRefs).map(r=>[r.evidenceId,r])).values());
 const total=observed.length+inferred.length+hypotheses.length+simulated.length+unknowns.length;
 const uncertainty=total?clamp((unknowns.length+inferred.filter(i=>i.confidence<0.5).length+hypotheses.filter(i=>i.confidence<0.5).length)/total):1;
 return{observed,inferred,hypotheses,simulated,unknowns,evidenceCoverage:clamp(covered),uncertainty,provenance:{engineVersion:"tennis-epistemic-awareness-v1",evidenceRefs:refs}};
}

export function buildTennisEpistemicItem(id:string,label:TennisEpistemicLabel,statement:string,confidence:number,evidenceRefs:EvidenceRef[]=[],basis?:string):TennisEpistemicItem{
 return{id,label,statement,confidence:clamp(confidence),evidenceRefs,basis};
}
