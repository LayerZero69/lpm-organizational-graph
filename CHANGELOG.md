# Changelog

All notable changes to this repository.

## 0.1.0, 2026-07-30

First release. Phase 1A foundation.

### Versions

| Marker | Value |
|---|---|
| Package | 0.1.0 |
| Ontology | 0.1.0 |
| Rule set | 0.1.0 |
| Schema | 0.1.0 |
| Context contract | 0.1.0 |

### Added

**Ontology.** Nineteen node types and forty two edge types, each with a machine-readable relationship contract declaring allowed node pairs, a single canonical direction, cardinality, temporal overlap rules, evidence and confidence requirements, and the Lapemo record that owns the relationship where one exists. No reversed aliases.

**Temporal model.** Bitemporal-lite with valid time and record time, append-only supersede with explicit predecessor closure, and no hard deletes anywhere in the domain surface.

**Identity.** Three identifiers that are never conflated: source reference, logical identifier, and immutable version identifier, plus an explicit origin marker distinguishing a native version identity from a synthesized one.

**Authority evaluator.** Twelve rules, AUTH-001 through AUTH-012, as pure deterministic functions. Thirty four reason codes, each with a documented clearing predicate and, where the platform owns an equivalent condition, the condition key it maps onto. Primary status separated from reason codes, with a total, order-independent precedence ladder.

**FINANCIAL_LIMIT_EXCEEDED** as an explicit machine-stable reason code with a precise clearing predicate, including the rule that a currency mismatch is reported rather than converted.

**Queries.** QRY-001 through QRY-008. QRY-007 returns supervisory structural facts only, with no capacity, utilization, or score, because that formula is owned by the Lapemo platform.

**Adapters.** An in-memory graph repository, and read-only Lapemo port contracts with no implementation. Explicit autonomy and risk mappings at the boundary.

**Organizational Context Services.** Typed request and response contracts with runtime validation, documented strictly as a proposed future contract. No service, no endpoint, no deployment.

**Fixtures.** The synthetic procurement scenario and thirteen named variants.

**Demonstration.** `pnpm demo:authority-lineage`, which reaches `NOT_AUTHORIZED` with four reason codes from seeded data, traversal, temporal checks and rules, with nothing hardcoded.

**Validation.** Ontology validation including live canon alignment against a sibling checkout, lineage validation including point-in-time reconstruction and a no-hard-delete assertion, and mechanical voice-rule enforcement.

**Tests.** 202 tests across unit and acceptance suites. No database, no service container, no network.

**CI.** Nine gates plus a standing boundary guard that fails if a persistence directory, a shared-backend reference, a connection string, or a committed env file ever appears.

**Documentation.** README, architecture, ontology, authority lineage, graph queries, context services, governance, integration, roadmap, security and privacy, the integration blocker register, and nine architecture decision records.

### Decisions recorded

- ADR-001 repository boundary, default branch `main`
- ADR-002 storage model, package and adapter with no persistence in Phase 1A
- ADR-003 temporal lineage, bitemporal-lite with append-only supersede
- ADR-004 authority evaluation, status and reason separation with deterministic precedence
- ADR-005 confidence semantics, single scale, minimum propagation, all numeric defaults requiring owner ratification
- ADR-006 risk semantics, semantic levels only, never a portable numbered tier
- ADR-007 identity and versioning
- ADR-008 Lapemo integration boundary, existing records canonical and edges projected
- ADR-009 autonomy boundary, canon authoritative with the platform enum mapped at the edge

### Deliberately absent

Persistence, migrations, any database, any Lapemo connection, any network service, any deployment. All are gated behind Phase 1B and the integration blocker register.

### Integration blockers recorded

Twelve, in `docs/INTEGRATION_BLOCKERS.md`. Three are blocking for Phase 1B: the platform autonomy enum shifted by one position relative to canon, the two opposing risk-tier numbering schemes live inside one repository, and unprofiled backend data.

### Reference commits

| Repository | Commit |
|---|---|
| `lpm-canon` | `d4d36e2fe1d1b0cebf06bbcebfff5806299e21e2` (v0.5.0) |
| `lpm-os-master` | `879508d932debe68bbdbbb4d49a4607045824a1a` |
| `lpm-knowledge-objects` | `9558417d8ec1c8d5d0196fd22fdbc57c09d5c6cc` |
| `lpm-ecosystem` | `0f8c4f0f7a47183f7ae1bcb57985601101313dcd` |
| `lpm-branding-material` | `d50a0c8709deba3be617d4bbdecdc793b265e54a` |

## Publication, 2026-07-30

### Repository

| Field | Value |
|---|---|
| Owner | `LayerZero69`, a personal GitHub `User` account, confirmed via `gh api user` and `gh api repos/LayerZero69/lpm-organizational-graph` (`owner_type: User`, `permissions.admin: true`) |
| Repository | `lpm-organizational-graph` |
| Remote URL | `https://github.com/LayerZero69/lpm-organizational-graph` |
| Visibility | Private, confirmed via `gh repo view` (`visibility: PRIVATE`) |
| Default branch | `main` |
| Created | 2026-07-30T16:35:29Z |

### Commit history

| Commit | Role |
|---|---|
| `82355cd` | Original Phase 1A implementation commit, as approved |
| `f8b4b9c` | Release-validation defect fix (below) |
| *(this commit)* | Publication closeout: `CODEOWNERS` resolved, this changelog entry. Its own SHA and the remote CI/branch-protection result are recorded in a follow-up metadata-only commit, since a commit cannot contain its own hash. |

### Release-validation defect fix (`f8b4b9c`)

While validating this directive's own claim that "unnamed risk schemes fail rather than default," `mapNumberedTier` was found to do the opposite: its scheme selection was a binary ternary (`RETENTION_TIER` or else `CLASSIFICATION_TIER`), so `undefined`, an empty string, a typo, or a lowercase variant all silently fell through to the classification table and returned a mapped level instead of throwing. That contradicted the function's own documented contract and ADR-006's stated guarantee that there is no default scheme.

Fixed by validating the scheme explicitly against the two known values and throwing `RiskMappingError` for anything else, with a regression test covering `undefined`, an empty string, an invalid name, and a case variant. No ontology, runtime, persistence, or Phase 1B change is included; the diff touches exactly `src/adapters/lapemo/risk-mapping.ts` and its test.

Test count after this fix: 203 (181 unit, 22 acceptance), up from 202. All nine local gates re-verified against this exact commit.

### Phase 1B status

**All twelve blockers remain open**, including the three hard blockers (autonomy enum conflict, opposing risk-tier schemes, unprofiled backend data). See `docs/INTEGRATION_BLOCKERS.md`. This publication does not constitute approval to begin Phase 1B.
