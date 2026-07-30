# ADR-002. Storage model: package and adapter, no persistence in Phase 1A

**Status:** Accepted, Phase 1A.

## Decision

Ship v0.1.0 with **no database of its own**. No Prisma schema, no migrations, no connection string, no service container. The package owns portable domain contracts, deterministic evaluation, and adapter interfaces. Persistence arrives in Phase 1B through an approved Lapemo migration.

The only repository implementation shipped is in-memory.

## Why

The Phase 0 assessment found the first vertical slice divides cleanly into two groups, and neither justifies a standalone datastore now.

**Group A, already owned and enforced by Lapemo:** Organization, OrganizationalUnit, Person, Agent, DecisionType, DecisionEvent, Control, EnterpriseSystem, Outcome, Exception. Creating writable tables for any of these would create exactly the second source of truth that anti-drift rule 19 prohibits.

**Group B, exists nowhere:** AuthorityGrant, SystemPermission as an actor-facing concept, AutonomyState as a temporal lineage-backed record, and the typed edge model.

The tempting move is to put Group B in a new graph database. That is wrong for a specific reason: **Group B is load-bearing runtime governance.** An authority grant that blocks a governed agent's decision has to be enforced where decisions are actually executed, which is the platform. A graph-owned authority store the platform does not read is decorative. One the platform does read is a second runtime dependency introduced without an integration decision. Neither is acceptable in a first release.

## Consequences

**Costs.** The demonstration runs on fixtures rather than a seeded database. The graph is a library rather than a running store until Phase 1B. There is no persistence integration test, because there is no persistence.

**Benefits.** No dual-write risk exists by construction. The shared-database boundary is satisfied absolutely rather than by guard rails. Tests and the demonstration run anywhere with no infrastructure. The Phase 1B persistence decision is made with the backend data profile in hand rather than ahead of it.

## Rejected

**A standalone graph datastore for Group B now.** Defensible, but it pulls the integration decision forward without the backend profile that should inform it, and risks a store the platform never reads.

**Writable tables for Group A.** Prohibited. Two writable truths for one relationship is the failure mode this repository exists to prevent.

**Waiting for Phase 1B to define any contract.** Rejected. The contracts are what make the Phase 1B migration reviewable.
