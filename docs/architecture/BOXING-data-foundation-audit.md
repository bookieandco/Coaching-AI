# Boxing Data Foundation Audit

## Purpose

These references are inputs to the Boxing coaching build, not dependencies. Their useful capabilities are normalized into Coaching-AI contracts so the product can swap data sources without coupling the coaching layer to any one repository.

## Source audit

### 1. SERP AI — boxing punch recognition dataset

Repository: `serp-ai/boxing-punch-recognition-dataset`

Useful contribution:
- Labeled professional-match punch data intended for computer-vision training.
- Punch recognition/classification is the first layer of a real-time punch tracking pipeline.
- The project explicitly targets boxing analytics and downstream AI applications.

Coaching-AI extraction:
- `PunchObservation` vocabulary.
- Frame/clip-level evidence references.
- Punch class + actor + temporal span.
- Dataset provenance and annotation confidence.
- Training/evaluation split metadata.

Do not copy into the coaching domain:
- Dataset-specific label IDs.
- CVAT implementation details.
- Any claim that a recognized punch was effective unless independently supported by impact/target evidence.

### 2. Boxing Undefeated — open boxing data

Repository: `boxingundefeated/open-boxing-data`

Useful contribution:
- Open boxing record/data model direction.
- Historical fighter/fight data collection.
- Scraping/aggregation as an ingestion concern.
- Emphasis on open schema, open data, source cross-reference, and validation.

Coaching-AI extraction:
- Fighter identity resolution.
- Fight identity and historical record.
- Source provenance.
- Cross-source reconciliation.
- Historical performance context.
- Data quality state: observed, corroborated, disputed, stale, unknown.

Do not treat scraped data as ground truth. Every imported fact remains attributable to a source and can be revised.

### 3. ACM40960 — real-time boxing action interpreter

Repository: `ACM40960/Boxing`

Useful contribution:
- YOLO pose/keypoint extraction.
- Temporal LSTM action classification.
- Punch classes: jab, cross, hook, uppercut.
- Defensive classes: forearm block, high guard, parry.
- Two-player sparring analysis.
- Hit/miss estimation.
- Real-time inference and augmentation pipeline.
- Explicit limitations around 2D geometry, camera angle, occlusion, and target-zone estimation.

Coaching-AI extraction:
- `PoseObservation` as evidence, never as the final tactical interpretation.
- `ActionObservation` with temporal confidence.
- Separate offensive and defensive event streams.
- Interaction-level evidence for two-fighter analysis.
- Camera-quality/occlusion metadata.

Important architectural rule:
A classifier saying `hook` is an observation. Whether it landed, why it landed, whether it created an opening, and whether the opponent will adapt are downstream inference/scenario questions.

### 4. Springboard Boxing Prediction Web App

Repository: `EmmS21/SpringboardCapstoneBoxingPredictionWebApp`

Useful contribution:
- Historical boxing data cleaning/enrichment.
- Punch-stat enrichment.
- Outcome prediction workflow.
- Random-forest modeling.
- Fighter comparisons and division/rank visualizations.

Coaching-AI extraction:
- Historical baseline features.
- Fighter comparison features.
- Outcome baseline as a prediction input.
- Model-versioned baseline reference.

Do not reuse prediction output as coaching advice. The prediction layer establishes a baseline; the coaching layer tests interventions against that baseline.

## Canonical ingestion chain

`RAW VIDEO / HISTORICAL DATA`
→ `SOURCE RECORD`
→ `OBSERVATION`
→ `NORMALIZED EVENT`
→ `FIGHT STATE`
→ `FIGHTER INTELLIGENCE`
→ `MATCHUP MODEL`
→ `PREDICTION BASELINE`
→ `COACHING INTERVENTION`
→ `OPPONENT RESPONSE`
→ `COUNTERFACTUAL`
→ `WIN / FAILURE PATH`

## Evidence hierarchy

1. Direct observed event from synchronized video/sensor evidence.
2. Independently corroborated structured event/statistic.
3. Model-derived inference.
4. Historical analogy.
5. Scenario assumption.

The UI and storage model must preserve this distinction.

## New build target

The four references justify adding a dedicated **Boxing Observation Layer** before the opponent-response engine:

- punch observations
- defensive observations
- pose observations
- target/impact observations
- temporal windows
- actor identity
- camera/source quality
- annotation/model confidence
- evidence references

This layer feeds the existing fighter intelligence and tactical scenario layers without contaminating them with dataset-specific schemas.
