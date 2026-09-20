import type { EvidenceRef, GameId, SportCode } from "./index";

export const SPORTS_PREDICTION_ENVELOPE_SCHEMA_VERSION = "SPORT-PRED-01" as const;

export type SportsPredictionSubjectKind =
  | "game"
  | "match"
  | "fight"
  | "race"
  | "team"
  | "player"
  | "participant"
  | "event"
  | "other";

export type SportsPredictionUse =
  | "ANALYSIS"
  | "SIMULATION_BASELINE"
  | "COACHING_CONTEXT"
  | "MONEY_RESEARCH_INPUT";

export type CalibrationStatus =
  | "CALIBRATED"
  | "PARTIAL"
  | "UNCALIBRATED"
  | "STALE"
  | "UNKNOWN";

export type ResolutionType =
  | "BINARY"
  | "MULTICLASS"
  | "ORDINAL"
  | "NUMERIC";

export interface SportsPredictionModelIdentity {
  modelId: string;
  modelVersion: string;
  methodologyVersion: string;
  featureSnapshotHash: string;
  codeRevision?: string;
}

export interface SportsPredictionOutcome {
  outcomeId: string;
  label: string;
  probability: number;
  metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface SportsPredictionDistribution {
  outcomes: readonly SportsPredictionOutcome[];
}

export interface SportsPredictionCalibration {
  status: CalibrationStatus;
  sampleSize: number;
  brierScore?: number;
  evaluatedAt?: string;
  calibrationModelVersion?: string;
}

export interface SportsPredictionUncertainty {
  aleatoric: number;
  epistemic: number;
  overall: number;
  notes?: readonly string[];
}

export interface SportsPredictionResolutionContract {
  type: ResolutionType;
  authority: string;
  ruleVersion: string;
  resolutionDeadlineAt?: string;
}

export interface SportsPredictionProvenance {
  inputSnapshotHash: string;
  evidenceSnapshotHash: string;
  generatedBy: string;
  sourceEnvelopeIds?: readonly string[];
}

export interface SportsPredictionAuthority {
  decision: "INTELLIGENCE_ONLY";
  coachingExecution: "NONE";
  bettingExecution: "NONE";
  financialExecution: "NONE";
}

export interface SportsPredictionEnvelope {
  schemaVersion: typeof SPORTS_PREDICTION_ENVELOPE_SCHEMA_VERSION;
  envelopeId: string;
  sport: SportCode;
  subject: Readonly<{
    subjectId: string;
    kind: SportsPredictionSubjectKind;
    gameId?: GameId;
  }>;
  informationCutoff: string;
  issuedAt: string;
  model: Readonly<SportsPredictionModelIdentity>;
  distribution: Readonly<SportsPredictionDistribution>;
  calibration: Readonly<SportsPredictionCalibration>;
  uncertainty: Readonly<SportsPredictionUncertainty>;
  resolution: Readonly<SportsPredictionResolutionContract>;
  evidenceRefs: readonly EvidenceRef[];
  provenance: Readonly<SportsPredictionProvenance>;
  allowedUses: readonly SportsPredictionUse[];
  authority: Readonly<SportsPredictionAuthority>;
}

const PROBABILITY_EPSILON = 1e-6;

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new Error(`SPORT_PRED_${field.toUpperCase()}_REQUIRED`);
}

function assertIsoTimestamp(value: string, field: string): void {
  assertNonEmpty(value, field);
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`SPORT_PRED_${field.toUpperCase()}_INVALID`);
  }
}

function assertUnitInterval(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`SPORT_PRED_${field.toUpperCase()}_INVALID`);
  }
}

export function assertSportsPredictionEnvelope(
  envelope: SportsPredictionEnvelope,
): void {
  if (envelope.schemaVersion !== SPORTS_PREDICTION_ENVELOPE_SCHEMA_VERSION) {
    throw new Error("SPORT_PRED_SCHEMA_VERSION_UNSUPPORTED");
  }

  assertNonEmpty(envelope.envelopeId, "envelope_id");
  assertNonEmpty(envelope.subject.subjectId, "subject_id");
  assertIsoTimestamp(envelope.informationCutoff, "information_cutoff");
  assertIsoTimestamp(envelope.issuedAt, "issued_at");

  if (Date.parse(envelope.informationCutoff) > Date.parse(envelope.issuedAt)) {
    throw new Error("SPORT_PRED_FUTURE_INFORMATION_CUTOFF");
  }

  assertNonEmpty(envelope.model.modelId, "model_id");
  assertNonEmpty(envelope.model.modelVersion, "model_version");
  assertNonEmpty(envelope.model.methodologyVersion, "methodology_version");
  assertNonEmpty(envelope.model.featureSnapshotHash, "feature_snapshot_hash");

  if (envelope.distribution.outcomes.length === 0) {
    throw new Error("SPORT_PRED_DISTRIBUTION_EMPTY");
  }

  const outcomeIds = new Set<string>();
  let probabilityTotal = 0;

  for (const outcome of envelope.distribution.outcomes) {
    assertNonEmpty(outcome.outcomeId, "outcome_id");
    assertNonEmpty(outcome.label, "outcome_label");
    assertUnitInterval(outcome.probability, "outcome_probability");
    if (outcomeIds.has(outcome.outcomeId)) {
      throw new Error("SPORT_PRED_DUPLICATE_OUTCOME");
    }
    outcomeIds.add(outcome.outcomeId);
    probabilityTotal += outcome.probability;
  }

  if (Math.abs(probabilityTotal - 1) > PROBABILITY_EPSILON) {
    throw new Error("SPORT_PRED_PROBABILITY_MASS_INVALID");
  }

  if (!Number.isInteger(envelope.calibration.sampleSize) || envelope.calibration.sampleSize < 0) {
    throw new Error("SPORT_PRED_CALIBRATION_SAMPLE_SIZE_INVALID");
  }
  if (
    envelope.calibration.brierScore !== undefined &&
    (!Number.isFinite(envelope.calibration.brierScore) ||
      envelope.calibration.brierScore < 0)
  ) {
    throw new Error("SPORT_PRED_BRIER_SCORE_INVALID");
  }
  if (envelope.calibration.evaluatedAt) {
    assertIsoTimestamp(envelope.calibration.evaluatedAt, "calibration_evaluated_at");
  }

  assertUnitInterval(envelope.uncertainty.aleatoric, "aleatoric_uncertainty");
  assertUnitInterval(envelope.uncertainty.epistemic, "epistemic_uncertainty");
  assertUnitInterval(envelope.uncertainty.overall, "overall_uncertainty");

  assertNonEmpty(envelope.resolution.authority, "resolution_authority");
  assertNonEmpty(envelope.resolution.ruleVersion, "resolution_rule_version");
  if (envelope.resolution.resolutionDeadlineAt) {
    assertIsoTimestamp(
      envelope.resolution.resolutionDeadlineAt,
      "resolution_deadline_at",
    );
  }

  if (envelope.evidenceRefs.length === 0) {
    throw new Error("SPORT_PRED_EVIDENCE_REQUIRED");
  }

  const evidenceIds = new Set<string>();
  for (const ref of envelope.evidenceRefs) {
    assertNonEmpty(ref.evidenceId, "evidence_id");
    if (evidenceIds.has(ref.evidenceId)) {
      throw new Error("SPORT_PRED_DUPLICATE_EVIDENCE");
    }
    evidenceIds.add(ref.evidenceId);
  }

  assertNonEmpty(envelope.provenance.inputSnapshotHash, "input_snapshot_hash");
  assertNonEmpty(
    envelope.provenance.evidenceSnapshotHash,
    "evidence_snapshot_hash",
  );
  assertNonEmpty(envelope.provenance.generatedBy, "generated_by");

  if (envelope.allowedUses.length === 0) {
    throw new Error("SPORT_PRED_ALLOWED_USE_REQUIRED");
  }

  if (
    envelope.authority.decision !== "INTELLIGENCE_ONLY" ||
    envelope.authority.coachingExecution !== "NONE" ||
    envelope.authority.bettingExecution !== "NONE" ||
    envelope.authority.financialExecution !== "NONE"
  ) {
    throw new Error("SPORT_PRED_EXECUTION_AUTHORITY_FORBIDDEN");
  }
}

export function buildSportsPredictionEnvelope(
  input: Omit<SportsPredictionEnvelope, "authority" | "schemaVersion">,
): SportsPredictionEnvelope {
  const envelope: SportsPredictionEnvelope = Object.freeze({
    ...input,
    schemaVersion: SPORTS_PREDICTION_ENVELOPE_SCHEMA_VERSION,
    subject: Object.freeze({ ...input.subject }),
    model: Object.freeze({ ...input.model }),
    distribution: Object.freeze({
      outcomes: Object.freeze(
        input.distribution.outcomes.map((outcome) =>
          Object.freeze({
            ...outcome,
            metadata: outcome.metadata
              ? Object.freeze({ ...outcome.metadata })
              : undefined,
          }),
        ),
      ),
    }),
    calibration: Object.freeze({ ...input.calibration }),
    uncertainty: Object.freeze({
      ...input.uncertainty,
      notes: input.uncertainty.notes
        ? Object.freeze([...input.uncertainty.notes])
        : undefined,
    }),
    resolution: Object.freeze({ ...input.resolution }),
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    provenance: Object.freeze({
      ...input.provenance,
      sourceEnvelopeIds: input.provenance.sourceEnvelopeIds
        ? Object.freeze([...input.provenance.sourceEnvelopeIds])
        : undefined,
    }),
    allowedUses: Object.freeze([...input.allowedUses]),
    authority: Object.freeze({
      decision: "INTELLIGENCE_ONLY",
      coachingExecution: "NONE",
      bettingExecution: "NONE",
      financialExecution: "NONE",
    }),
  });

  assertSportsPredictionEnvelope(envelope);
  return envelope;
}
