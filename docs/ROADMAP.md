# Roadmap

## Phase 1A. Foundation (this release, v0.1.0)

**Delivered.** Ontology and typed domain contracts, edge direction conventions, temporal and append-only supersede contracts, the deterministic authority evaluator, primary status and reason-code separation with a clearing predicate for every code, the in-memory repository, Lapemo adapter interfaces, the synthetic procurement scenario, the eight required queries, the authority-lineage demonstration, unit and acceptance tests, ontology, lineage and voice validation, CI with no database or deployment dependency, the integration blocker register, and version markers.

**Deliberately absent.** Persistence, migrations, any database, any Lapemo connection, any network service.

## Phase 1B. Lapemo integration

Gated. Every blocker in `INTEGRATION_BLOCKERS.md` must be dispositioned first, and a separate Phase 1B directive must be approved.

Scope, once unblocked:

1. Implement `LapemoIntegrationPort` against Lapemo-owned persistence.
2. Propose a reviewed Lapemo migration for the concepts that exist nowhere: AuthorityGrant, SystemPermission as an actor-facing concept, AutonomyState with lineage, and the typed edge model.
3. Projection invariant tests: purity, no write path, and repair detection that reports divergence rather than correcting it.
4. Backend data profiling and data-quality remediation.

## Phase 2. Organizational observation

Continuous evaluation across real organizational data. Lineage-gap detection at scale. Feeding the platform signal fabric with graph-derived conditions through the condition-family mapping.

## Phase 3. Organizational Context Services

Only if the term is ratified in canon and the service is approved. The contract types already exist; the service surface does not, and building it is not authorized.

## Phase 4. Enterprise graph runtime

Evaluated on evidence, not assumed. A native graph store is added only if traversal performance against real data proves it necessary, never for visual appeal.

---

Do not build later phases now. Each one begins with its own approved directive.
