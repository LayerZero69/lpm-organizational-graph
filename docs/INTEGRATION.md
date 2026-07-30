# Integration

How Lapemo would consume this package, and where the boundaries sit.

**Phase 1A ships contracts only. There is no integration, no connection, and no migration.** Phase 1B is gated by `INTEGRATION_BLOCKERS.md`.

## 1. Consumption model

Lapemo imports `@lapemo/organizational-graph` as a private, tag-pinned dependency and implements the ports. The package is never published publicly.

It exports domain types, validation, the authority evaluator, the evaluation result contract, query interfaces, the repository interface, ontology and rule-set versions, the proposed context contracts, and the identity-mapping contracts.

## 2. The one interface Phase 1B implements

`LapemoIntegrationPort` composes every port. Implementing it is the entire integration surface, and the domain evaluator needs no change at all.

```text
LapemoIntegrationPort
  = LapemoProjectionPort      project records into nodes and edges
  + AutonomyCeilingProvider   supply the platform-derived ceiling
  + SupervisoryLoadPort       supply supervisory structural facts
  + ConditionFamilyPort       map reason codes to condition families
  + IdentityResolutionPort    resolve external identifiers
```

Every method is read-only.

## 3. What Lapemo keeps

Application records, runtime persistence, the formula layer, the audit implementation, the Condition Family Registry, and production workflows. This package must never become a second writable source of truth for any of them.

Specifically:

- **Audit.** The graph never writes an audit record and never competes with the platform audit truth.
- **Supervisory Control Capacity.** The graph returns structural facts; the platform owns every formula.
- **Autonomy ceilings.** The graph consumes a ceiling result; the platform owns the derivation.
- **Condition families.** The graph maps its reason codes onto platform families; the platform owns the evaluators and resolution policy.

## 4. Reason codes to condition families

`lapemoConditionKeyMap()` returns the mapping. Where a platform condition family already exists, the graph **maps** rather than reimplements:

| Graph reason code | Platform condition key |
|---|---|
| `UNOWNED_AGENT` | `ownership.entity_unowned` |
| `AMBIGUOUS_AGENT_OWNERSHIP` | `ownership.disputed` |
| `UNSUPERVISED_AGENT` | `agent.lost_supervision` |
| `AUTONOMY_EXCEEDS_DECISION_LIMIT` | `governance.autonomy_exceeds_ceiling` |
| `AUTONOMY_CEILING_BLOCKED` | `ownership.decision_domain_unowned` |
| `UNEARNED_AUTONOMY_LEVEL` | `agent.confidence_gate_rollback` |
| `NON_AUTHORITATIVE_SOURCE` | `knowledge.ai_retrieval_ungoverned` |
| `STALE_INFORMATION` | `knowledge.overdue_audit` |

Codes with no mapping are genuinely new conditions that no platform family covers, including the entire authority, delegation and permission-alignment surface. They are left unmapped rather than forced into an ill-fitting family, and a unit test asserts that.

The join is the **clearing predicate**, not the label. That is the platform's own rule: the identity of a condition is what makes it false.

## 5. The autonomy boundary

Canon is authoritative. The platform enum is shifted by one position at its top two values.

| Platform value | Canon position | Canon meaning | Name is misleading |
|---|---|---|---|
| `HUMAN_ONLY` | 1 | Human Only | no |
| `HUMAN_APPROVED` | 2 | Human Approved | no |
| `AGENT_ASSISTED` | 3 | Agent Assisted | no |
| `AGENT_AUTONOMOUS` | 4 | **Agent Supervised** | **yes** |
| `AGENT_AUTONOMOUS_PLUS` | 5 | **Agent Autonomous** | **yes** |

`src/adapters/lapemo/autonomy-mapping.ts` is the only module permitted to name the legacy value. The retired level never enters the domain package, and `validate:voice` enforces that mechanically.

When ecosystem deferred item D1 lands, this mapping collapses to an identity and the module is deleted rather than edited.

## 6. The risk boundary

Two live platform schemes run in opposite directions. Every adapter must name its scheme; there is no default and an unmapped tier throws.

| Scheme | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---|---|---|---|
| `RETENTION_TIER` | `CRITICAL` | `HIGH` | `MODERATE` | does not exist |
| `CLASSIFICATION_TIER` | `LOW` | `MODERATE` | `HIGH` | `CRITICAL` |

Tier 1 means the **most** severe thing in one scheme and the **least** severe in the other. A unit test asserts they differ, so nobody can quietly collapse them.

## 7. Projection rules

An edge whose relationship Lapemo owns carries `isProjection: true` and is never written back. Ownership is per source node type, in the relationship contract registry.

Required invariant tests for Phase 1B:

1. Projection is pure: identical platform input always yields identical edges.
2. No adapter code path writes to Lapemo.
3. A divergence between a projected edge and its source record is **reported**, never silently corrected.

## 8. Identity mapping

Three identifiers, never conflated: `sourceRef`, `logicalId`, `versionId`.

The platform has no version identifier anywhere. Its supersede chains give lineage while the row mutates in place, so an adapter synthesizes a version identity and must record `versionIdOrigin: 'SYNTHESIZED'`. A consumer has to be able to tell a real version identity from a synthesized one.

The platform's external entity mapping already implements the `sourceRef` idea, including a resolution status. The graph reuses those semantics rather than inventing a parallel vocabulary, and carries the resolution status through so an unconfirmed mapping degrades confidence instead of silently resolving.

## 9. Organization scoping

The graph requires a non-empty organization identifier on every node and edge and forbids cross-organization traversal.

Most platform models carry a nullable organization identifier. The adapter must **reject** an unscoped inbound record rather than defaulting it. A scope mismatch produces `INDETERMINATE`, not a business refusal.

## 10. What is not permitted, in any environment

- Connecting to the shared Supabase instance from this repository, its tests, its demonstrations, or its CI.
- Copying shared credentials anywhere.
- Writing to any Lapemo-owned record.
- Creating a second writable source of truth for a Lapemo-owned entity, relationship, audit record, formula, condition family, or Knowledge Object.
