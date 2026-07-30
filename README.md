# LPM Organizational Graph

The LPM Organizational Graph is a governed, temporal model of how an organization operates across people, governed agents, roles, ownership, supervision, delegated authority, decisions, policies, controls, systems, information, evidence, actions, and outcomes.

**Status: v0.1.0, Phase 1A. Domain package only. No production persistence, no network service, no Lapemo integration.**

---

## 1. What this is

A portable TypeScript domain package that makes organizational authority computable. It answers one question end to end:

> Did a governed agent have legitimate organizational authority to make a specific decision, use the required information, invoke enterprise systems, and produce an outcome, and who is the accountable human?

It answers that question deterministically, from typed graph data, with a reason code and a clearing predicate for every failure.

## 2. Strategic role in the Lapemo Systems portfolio

- **Lapemo Systems LLC** is the legal company and portfolio owner.
- **Large People Model** is the framework, science, and language.
- **The Organizational Graph** is the governed, temporal organizational-intelligence substrate. This repository builds it.
- **Lapemo** is the Organizational Intelligence Platform that consumes the graph.
- **Knowledge Objects** are the governed product primitive, owned by `lpm-knowledge-objects`.

## 3. Relationship to the Large People Model

The Large People Model explains how organizations should operate. The Organizational Graph models how they actually operate. Two framework axioms are enforced here as executable rules rather than stated as philosophy:

> You cannot govern what you have not owned. You cannot automate what you have not governed.

> A tool cannot own an outcome. A human always does.

The first becomes AUTH-001, AUTH-002, and AUTH-006. The second becomes AUTH-011.

## 4. Relationship to the Lapemo platform

Lapemo owns its application records, runtime persistence, formula layer, audit implementation, condition-family registry, and production workflows. This package owns portable domain contracts and deterministic evaluation.

**There is no second writable source of truth.** Where Lapemo already owns a relationship, the graph projects it read-only. Where nothing models a concept at all, the graph is canonical. The split is machine-readable in the relationship contract registry.

Phase 1A ships adapter **interfaces** only. There is no Lapemo connection, no shared database access, and no migration.

## 5. Relationship to Organizational Context Services

Organizational Context Services is a **proposed future contract and roadmap concept**. It does not exist in the Lapemo ecosystem today. This repository defines typed request and response shapes for it so the graph and any future service stay aligned, and builds no service, endpoint, authentication layer, or deployment.

Do not read anything in this repository as a claim that Organizational Context Services currently exists.

## 6. What the Organizational Graph is

A governed representation of organizational coordination, authority, accountability, and execution lineage. Temporal from its first release: every material fact carries when it held in the organization and when the graph knew it.

## 7. What it is not

- Not a generic knowledge graph. A knowledge graph describes what an organization knows. The Organizational Graph describes how the organization is authorized, governed, coordinated, and accountable when work is performed.
- Not an org chart.
- Not an enterprise search index.
- Not merely an agent registry.
- Not a second copy of the Lapemo database.

## 8. The initial authority-lineage use case

A governed procurement agent receives a request to approve a purchase from a new vendor for USD 42,000.

- The agent may approve purchases up to USD 25,000.
- Purchases involving new vendors require human review.
- The procurement director is the accountable owner and the supervisor.
- The agent holds ERP permission to approve purchases up to USD 100,000.
- Vendor risk classification is missing.
- The agent attempts to proceed without escalation.

The evaluator returns `NOT_AUTHORIZED` with `FINANCIAL_LIMIT_EXCEEDED`, `PERMISSION_AUTHORITY_MISMATCH`, `MISSING_HUMAN_REVIEW`, and `MISSING_REQUIRED_INFORMATION`, plus the accountable human, the supervisor, and the full delegation chain to its board resolution. The result is produced by seeded data, traversal, temporal checks, and deterministic rules. Nothing is hardcoded.

## 9. Framework layer alignment

The first vertical slice contributes to the canonical framework layers through:

| Layer | Contribution |
|---|---|
| Identity & Incentives | Person, Role, RoleAssignment, ownership, supervision, sponsorship, business purpose |
| Decision Architecture | DecisionType, DecisionEvent, AuthorityGrant, AutonomyState, escalation, gates |
| Communication Architecture | Escalation paths and review requirements. Deliberately narrow in v0.1 |
| Information Ecology | InformationAsset, EvidenceObject, authoritativeness, freshness, provenance |
| Platform Structure | EnterpriseSystem, SystemPermission, ActionEvent |
| Governance Architecture | Policy, Control, Exception, effective dates, review |
| AI Amplification | Governed agents, model identity, earned autonomy, machine action |

Layer names are consumed from canon. Layer shorthand codes never appear on a rendered surface.

## 10. Architecture summary

```text
  fixtures / adapters            domain                       evaluation
  ------------------             ------                       ----------
  InMemoryGraphRepository  -->   GraphRepository port  -->   AuthorityEvaluator
  LapemoProjectionPort           node + edge contracts        12 authority rules (pure)
  AutonomyCeilingProvider        relationship registry        reason codes + clearing predicates
  (Phase 1B implements)          temporal contracts           deterministic precedence
                                                              |
                                                              v
                                                        GraphQueryService
                                                        (QRY-001 to QRY-008)
```

Resolution is asynchronous and touches the repository. Rules are synchronous and pure. That separation is what makes evaluation deterministic and every rule independently testable.

## 11. Core domain objects

Organization, OrganizationalUnit, Person, Role, RoleAssignment, Agent, AutonomyState, DecisionType, AuthorityGrant, DecisionEvent, ActionEvent, Policy, Control, EvidenceObject, InformationAsset, EnterpriseSystem, SystemPermission, Outcome, Exception.

`Person` is the canonical organizational actor. Every accountability chain terminates at a Person. `Human` is a rejected alias, recorded in `docs/ONTOLOGY.md`.

## 12. Core relationships

Forty two typed edge types, each with exactly one canonical direction and a machine-readable contract. There are no reversed aliases: `OWNS` exists and `OWNED_BY` does not, because traversal handles direction.

Load-bearing edges: `ACCOUNTABLE_FOR`, `SUPERVISES`, `GRANTS`, `AUTHORIZES`, `DERIVED_FROM`, `HAS_PERMISSION`, `AUTHORIZED_BY`, `USES`, `SUPERSEDES`.

Full direction conventions and the ownership split are in `docs/ONTOLOGY.md`.

## 13. Repository structure

```text
src/
  canon/         pinned canonical values, the only place a canon string is written
  domain/        nodes, edges, enums, identity, ontology registry and validation
  graph/         repository port, temporal contracts, traversal, query services
  authority/     reason codes, rules, precedence, status, evaluator
  evidence/      completeness, confidence and provenance
  adapters/
    memory/      the in-memory repository used by tests and the demonstration
    lapemo/      read-oriented port contracts, autonomy and risk mappings
  context/       Organizational Context Services proposed contract, types only
  fixtures/      the synthetic procurement scenario and its named variants
  cli/           the authority lineage demonstration
docs/            architecture, ontology, ADRs, integration blockers
scripts/         ontology, lineage and voice validation
tests/           unit and acceptance suites
```

## 14. Local setup

```bash
pnpm install
```

Node 20 or later. There are **zero runtime dependencies**.

## 15. Environment configuration

None required. Phase 1A reads no environment variable, opens no connection, and needs no secret. `.env.example` documents this deliberately.

## 16. Database setup

**There is no database in Phase 1A.** No Prisma schema, no migrations, no connection string, no Docker service.

The hard boundary from the Phase 0 assessment stands: this repository, its code, tests, migrations, seeds, demonstrations, and CI never connect to the shared Supabase instance used by Lapemo. Phase 1A satisfies that boundary by having no persistence at all. Phase 1B adds persistence only through an approved Lapemo migration, behind the adapter contracts.

## 17. Seed and demonstration commands

```bash
pnpm demo:authority-lineage
```

Loads the synthetic procurement scenario, validates it, evaluates it, prints a readable summary and the full JSON result. Exits `0` when the evaluator runs, whatever business answer it produces. A `NOT_AUTHORIZED` result is a successful run.

## 18. Testing commands

```bash
pnpm test              # unit tests
pnpm test:acceptance   # acceptance tests
pnpm test:all          # both
```

## 19. Validation commands

```bash
pnpm validate:ontology   # registry completeness, fixture conformance, canon alignment
pnpm validate:lineage    # supersede lineage, temporal integrity, delegation, reconstruction
pnpm validate:voice      # canon voice rules, enforced mechanically
```

`validate:ontology` verifies the pinned canon values against a sibling `../lpm-canon` checkout when one is present, and reports a **skip loudly** when it is not. A skipped check is never treated as a passing one.

## 20. Example authority-lineage result

```text
Status                NOT_AUTHORIZED

Accountable human     person-dana-whitfield
Supervisor            person-dana-whitfield

AUTHORITY LINEAGE
  grant-director-to-agent  granted by person-dana-whitfield
    grant-cfo-to-director  granted by person-marcus-reed
      grant-board-to-cfo   granted by person-alice-nakamura  [source: BOARD_RESOLUTION]

VIOLATIONS
  FINANCIAL_LIMIT_EXCEEDED  (AUTH-003, BLOCKING)
      What happened   The decision commits USD 42,000 against an authority limit of USD 25,000.
      Clears when     The matching grant has financialLimit of null, OR the decision event
                      carries no financial amount, OR financialLimit.currency equals
                      financialAmount.currency AND financialLimit.amount is greater than or
                      equal to financialAmount.amount.

  PERMISSION_AUTHORITY_MISMATCH  (AUTH-005, BLOCKING)
      What happened   Technical permission erp.purchase_order.approve permits up to
                      USD 100,000 while organizational authority stops at USD 25,000.
```

## 21. Governance model

Ontology changes require a documented problem, the proposed object or edge, affected layers, compatibility, migration impact, evidence, owner, and the decision required. New ontology concepts require documented evidence. Generic nodes are not created where a canonical object exists.

Numeric thresholds, weights, and confidence defaults are **owner decisions**. They are proposed in ADRs and marked as requiring ratification, never asserted as settled.

See `docs/GOVERNANCE.md`, `CONTRIBUTING.md`, and `CODEOWNERS`.

## 22. Contribution expectations

Every pull request documents ontology impact, rule impact, migration impact, tests, documentation, and security and privacy impact. Every quality gate passes before merge. No suppressed type errors, no placeholder assertions.

## 23. Roadmap

1. **Foundation, this release.** Ontology, temporal contracts, authority evaluator, queries, fixtures, demonstration.
2. **Lapemo integration.** Adapter implementation and an approved migration for the new graph concepts.
3. **Organizational observation.** Continuous evaluation over real organizational data.
4. **Organizational Context Services.** The proposed service surface, if approved.
5. **Enterprise graph runtime.**

Phase 1B is gated. See `docs/INTEGRATION_BLOCKERS.md`.

## 24. Security and privacy posture

- No shared database connection, in any environment, ever.
- No secrets. Phase 1A reads no environment variable.
- Synthetic fixtures only. No real organization, person, vendor, system, or amount appears anywhere in this repository.
- All traversal is organization-scoped. There is no cross-organization path.
- No hard deletes. Records are superseded or voided, never destroyed.

See `docs/SECURITY_AND_PRIVACY.md`.

## 25. Repository status and maturity

**v0.1.0, Phase 1A.** Production-quality foundation with a narrow scope. The evaluator, ontology, temporal model, queries, and contracts are complete and tested. Persistence and platform integration are deliberately absent and gated behind Phase 1B.

## 26. Ownership and copyright

Copyright 2026 Lapemo Systems LLC. All rights reserved. Proprietary and confidential. See `LICENSE`.
