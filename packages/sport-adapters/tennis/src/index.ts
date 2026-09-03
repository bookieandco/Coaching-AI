import type {
  Action, ActionContext, ActionDefinition, ControlState, Event, GamePhase, GameState,
  InitialStateInput, RawSportAction, RawSportEvent, ScoreContext, ScoreTransition,
  SportAdapter, SportCapabilities, SportMetadata, StateTransition, TerminalResult, ValidationResult,
} from "@coaching-ai/sports-core";
import { applyTennisPoint, enterTiebreakIfRequired } from "./scoring";

export type TennisPointOutcome = "point" | "ace" | "double_fault" | "fault" | "let" | "penalty";
export type TennisCourtSurface = "hard" | "clay" | "grass" | "carpet" | "other";
export type TennisMatchFormat = "best_of_1" | "best_of_3" | "best_of_5";

export interface TennisScore { points: number; games: number; sets: number; tiebreakPoints: number; }
export interface TennisMatchState extends GameState {
  sport: "tennis";
  attributes: {
    surface: TennisCourtSurface;
    matchFormat: TennisMatchFormat;
    serverParticipantId?: string;
    receiverParticipantId?: string;
    bestOfSets: number;
    currentSetTiebreak?: boolean;
    advantageParticipantId?: string;
    completedSets: Array<{ winnerParticipantId: string; loserParticipantId: string; gamesWinner: number; gamesLoser: number }>;
    tennisScore: Record<string, TennisScore>;
    [key: string]: unknown;
  };
}
export interface TennisAdapterOptions { rulesetVersion?: string; surface?: TennisCourtSurface; matchFormat?: TennisMatchFormat; }
const RULESET = "tennis-standard-v2";

function matchBestOf(format: TennisMatchFormat): number { return format === "best_of_5" ? 5 : format === "best_of_1" ? 1 : 3; }
function scoreFor(state: TennisMatchState, id: string): TennisScore { return state.attributes.tennisScore[id] ?? { points: 0, games: 0, sets: 0, tiebreakPoints: 0 }; }

export function createTennisAdapter(options: TennisAdapterOptions = {}): SportAdapter {
  const format = options.matchFormat ?? "best_of_3";
  const metadata: SportMetadata = { code: "tennis", name: "Tennis", rulesetVersion: options.rulesetVersion ?? RULESET };
  const capabilities: SportCapabilities = {
    hasTeams: false, hasPossession: false, hasClock: false, hasSpatialModel: true,
    hasLineups: false, hasSubstitutions: false, hasPeriods: false, hasSets: true,
    hasRounds: false, hasInnings: false, hasContinuousPlay: false,
    supportsTacticalFormation: false, supportsPlayerTracking: true, supportsObjectTracking: true,
  };

  return {
    metadata: () => metadata,
    capabilities: () => capabilities,
    createInitialState(input: InitialStateInput): TennisMatchState {
      const ids = input.participants.map((p) => p.participantId);
      return {
        gameId: input.gameId, sport: "tennis", rulesetVersion: options.rulesetVersion ?? RULESET,
        participants: input.participants, clock: { mode: "untimed", label: "match" },
        score: { values: Object.fromEntries(ids.map((id) => [id, 0])) }, control: { mode: "rally" },
        phase: { id: "set-1", label: "Set 1", sequence: 1 },
        attributes: {
          surface: options.surface ?? "hard", matchFormat: format, bestOfSets: matchBestOf(format),
          tennisScore: Object.fromEntries(ids.map((id) => [id, { points: 0, games: 0, sets: 0, tiebreakPoints: 0 }])),
          completedSets: [],
        }, evidenceRefs: [], stateVersion: 0,
      };
    },
    normalizeEvent(input: RawSportEvent): Event {
      const suppliedId = typeof input.payload.eventId === "string" ? input.payload.eventId : undefined;
      return { eventId: (suppliedId ?? `tennis-event-${input.timestampMs ?? "unknown"}-${input.type}`) as Event["eventId"],
        eventType: input.type, actorParticipantId: typeof input.payload.winnerParticipantId === "string" ? input.payload.winnerParticipantId : undefined,
        timestampMs: input.timestampMs, payload: input.payload, evidenceRefs: [] };
    },
    normalizeAction(input: RawSportAction): Action {
      const suppliedId = typeof input.parameters.eventId === "string" ? input.parameters.eventId : undefined;
      return { actionId: suppliedId ?? `tennis-action-${input.timestampMs ?? "unknown"}-${input.type}`,
        actorParticipantId: input.actorParticipantId, actionType: input.type, timestampMs: input.timestampMs,
        parameters: input.parameters ?? {}, evidenceRefs: [] };
    },
    applyEvent(state: GameState, event: Event): StateTransition {
      const current = state as TennisMatchState;
      const winnerId = typeof event.payload.winnerParticipantId === "string" ? event.payload.winnerParticipantId : event.actorParticipantId;
      if (!winnerId || current.participants.length !== 2 || !current.participants.some((p) => p.participantId === winnerId)) {
        return { fromVersion: current.stateVersion, toVersion: current.stateVersion, eventOrActionId: event.eventId, state: current, changedPaths: [] };
      }
      if (this.isTerminal(current).terminal) return { fromVersion: current.stateVersion, toVersion: current.stateVersion, eventOrActionId: event.eventId, state: current, changedPaths: [] };
      let result = applyTennisPoint({ ...current, evidenceRefs: [...current.evidenceRefs, ...event.evidenceRefs] }, winnerId);
      result = { ...result, state: enterTiebreakIfRequired(result.state) };
      const next = { ...result.state, stateVersion: current.stateVersion + 1,
        phase: { id: `set-${result.state.attributes.completedSets.length + 1}`, label: `Set ${result.state.attributes.completedSets.length + 1}`, sequence: result.state.attributes.completedSets.length + 1 } };
      return { fromVersion: current.stateVersion, toVersion: next.stateVersion, eventOrActionId: event.eventId, state: next,
        changedPaths: ["attributes.tennisScore", "attributes.currentSetTiebreak", "attributes.advantageParticipantId", "attributes.completedSets", "score", "phase", "evidenceRefs"] };
    },
    applyAction(state: GameState, action: Action): StateTransition {
      return this.applyEvent(state, { eventId: action.actionId as Event["eventId"], eventType: action.actionType,
        actorParticipantId: action.actorParticipantId, timestampMs: action.timestampMs, payload: action.parameters, evidenceRefs: action.evidenceRefs });
    },
    validateState(state: GameState): ValidationResult {
      const errors: Array<{ code: string; message: string; path?: string }> = [];
      if (state.sport !== "tennis") errors.push({ code: "INVALID_SPORT", message: "State sport must be tennis.", path: "sport" });
      if (state.participants.length !== 2) errors.push({ code: "INVALID_PARTICIPANTS", message: "The reference adapter currently supports singles (two participants). Doubles is reserved for a team-aware adapter extension.", path: "participants" });
      if (!Number.isInteger(state.stateVersion) || state.stateVersion < 0) errors.push({ code: "INVALID_VERSION", message: "State version must be a non-negative integer.", path: "stateVersion" });
      const match = state as TennisMatchState;
      for (const p of state.participants) {
        const s = scoreFor(match, p.participantId);
        if (s.games < 0 || s.games > 7 || s.sets < 0 || s.points < 0 || s.points > 40 || s.tiebreakPoints < 0) errors.push({ code: "INVALID_SCORE", message: `Invalid tennis score for ${p.participantId}.`, path: `attributes.tennisScore.${p.participantId}` });
      }
      return { valid: errors.length === 0, errors };
    },
    legalActions(context: ActionContext): ActionDefinition[] { return context.state.participants.map((p) => ({ actionType: "point", label: `Point won by ${p.displayName}`, constraints: { participantId: p.participantId } })); },
    scoreTransition(context: ScoreContext): ScoreTransition { return { delta: { [context.action.actorParticipantId ?? "unknown"]: 1 } }; },
    gamePhase(state: GameState): GamePhase { return state.phase; },
    controlState(_state: GameState): ControlState { return { mode: "rally" }; },
    isTerminal(state: GameState): TerminalResult {
      const match = state as TennisMatchState;
      const target = Math.floor(match.attributes.bestOfSets / 2) + 1;
      const winner = match.participants.find((p) => scoreFor(match, p.participantId).sets >= target);
      return winner ? { terminal: true, reason: "match_complete", winnerParticipantId: winner.participantId } : { terminal: false };
    },
  };
}
export const tennisAdapter = createTennisAdapter();
