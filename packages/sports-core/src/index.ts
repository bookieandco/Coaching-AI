export type SportCode =
  | "basketball"
  | "american_football"
  | "soccer"
  | "baseball"
  | "ice_hockey"
  | "tennis"
  | "volleyball"
  | "rugby"
  | "cricket"
  | "golf"
  | "lacrosse"
  | "combat_sports"
  | "motorsports"
  | "other";

export type Id<T extends string> = string & { readonly __brand: T };

export type GameId = Id<"GameId">;
export type TeamId = Id<"TeamId">;
export type PlayerId = Id<"PlayerId">;
export type EventId = Id<"EventId">;
export type ScenarioId = Id<"ScenarioId">;
export type EvidenceId = Id<"EvidenceId">;

export interface EvidenceRef {
  evidenceId: EvidenceId;
  sourceType: "video" | "tracking" | "official_feed" | "manual" | "derived" | "other";
  locator?: string;
  observedAt?: string;
}

export interface Participant {
  participantId: string;
  kind: "team" | "player" | "individual" | "pair" | "vehicle" | "other";
  displayName: string;
}

export interface GameClock {
  mode: "timed" | "untimed" | "round_based" | "turn_based" | "continuous";
  elapsedMs?: number;
  remainingMs?: number;
  period?: number;
  label?: string;
}

export interface ScoreState {
  values: Record<string, number | string>;
  leaderParticipantId?: string;
}

export interface ControlState {
  mode: "possession" | "turn" | "rally" | "shared" | "none";
  controllerParticipantId?: string;
}

export interface GamePhase {
  id: string;
  label: string;
  sequence: number;
}

export interface GameState {
  gameId: GameId;
  sport: SportCode;
  rulesetVersion: string;
  participants: Participant[];
  clock: GameClock;
  score: ScoreState;
  control: ControlState;
  phase: GamePhase;
  attributes: Record<string, unknown>;
  evidenceRefs: EvidenceRef[];
  stateVersion: number;
}

export interface Action {
  actionId: string;
  actorParticipantId?: string;
  actionType: string;
  timestampMs?: number;
  spatialContext?: unknown;
  parameters: Record<string, unknown>;
  evidenceRefs: EvidenceRef[];
}

export interface Event {
  eventId: EventId;
  eventType: string;
  actorParticipantId?: string;
  timestampMs?: number;
  payload: Record<string, unknown>;
  evidenceRefs: EvidenceRef[];
}

export interface StateTransition {
  fromVersion: number;
  toVersion: number;
  eventOrActionId: string;
  state: GameState;
  changedPaths: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ code: string; message: string; path?: string }>;
}

export interface SportMetadata {
  code: SportCode;
  name: string;
  rulesetVersion: string;
}

export interface SportCapabilities {
  hasTeams: boolean;
  hasPossession: boolean;
  hasClock: boolean;
  hasSpatialModel: boolean;
  hasLineups: boolean;
  hasSubstitutions: boolean;
  hasPeriods: boolean;
  hasSets: boolean;
  hasRounds: boolean;
  hasInnings: boolean;
  hasContinuousPlay: boolean;
  supportsTacticalFormation: boolean;
  supportsPlayerTracking: boolean;
  supportsObjectTracking: boolean;
}

export interface InitialStateInput {
  gameId: GameId;
  participants: Participant[];
  rulesetVersion?: string;
  attributes?: Record<string, unknown>;
}

export interface RawSportEvent {
  sourceType: string;
  type: string;
  timestampMs?: number;
  payload: Record<string, unknown>;
}

export interface RawSportAction {
  type: string;
  actorParticipantId?: string;
  timestampMs?: number;
  parameters?: Record<string, unknown>;
}

export interface ActionContext {
  state: GameState;
  objective?: string;
}

export interface ActionDefinition {
  actionType: string;
  label: string;
  constraints: Record<string, unknown>;
}

export interface ScoreContext {
  state: GameState;
  action: Action;
}

export interface ScoreTransition {
  delta: Record<string, number | string>;
}

export interface TerminalResult {
  terminal: boolean;
  reason?: string;
  winnerParticipantId?: string;
}

export interface SportAdapter {
  metadata(): SportMetadata;
  capabilities(): SportCapabilities;
  createInitialState(input: InitialStateInput): GameState;
  normalizeEvent(input: RawSportEvent): Event;
  normalizeAction(input: RawSportAction): Action;
  applyEvent(state: GameState, event: Event): StateTransition;
  applyAction(state: GameState, action: Action): StateTransition;
  validateState(state: GameState): ValidationResult;
  legalActions(context: ActionContext): ActionDefinition[];
  scoreTransition(context: ScoreContext): ScoreTransition;
  gamePhase(state: GameState): GamePhase;
  controlState(state: GameState): ControlState;
  isTerminal(state: GameState): TerminalResult;
}
