import type {
  Action,
  ActionContext,
  ActionDefinition,
  ControlState,
  Event,
  GamePhase,
  GameState,
  InitialStateInput,
  RawSportAction,
  RawSportEvent,
  ScoreContext,
  ScoreTransition,
  SportAdapter,
  SportCapabilities,
  SportMetadata,
  StateTransition,
  TerminalResult,
  ValidationResult,
} from "@coaching-ai/sports-core";

export type TennisPointOutcome = "point" | "ace" | "double_fault" | "fault" | "let" | "penalty";
export type TennisCourtSurface = "hard" | "clay" | "grass" | "carpet" | "other";
export type TennisMatchFormat = "best_of_1" | "best_of_3" | "best_of_5";

export interface TennisScore {
  points: number;
  games: number;
  sets: number;
  tiebreakPoints: number;
}

export interface TennisMatchState extends GameState {
  sport: "tennis";
  attributes: {
    surface: TennisCourtSurface;
    matchFormat: TennisMatchFormat;
    serverParticipantId?: string;
    receiverParticipantId?: string;
    bestOfSets: number;
    currentSetTiebreak?: boolean;
    completedSets: Array<{ winnerParticipantId: string; loserParticipantId: string; gamesWinner: number; gamesLoser: number }>;
    tennisScore: Record<string, TennisScore>;
    [key: string]: unknown;
  };
}

export interface TennisAdapterOptions {
  rulesetVersion?: string;
  surface?: TennisCourtSurface;
  matchFormat?: TennisMatchFormat;
}

const RULESET = "tennis-standard-v1";
const POINT_VALUES = [0, 15, 30, 40] as const;

function matchBestOf(format: TennisMatchFormat): number {
  return format === "best_of_5" ? 5 : format === "best_of_1" ? 1 : 3;
}

function scoreFor(state: TennisMatchState, participantId: string): TennisScore {
  return state.attributes.tennisScore[participantId] ?? { points: 0, games: 0, sets: 0, tiebreakPoints: 0 };
}

function setScore(state: TennisMatchState, participantId: string, score: TennisScore): TennisMatchState {
  return {
    ...state,
    attributes: {
      ...state.attributes,
      tennisScore: { ...state.attributes.tennisScore, [participantId]: score },
    },
  };
}

function winnerForSet(state: TennisMatchState): string | undefined {
  const ids = state.participants.map((p) => p.participantId);
  if (ids.length !== 2) return undefined;
  const [a, b] = ids;
  const sa = scoreFor(state, a);
  const sb = scoreFor(state, b);
  if (sa.games >= 6 && sa.games - sb.games >= 2) return a;
  if (sb.games >= 6 && sb.games - sa.games >= 2) return b;
  if (sa.games === 7) return a;
  if (sb.games === 7) return b;
  return undefined;
}

function applyPoint(state: TennisMatchState, winnerId: string): TennisMatchState {
  const ids = state.participants.map((p) => p.participantId);
  if (ids.length !== 2 || !ids.includes(winnerId)) return state;
  const loserId = ids[0] === winnerId ? ids[1] : ids[0];
  let winner = { ...scoreFor(state, winnerId) };
  let loser = { ...scoreFor(state, loserId) };

  const tiebreak = state.attributes.currentSetTiebreak === true;
  if (tiebreak) {
    winner.tiebreakPoints += 1;
    if (winner.tiebreakPoints >= 7 && winner.tiebreakPoints - loser.tiebreakPoints >= 2) {
      winner.games += 1;
    } else {
      return setScore(setScore(state, winnerId, winner), loserId, loser);
    }
  } else if (winner.points < 40) {
    winner.points = POINT_VALUES[Math.min(POINT_VALUES.length - 1, POINT_VALUES.indexOf(winner.points as 0 | 15 | 30) + 1)] ?? 40;
    if (winner.points === 40 && loser.points === 40) winner.points = 40;
  } else if (loser.points < 40) {
    loser.points = POINT_VALUES[Math.min(POINT_VALUES.length - 1, POINT_VALUES.indexOf(loser.points as 0 | 15 | 30) + 1)] ?? 40;
  } else {
    // Deuce/advantage is represented by the same 40 score plus an internal advantage flag.
    const attributes = { ...state.attributes, advantageParticipantId: winnerId };
    if (attributes.advantageParticipantId === loserId) {
      delete attributes.advantageParticipantId;
      return setScore({ ...state, attributes }, winnerId, { ...winner, points: 40 });
    }
    if ((state.attributes.advantageParticipantId as string | undefined) === winnerId) {
      winner.games += 1;
      winner.points = 0;
      loser.points = 0;
      delete attributes.advantageParticipantId;
    } else {
      attributes.advantageParticipantId = winnerId;
    }
    return setScore(setScore({ ...state, attributes }, winnerId, winner), loserId, loser);
  }

  const next = setScore(setScore(state, winnerId, winner), loserId, loser);
  if (winner.points === 40 && loser.points < 40 && winner.points !== loser.points) {
    // The game is won only after a player reaches 40 from 30 or wins advantage.
    if (scoreFor(next, winnerId).points === 40 && scoreFor(next, loserId).points < 40) {
      winner.games += 1;
      winner.points = 0;
      loser.points = 0;
      return setScore(setScore(next, winnerId, winner), loserId, loser);
    }
  }
  return next;
}

function maybeCloseSet(state: TennisMatchState): TennisMatchState {
  const winnerId = winnerForSet(state);
  if (!winnerId) return state;
  const ids = state.participants.map((p) => p.participantId);
  const loserId = ids.find((id) => id !== winnerId)!;
  const winner = scoreFor(state, winnerId);
  const loser = scoreFor(state, loserId);
  const completedSets = [...state.attributes.completedSets, {
    winnerParticipantId: winnerId,
    loserParticipantId: loserId,
    gamesWinner: winner.games,
    gamesLoser: loser.games,
  }];
  const resetWinner = { ...winner, points: 0, games: 0, tiebreakPoints: 0, sets: winner.sets + 1 };
  const resetLoser = { ...loser, points: 0, games: 0, tiebreakPoints: 0 };
  const bestOfSets = state.attributes.bestOfSets;
  const terminal = resetWinner.sets > Math.floor(bestOfSets / 2);
  return {
    ...setScore(setScore(state, winnerId, resetWinner), loserId, resetLoser),
    attributes: {
      ...state.attributes,
      completedSets,
      currentSetTiebreak: false,
    },
    score: {
      values: Object.fromEntries(ids.map((id) => [id, scoreFor(state, id).sets + (id === winnerId ? 1 : 0)])),
      leaderParticipantId: terminal ? winnerId : undefined,
    },
  };
}

export function createTennisAdapter(options: TennisAdapterOptions = {}): SportAdapter {
  const format = options.matchFormat ?? "best_of_3";
  const metadata: SportMetadata = { code: "tennis", name: "Tennis", rulesetVersion: options.rulesetVersion ?? RULESET };
  const capabilities: SportCapabilities = {
    hasTeams: true,
    hasPossession: false,
    hasClock: false,
    hasSpatialModel: true,
    hasLineups: false,
    hasSubstitutions: false,
    hasPeriods: false,
    hasSets: true,
    hasRounds: false,
    hasInnings: false,
    hasContinuousPlay: false,
    supportsTacticalFormation: false,
    supportsPlayerTracking: true,
    supportsObjectTracking: true,
  };

  return {
    metadata: () => metadata,
    capabilities: () => capabilities,
    createInitialState(input: InitialStateInput): TennisMatchState {
      const surface = options.surface ?? "hard";
      const ids = input.participants.map((p) => p.participantId);
      return {
        gameId: input.gameId,
        sport: "tennis",
        rulesetVersion: options.rulesetVersion ?? RULESET,
        participants: input.participants,
        clock: { mode: "untimed", label: "match" },
        score: { values: Object.fromEntries(ids.map((id) => [id, 0])) },
        control: { mode: "rally" },
        phase: { id: "set-1", label: "Set 1", sequence: 1 },
        attributes: {
          surface,
          matchFormat: format,
          bestOfSets: matchBestOf(format),
          tennisScore: Object.fromEntries(ids.map((id) => [id, { points: 0, games: 0, sets: 0, tiebreakPoints: 0 }])),
          completedSets: [],
        },
        evidenceRefs: [],
        stateVersion: 0,
      };
    },
    normalizeEvent(input: RawSportEvent): Event {
      return {
        eventId: `tennis-event-${input.timestampMs ?? Date.now()}-${input.type}` as Event["eventId"],
        eventType: input.type,
        actorParticipantId: typeof input.payload.winnerParticipantId === "string" ? input.payload.winnerParticipantId : undefined,
        timestampMs: input.timestampMs,
        payload: input.payload,
        evidenceRefs: [],
      };
    },
    normalizeAction(input: RawSportAction): Action {
      return {
        actionId: `tennis-action-${input.timestampMs ?? Date.now()}-${input.type}`,
        actorParticipantId: input.actorParticipantId,
        actionType: input.type,
        timestampMs: input.timestampMs,
        parameters: input.parameters ?? {},
        evidenceRefs: [],
      };
    },
    applyEvent(state: GameState, event: Event): StateTransition {
      const current = state as TennisMatchState;
      const winnerId = typeof event.payload.winnerParticipantId === "string" ? event.payload.winnerParticipantId : event.actorParticipantId;
      if (!winnerId || !current.participants.some((p) => p.participantId === winnerId)) {
        return { fromVersion: current.stateVersion, toVersion: current.stateVersion, eventOrActionId: event.eventId, state: current, changedPaths: [] };
      }
      let next = applyPoint({ ...current, evidenceRefs: [...current.evidenceRefs, ...event.evidenceRefs] }, winnerId);
      next = maybeCloseSet(next);
      next = {
        ...next,
        stateVersion: current.stateVersion + 1,
        phase: { id: `set-${next.attributes.completedSets.length + 1}`, label: `Set ${next.attributes.completedSets.length + 1}`, sequence: next.attributes.completedSets.length + 1 },
      };
      return { fromVersion: current.stateVersion, toVersion: next.stateVersion, eventOrActionId: event.eventId, state: next, changedPaths: ["attributes.tennisScore", "score", "phase", "evidenceRefs"] };
    },
    applyAction(state: GameState, action: Action): StateTransition {
      return this.applyEvent(state, {
        eventId: action.actionId as Event["eventId"],
        eventType: action.actionType,
        actorParticipantId: action.actorParticipantId,
        timestampMs: action.timestampMs,
        payload: action.parameters,
        evidenceRefs: action.evidenceRefs,
      });
    },
    validateState(state: GameState): ValidationResult {
      const errors: Array<{ code: string; message: string; path?: string }> = [];
      if (state.sport !== "tennis") errors.push({ code: "INVALID_SPORT", message: "State sport must be tennis.", path: "sport" });
      if (state.participants.length !== 2 && state.participants.length !== 4) errors.push({ code: "INVALID_PARTICIPANTS", message: "Tennis state requires two singles participants or four doubles participants.", path: "participants" });
      if (!Number.isInteger(state.stateVersion) || state.stateVersion < 0) errors.push({ code: "INVALID_VERSION", message: "State version must be a non-negative integer.", path: "stateVersion" });
      return { valid: errors.length === 0, errors };
    },
    legalActions(context: ActionContext): ActionDefinition[] {
      return context.state.participants.map((participant) => ({ actionType: "point", label: `Point won by ${participant.displayName}`, constraints: { participantId: participant.participantId } }));
    },
    scoreTransition(context: ScoreContext): ScoreTransition {
      return { delta: { [context.action.actorParticipantId ?? "unknown"]: 1 } };
    },
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
