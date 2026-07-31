# Integration Blocker Register

Blockers that must be resolved before Phase 1B begins Lapemo integration or production schema work.

Every entry records the evidence, the impact, and what closing it requires. Nothing here was resolved silently in Phase 1A.

**Reference commits for every finding below:**

| Repository | Commit | Note |
|---|---|---|
| `lpm-canon` | `d4d36e2fe1d1b0cebf06bbcebfff5806299e21e2` | v0.5.0, tag `v0.5.0` |
| `lpm-os-master` | `879508d932debe68bbdbbb4d49a4607045824a1a` | branch `master` |
| `lpm-knowledge-objects` | `9558417d8ec1c8d5d0196fd22fdbc57c09d5c6cc` | branch `main` |
| `lpm-ecosystem` | `0f8c4f0f7a47183f7ae1bcb57985601101313dcd` | branch `program/ftr-10-active` |
| `lpm-branding-material` | `d50a0c8709deba3be617d4bbdecdc793b265e54a` | branch `main` |

---

## IB-001. Platform autonomy naming is shifted by one position relative to canon

**Severity: blocking for Phase 1B.**

Canon v0.5.0 defines the spectrum as Human Only, Human Approved, Agent Assisted, **Agent Supervised**, **Agent Autonomous**.

The platform Prisma enum is `HUMAN_ONLY, HUMAN_APPROVED, AGENT_ASSISTED, AGENT_AUTONOMOUS, AGENT_AUTONOMOUS_PLUS`. Position four is named `AGENT_AUTONOMOUS` but canonically **means Agent Supervised**. Position five is named `AGENT_AUTONOMOUS_PLUS` and canonically **means Agent Autonomous**.

Reading a platform value by its name rather than its position silently promotes a supervised governed agent to autonomous. That is a governance failure, not a labeling inconvenience.

Compounding evidence at the reference commit:

- The platform holds **two** autonomy representations that disagree with each other. The display module renders the canon labels against a numeric one to five scale, while the persisted enum carries the shifted names.
- A ratified platform ADR spells the stale names into its decision text, so correcting the enum also requires an ADR amendment.

**Handled in Phase 1A by:** `src/adapters/lapemo/autonomy-mapping.ts`, the only module permitted to name the legacy value. `AGENT_AUTONOMOUS_PLUS` never enters the domain package. `scripts/validate-voice.ts` enforces that mechanically.

**To close:** complete ecosystem deferred item D1, the autonomy enum migration, then delete the mapping module rather than editing it.

---

## IB-002. Risk tier is numbered in two opposite directions inside one repository

**Severity: blocking for Phase 1B.**

Two live numbering schemes exist in `lpm-os-master`, running in opposite directions:

| Scheme | Tier 1 means | Tier count | Evidence |
|---|---|---|---|
| Retention tier, the `RiskTier` database enum | **Most** severe | 3 | `TIER_1` maps to seven-year audit retention; the Supervisory Control Capacity input is documented as expecting 1 to 3 with 1 as highest risk |
| Classification tier, the risk-tiering module | **Least** severe | 4 | Tier 1 is "Automated Pass", rising to tier 4 "Human Only" |

A field named `riskTier` would silently inherit whichever scheme the reader assumed.

**Handled in Phase 1A by:** the graph uses semantic risk levels only, `LOW`, `MODERATE`, `HIGH`, `CRITICAL`. `src/adapters/lapemo/risk-mapping.ts` requires every caller to name its source scheme and **throws** on an unmapped tier rather than guessing. There is deliberately no default scheme.

**To close:** owner ratification of which scheme applies to which platform field, and whether the two need distinct field names.

---

## IB-003. Technical permission is connector-scoped, not actor-scoped

**Severity: high.**

The platform models technical permission as connector capability grants and connector data-access grants. Those are scoped to a **connector instance**, not to a governed agent or a person.

AUTH-005 and QRY-004 compare what the technology permits against what the organization authorized, which requires an **actor-facing** permission with an action list and, where the source system supports it, a financial or transaction limit. The platform records no financial limit on a permission at all.

**Handled in Phase 1A by:** `SystemPermission` as a graph-canonical node with a principal actor, permitted actions, scopes, and limits. `projectSystemPermissions` is declared on the projection port with this narrowing noted.

**To close:** decide whether Lapemo extends the connector grants with an actor-facing projection, or whether `SystemPermission` becomes a new Lapemo model in the Phase 1B migration.

---

## IB-004. The platform decision record has an authority field pointing at nothing

**Severity: medium.**

`DecisionRecord.authorityInvokedId` is a required string with **no foreign key and no target model**. It is the closest existing thing to an authority reference anywhere in the platform, and it currently references nothing schema-enforced.

**Handled in Phase 1A by:** the graph models `AUTHORIZED_BY` as a graph-canonical edge and **deliberately does not write** to the platform field. Backfilling a field whose semantics no one owns would create a dual write into an undefined target.

**To close:** decide whether the platform field becomes a real foreign key to `AuthorityGrant`, is deprecated, or is left as an opaque correlation string.

---

## IB-005. The platform has no first-class Role model

**Severity: medium.**

Role is expressed through loose strings: a person role field, a person title field, and an organization-member role field. There is no temporal role assignment record.

QRY-002 returns the roles the accountable person occupies, so the `OCCUPIES` projection from these strings is lossy.

**Handled in Phase 1A by:** `Role` and `RoleAssignment` as graph-canonical node contracts, with the lossiness recorded in the relationship contract for `OCCUPIES`.

**To close:** decide whether Role becomes a Lapemo model or remains graph-owned.

---

## IB-006. Organization scope is nullable on most platform models

**Severity: high.**

At the reference commit, 26 of 42 platform models carry a nullable organization identifier and exactly one carries a required one. A ratified platform ADR records the reason (backward compatibility with existing seed data and integration tests) and lists the consequence explicitly: data without an organization is globally visible. Row-level security is deferred.

The graph requires a non-empty organization identifier on every node and edge, and forbids cross-organization traversal.

**Handled in Phase 1A by:** validation rejects an unscoped node or edge, an edge that crosses an organizational boundary is a violation, and a scope mismatch produces `INDETERMINATE` rather than a business refusal.

**To close:** the adapter must reject unscoped inbound records rather than defaulting them, and the backend data profile must quantify how many records are affected.

---

## IB-007. The platform governed agent has no record versioning

**Severity: medium.**

Twenty platform models received a uniform record-lifecycle marker with supersede links. `Agent` did **not**. The platform governed agent has no record status, no supersede link, and no effective dates, so an agent mutates in place with no version history.

The graph requires append-only supersede lineage on every material node, including Agent.

**Handled in Phase 1A by:** graph-native identity with a logical identifier, an immutable version identifier, and a monotonic version number. The identity contract records `versionIdOrigin` as `SYNTHESIZED` when an adapter has to invent a version identity for a source that has none.

**To close:** decide whether the Phase 1B migration adds versioning to the platform agent, or whether the graph carries agent version history on its own.

---

## IB-008. Audit immutability is claimed but not enforced at the database

**Severity: medium, for accuracy of claims rather than for graph correctness.**

The platform audit model comment asserts that immutability is enforced at the PostgreSQL row-level security layer. **No migration in the repository contains any row-level security, policy, or trigger statement**, and a ratified ADR confirms row-level security is deferred. Audit immutability is currently an application-layer convention.

**Handled in Phase 1A by:** `docs/SECURITY_AND_PRIVACY.md` describes audit immutability accurately as an application convention rather than a database guarantee. The graph never writes audit records and never competes with the platform audit truth.

**To close:** platform work, outside this repository. Recorded so no graph document repeats the inaccurate claim.

---

## IB-009. Backend data reality is still unknown

**Severity: blocking for Phase 1B.**

Phase 0 could not safely profile the backend: no read-only role or path exists, the only documented connections are read-write application and migration roles, and no client was available. No connection was attempted.

Phase 1A does not need backend data, and **does not claim validation against production data**. Phase 1B does need it.

**To close:** run the owner-run SQL specification from the Phase 0 assessment, section 6, against a read-only session, and review the findings. The highest-value item is whether active governed agents already lack resolvable ownership.

---

## IB-010. Organizational Context Services is unratified language

**Status: closed by the Lapemo Organizational Context Services foundational
product directive v0.3.0.**

**Severity: low, but it affects public language.**

The phrase appears in no canon file, governance record, or product surface anywhere in the ecosystem.

**Handled in Phase 1A by:** documenting it strictly as a proposed future contract and roadmap concept, with the non-existence stated plainly in the README, in `docs/CONTEXT_SERVICES.md`, and in the contract module header. No service was built.

The directive establishes OCS as a portfolio capability downstream of
`lpm-canon`, with canon retaining precedence on every conflict. Public language
must preserve the category boundary: Lapemo remains the Organizational
Intelligence Platform; OCS is not a replacement category.

---

## IB-011. Where the graph sits in the product architecture is undecided

**Severity: low for Phase 1A, medium for public language.**

Canon defines a product spine with four named components. The Organizational Graph is not one of them, and canon carries a rule that the framework layers must not be presented as product architecture.

**Handled in Phase 1A by:** the README describes the graph's role in the portfolio using the authoritative company identity record, and does not assert a position inside the canon product spine.

**To close:** a canon decision.

---

## IB-012. Concurrent workspace activity during Phase 0 and Phase 1A

**Severity: process.**

A separate program run was active in the workspace during both phases. During Phase 1A the ecosystem repository advanced by one commit. That change was verified as documentation only: no governance file, company identity record, or cited decision text changed, and every other load-bearing repository stayed at its Phase 0 commit.

**Handled in Phase 1A by:** creating this repository as a clean sibling that cannot disturb the other repositories, and re-running the freshness gate before implementation.

**To close:** confirm the concurrent work is complete or isolated before Phase 1B begins, as the Phase 1A authorization requires.
