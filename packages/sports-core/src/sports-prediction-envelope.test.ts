import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { EvidenceRef } from "./index";
import {
  assertSportsPredictionEnvelope,
  buildSportsPredictionEnvelope,
} from "./sports-prediction-envelope";

const evidence = [
  {
    evidenceId: "evidence:1",
    sourceType: "official_feed",
    observedAt: "2026-09-19T20:00:00Z",
  } as EvidenceRef,
];

function validInput() {
  return {
    envelopeId: "sport-pred:1",
    sport: "tennis" as const,
    subject: { subjectId: "match:1", kind: "match" as const },
    informationCutoff: "2026-09-19T20:00:00Z",
    issuedAt: "2026-09-19T20:01:00Z",
    model: {
      modelId: "tennis-baseline",
      modelVersion: "1.0.0",
      methodologyVersion: "1",
      featureSnapshotHash: "feature-hash",
    },
    distribution: {
      outcomes: [
        { outcomeId: "p1", label: "Player 1", probability: 0.55 },
        { outcomeId: "p2", label: "Player 2", probability: 0.45 },
      ],
    },
    calibration: {
      status: "CALIBRATED" as const,
      sampleSize: 250,
      brierScore: 0.18,
      evaluatedAt: "2026-09-18T20:00:00Z",
    },
    uncertainty: {
      aleatoric: 0.3,
      epistemic: 0.2,
      overall: 0.25,
    },
    resolution: {
      type: "BINARY" as const,
      authority: "official-result-feed",
      ruleVersion: "1",
    },
    evidenceRefs: evidence,
    provenance: {
      inputSnapshotHash: "input-hash",
      evidenceSnapshotHash: "evidence-hash",
      generatedBy: "sports-prediction-core",
    },
    allowedUses: [
      "ANALYSIS",
      "SIMULATION_BASELINE",
      "COACHING_CONTEXT",
      "MONEY_RESEARCH_INPUT",
    ] as const,
  };
}

describe("SPORT-PRED-01 canonical envelope", () => {
  it("creates an immutable intelligence-only envelope", () => {
    const envelope = buildSportsPredictionEnvelope(validInput());
    assert.equal(envelope.schemaVersion, "SPORT-PRED-01");
    assert.equal(envelope.authority.decision, "INTELLIGENCE_ONLY");
    assert.equal(envelope.authority.bettingExecution, "NONE");
    assert.equal(envelope.authority.financialExecution, "NONE");
    assert.ok(Object.isFrozen(envelope));
    assert.ok(Object.isFrozen(envelope.distribution.outcomes));
  });

  it("rejects unsupported schema versions", () => {
    const envelope = buildSportsPredictionEnvelope(validInput());
    assert.throws(
      () =>
        assertSportsPredictionEnvelope({
          ...envelope,
          schemaVersion: "SPORT-PRED-99" as never,
        }),
      /SCHEMA_VERSION_UNSUPPORTED/,
    );
  });

  it("rejects probability mass that does not sum to one", () => {
    const envelope = buildSportsPredictionEnvelope(validInput());
    const invalid = {
      ...envelope,
      distribution: {
        outcomes: [
          { outcomeId: "p1", label: "Player 1", probability: 0.8 },
          { outcomeId: "p2", label: "Player 2", probability: 0.8 },
        ],
      },
    };
    assert.throws(
      () => assertSportsPredictionEnvelope(invalid),
      /PROBABILITY_MASS_INVALID/,
    );
  });

  it("rejects future information leakage", () => {
    const envelope = buildSportsPredictionEnvelope(validInput());
    assert.throws(
      () =>
        assertSportsPredictionEnvelope({
          ...envelope,
          informationCutoff: "2026-09-20T00:00:00Z",
        }),
      /FUTURE_INFORMATION_CUTOFF/,
    );
  });

  it("rejects any claimed execution authority", () => {
    const envelope = buildSportsPredictionEnvelope(validInput());
    assert.throws(
      () =>
        assertSportsPredictionEnvelope({
          ...envelope,
          authority: {
            ...envelope.authority,
            financialExecution: "BROKER" as never,
          },
        }),
      /EXECUTION_AUTHORITY_FORBIDDEN/,
    );
  });
});
