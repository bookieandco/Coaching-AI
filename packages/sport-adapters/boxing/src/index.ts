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

export interface BoxingRoundState {
  round: number;
  scheduledRounds: number;
  remainingMs: number;
}

export interface BoxingFightState {
  roundState: BoxingRoundState;
  stance: Record<string, "orthodox" | "southpaw" | "switch" | "unknown">;
  distance: Record<string, "inside" | "pocket" | "mid" | "long" | "unknown">;
  clinch: boolean;
  knockdowns: Record<string, number>;
  tacticalMode: Record<string, string>;
}

const capabilities: SportCapabilities = {
  hasTeams: false,
  hasPossession: false,
  hasClock: true,
  hasSpatialModel: true,
  hasLineups: false,
  hasSubstitutions: false,
  hasPeriods: false,
  hasSets: false,
  hasRounds: true,
  hasInnings: false,
  hasContinuousPlay: true,
  supportsTacticalFormation: false,
  supportsPlayerTracking: true,
  supportsObjectTracking: true,
};

export const boxingAdapter: SportAdapter = {
  metadata(): SportMetadata {
    return { code: "combat_sports", name: "Boxing", rulesetVersion: "boxing-v0.1" };
  },

  capabilities(): SportCapabilities {
    return capabilities;
  },

  createInitialState(input: InitialStateInput): GameState {
    return {
      gameId: input.gameId,
      sport: "combat_sports",
      rulesetVersion: input.rulesetVersion ?? "boxing-v0.1",
      participants: input.participants,
      clock: { mode: "round_based", remainingMs: 180_000, period: 1, label: "Round 1" },
      score: { values: {} },
      control: { mode: "none" },
      phase: { id: "round", label: "Round", sequence: 1 },
      attributes: {
        sportFamily: "combat_sports",
        combatDiscipline: "boxing",
        scheduledRounds: 12,
        roundLengthMs: 180_000,
        restLengthMs: 60_000,
        stance: {},
        distance: {},
        tacticalMode: {},
        clinch: false,
        knockdowns: {},
      } satisfies BoxingFightState & Record<string, unknown>,
      evidenceRefs: [],
      stateVersion: 0,
    };
  },

  normalizeEvent(input: RawSportEvent): Event {
    return {
      eventId: input.payload.eventId as Event["eventId"],
      eventType: input.type,
      timestampMs: input.timestampMs,
      payload: input.payload,
      evidenceRefs: [],
    };
  },

  normalizeAction(input: RawSportAction): Action {
    return {
      actionId: `${input.type}:${input.timestampMs ?? 0}`,
      actionType: input.type,
      actorParticipantId: input.actorParticipantId,
      timestampMs: input.timestampMs,
      parameters: input.parameters ?? {},
      evidenceRefs: [],
    };
  },

  applyEvent(state: GameState, event: Event): StateTransition {
    return transition(state, event.eventId, event.eventType, event.payload);
  },

  applyAction(state: GameState, action: Action): StateTransition {
    return transition(state, action.actionId, action.actionType, action.parameters);
  },

  validateState(state: GameState): ValidationResult {
    const errors: ValidationResult["errors"] = [];
    if (state.participants.length !== 2) {
      errors.push({ code: "BOXING_TWO_PARTICIPANTS", message: "A boxing bout requires exactly two primary participants.", path: "participants" });
    }
    if (state.clock.remainingMs !== undefined && state.clock.remainingMs < 0) {
      errors.push({ code: "NEGATIVE_CLOCK", message: "Round clock cannot be negative.", path: "clock.remainingMs" });
    }
    return { valid: errors.length === 0, errors };
  },

  legalActions(context: ActionContext): ActionDefinition[] {
    return [
      { actionType: "increase_pressure", label: "Increase pressure", constraints: { requiresOpponent: true } },
      { actionType: "change_distance", label: "Change distance", constraints: { values: ["inside", "pocket", "mid", "long"] } },
      { actionType: "increase_body_attack", label: "Increase body attack", constraints: {} },
      { actionType: "change_exit_direction", label: "Change exit direction", constraints: {} },
      { actionType: "increase_countering", label: "Increase countering", constraints: {} },
      { actionType: "reduce_exchange_frequency", label: "Reduce exchange frequency", constraints: {} },
      { actionType: "change_tempo", label: "Change tempo", constraints: {} },
      { actionType: "force_clinch_reset", label: "Force clinch/reset", constraints: { legalOnly: true } },
    ];
  },

  scoreTransition(_context: ScoreContext): ScoreTransition {
    return { delta: {} };
  },

  gamePhase(state: GameState): GamePhase {
    return state.phase;
  },

  controlState(_state: GameState): ControlState {
    return { mode: "none" };
  },

  isTerminal(state: GameState): TerminalResult {
    const terminal = Boolean(state.attributes.terminal);
    return {
      terminal,
      reason: terminal ? String(state.attributes.terminalReason ?? "finish") : undefined,
      winnerParticipantId: typeof state.attributes.winnerParticipantId === "string"
        ? state.attributes.winnerParticipantId
        : undefined,
    };
  },
};

function transition(
  state: GameState,
  id: string,
  type: string,
  payload: Record<string, unknown>,
): StateTransition {
  const nextAttributes = { ...state.attributes };

  if (type === "knockdown" && typeof payload.fighterId === "string") {
    const knockdowns = { ...(nextAttributes.knockdowns as Record<string, number> | undefined) };
    knockdowns[payload.fighterId] = (knockdowns[payload.fighterId] ?? 0) + 1;
    nextAttributes.knockdowns = knockdowns;
  }

  if (type === "clinch_start") nextAttributes.clinch = true;
  if (type === "clinch_end") nextAttributes.clinch = false;
  if (typeof payload.tacticalMode === "string" && typeof payload.fighterId === "string") {
    nextAttributes.tacticalMode = {
      ...(nextAttributes.tacticalMode as Record<string, string> | undefined),
      [payload.fighterId]: payload.tacticalMode,
    };
  }

  const nextState: GameState = {
    ...state,
    attributes: nextAttributes,
    stateVersion: state.stateVersion + 1,
  };

  return {
    fromVersion: state.stateVersion,
    toVersion: nextState.stateVersion,
    eventOrActionId: id,
    state: nextState,
    changedPaths: ["attributes"],
  };
}
