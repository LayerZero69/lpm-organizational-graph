# ADR-005. Confidence semantics and source precedence

**Status:** Accepted for scale and propagation. **All numeric defaults require owner ratification.**

## Decision

### Scale

A single 0.0 to 1.0 scale everywhere, on every node, every edge, and every evaluation result.

Chosen because every existing confidence-shaped field in the Lapemo platform already uses it: the external entity mapping confidence, the decision-type gate threshold, the recorded AI confidence score, and the agent confidence score. Introducing a second scale would guarantee a conversion defect at the first integration.

### Propagation: minimum along the path

A conclusion is never more trustworthy than the least trustworthy fact it rests on.

Averaging was rejected because it lets a single unreliable link disappear into a comfortable-looking number. If an authority chain rests on one edge with 0.3 confidence, the answer is 0.3, not a reassuring 0.85.

### Source precedence, encoded not commented

**A stored artifact with lineage outranks a derived copy without lineage**, regardless of which looks more current.

This is implemented as `compareProvenance`, an executable comparator, rather than stated as a comment. The ordering is: lineage first, then confidence, then recency. A unit test asserts that a lower-confidence older artifact with lineage beats a higher-confidence fresher copy without it.

### Unresolved identity degrades confidence

A `sourceRef` whose resolution status is not `CONFIRMED` applies a penalty. A `REJECTED` mapping drops confidence to zero. An unconfirmed cross-system identity is a real uncertainty about whether two records describe the same thing, and it must not silently resolve.

`UNRESOLVED_SOURCE_IDENTITY` also fires as a warning so the reason is visible, not just the number.

## Proposed defaults, requiring ratification

`PROPOSED_CONFIDENCE_DEFAULTS` carries an explicit `ownerRatificationRequired: true`. Nothing in the evaluator hardcodes a value; every default arrives through that object so a ratified set replaces them in one edit.

| Situation | Proposed |
|---|---|
| Human asserted with evidence | 0.95 |
| Human asserted without evidence | 0.80 |
| Connector synced, identity confirmed | 0.90 |
| Connector synced, identity unconfirmed | 0.50 |
| Inferred rather than observed | 0.40 |
| Unresolved identity multiplier | 0.60 |

**These are proposals.** Numeric thresholds and weights are owner decisions and are never set unilaterally by an implementer.

## Open

Whether derived confidence should be computed from source and evidence with per-class weights, rather than the flat defaults above. Deferred until backend profiling shows what confidence data actually exists.

## Rejected

**A zero to one hundred scale.** Conflicts with every existing platform field.

**Averaging along a path.** Hides the weakest link.

**Treating a missing confidence as 1.0.** Absence of evidence is not certainty. A missing value means the record must supply one; validation rejects an out-of-range value rather than defaulting it.
