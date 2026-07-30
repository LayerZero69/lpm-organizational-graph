# ADR-008. Lapemo integration boundary

**Status:** Accepted, Phase 1A. Implementation deferred to Phase 1B.

## Decision

**Relationship source of truth: the existing Lapemo record or foreign key is canonical, and the graph edge is a derived projection.**

Where a relationship exists nowhere in the ecosystem, the graph edge is canonical.

Uncontrolled dual writes are prohibited. Atomic dual maintenance is **not** used for any relationship in Phase 1A, because it would require a transaction spanning two stores and the database boundary forbids that by construction.

## How the split is enforced

`lapemoSourceOfTruth` in the relationship contract registry, keyed **by source node type**.

Ownership is per source type rather than per edge type because one edge type can be canonical here for one pair and a projection for another. `COVERS` is the proving case: an authority grant covering a decision type exists nowhere else, while a control covering a decision type is platform-owned.

Validation fails in **both** directions:

- `EDGE_SHOULD_BE_PROJECTION`: a Lapemo-owned relationship not marked as a projection. This is a dual write waiting to happen.
- `EDGE_FALSE_PROJECTION`: a graph-canonical edge claiming to be a projection of a record that does not exist.

Both were caught by the validator against the initial fixture set during Phase 1A, which is the evidence that the check works.

## Canonical assignments

**Lapemo canonical, projected here:** accountable ownership, supervision, ownership, role occupancy, line management, structural containment, final decision actor, decision type instance, technical permission holding and its system, agent platform operation, escalation, information source, and authoritative-for.

**Graph canonical:** the entire authority surface (grants, authorization, delegation, revocation, limits), evidence support, information use, decision-to-action, outcome production, sponsorship, and technical ownership.

## The decision-record authority field

`DecisionRecord.authorityInvokedId` in the platform is a required string with **no foreign key and no target model**. It is the closest existing thing to an authority reference and currently points at nothing schema-enforced.

The graph models `AUTHORIZED_BY` as a graph-canonical edge and **deliberately does not write** that platform field. Backfilling a field whose semantics no one owns would create a dual write into an undefined target. Recorded as IB-004.

## What Lapemo keeps, absolutely

- **Audit.** The graph never writes an audit record. A second audit truth is prohibited.
- **Formulas.** Supervisory Control Capacity and every gate or weighting formula stay in the platform formula layer. The graph returns structural facts, and a unit test asserts that no capacity, utilization or score field exists in the return type.
- **Condition families.** The graph maps its reason codes onto platform families through `conditionKey`. It does not duplicate condition logic.
- **Autonomy ceilings.** The graph consumes a ceiling result. The derivation is ratified and platform-owned.

## Required Phase 1B invariant tests

1. Projection is pure: identical platform input always produces identical edges.
2. No adapter code path writes to Lapemo.
3. Divergence between a projected edge and its source record is **reported**, never silently corrected.

## Rejected

**Graph edges canonical with platform foreign keys as derived projections.** Would require the platform to read the graph to enforce its own invariants, which is a runtime dependency no one has approved.

**Atomic dual maintenance.** Requires a cross-store transaction the database boundary forbids.

**Deciding per relationship case by case at implementation time.** That is how dual writes appear. The registry decides it once, as data, and validation enforces it.
