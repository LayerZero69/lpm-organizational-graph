# Ontology

The typed node and edge contracts, the direction conventions, and the ownership split between this graph and the Lapemo platform.

The machine-readable form is `src/domain/ontology/registry.ts`. This document explains it. Where the two disagree, the registry wins, and `pnpm validate:ontology` enforces it.

## 1. Node contract

Every material node carries:

| Field | Purpose |
|---|---|
| `logicalId` | The thing itself, stable across every version |
| `versionId` | One immutable version of the thing |
| `versionNumber` | Monotonic per logical id, starting at 1 |
| `versionIdOrigin` | `NATIVE`, `SYNTHESIZED`, or `GRAPH_NATIVE` |
| `sourceRef` | Which record, in which system, with a resolution status |
| `organizationId` | Required and non-empty. All traversal is organization-scoped |
| `status` | `ACTIVE`, `SUPERSEDED`, or `VOIDED` |
| `effectiveFrom` and `effectiveTo` | Valid time: when the fact held in the organization |
| `recordedFrom` and `recordedTo` | Record time: when the graph knew it |
| `supersedesVersionId` | Append-only supersede lineage |
| `confidence` | 0.0 to 1.0 |
| `evidenceRefs` | Supporting evidence objects |

## 2. Node types

Organization, OrganizationalUnit, Person, Role, RoleAssignment, Agent, AutonomyState, DecisionType, AuthorityGrant, DecisionEvent, ActionEvent, Policy, Control, EvidenceObject, InformationAsset, EnterpriseSystem, SystemPermission, Outcome, Exception.

### Person, and the rejected Human alias

`Person` is the canonical organizational actor. Every accountability chain terminates at a Person.

`Human` was considered and **rejected**. The platform data model already renamed its actor to Person, with the stated rationale that every accountability chain terminates there. Introducing a second name for the same concept would create exactly the drift this ontology exists to prevent.

### Relationships are not fields

Accountable ownership, supervision, technical ownership, and sponsorship are **edges**, not fields on `Agent`. A relationship with a single writable owner elsewhere must not also exist as a column here, because that is a dual write by construction.

### AutonomyState, and why autonomy is not a scalar

Autonomy is never a freely mutable field on the governed agent. Each `AutonomyState` is a governed fact with an effective period, the business owner who granted it, and, above the canonical baseline, the gate-clearance evidence that earned it.

The autonomy **ceiling** is never stored anywhere. It is supplied at evaluation time by an `AutonomyCeilingProvider`, because the ceiling derivation is ratified and owned by the Lapemo platform. This package consumes the result and does not reimplement the derivation.

### SystemPermission, and why it is never authority

A `SystemPermission` records what the technology permits. It never proves what the organization authorizes. Permission and authority stay distinct at every level: the type system, the edges, the rules, the documentation, and the prose.

### Knowledge Objects

Knowledge Object definitions, schemas, registry, versioning, and exports are owned by `lpm-knowledge-objects`. This package references them by identity and version only, through `KnowledgeObjectRef`, and never copies their canonical content or schema.

The mapping decision: an `InformationAsset` or an `EvidenceObject` may carry a `knowledgeObjectRef`. A Knowledge Object is never modeled as a node here.

## 3. Edge direction convention

**Every edge type has exactly one canonical direction, and there are no reversed aliases.** Traversal handles the reverse path.

`OWNS` exists and `OWNED_BY` does not. `PART_OF` is the single structural containment direction and `PARENT_OF` does not exist. `SUPERVISES` exists and `SUPERVISED_BY` does not.

`pnpm validate:ontology` fails if a reversed alias is ever introduced.

Direction statements, in full:

| Edge | Direction |
|---|---|
| `PART_OF` | contained node to its container |
| `ASSIGNED_TO` | role assignment to the person holding it |
| `OCCUPIES` | person to the role they hold |
| `REPORTS_TO` | report to manager |
| `OWNS` | owning Person to the owned node |
| `ACCOUNTABLE_FOR` | accountable Person to what they answer for |
| `SUPERVISES` | supervising Person to the governed agent |
| `OPERATES` | governed agent to the system it operates within |
| `SPONSORS` | sponsoring role to the governed agent |
| `TECHNICALLY_OWNS` | technical owner to the node they maintain |
| `GRANTS` | granting actor to the authority grant issued |
| `AUTHORIZES` | authority grant to the actor it empowers |
| `COVERS` | governing node to the decision type covered |
| `LIMITED_TO` | bounded node to the boundary |
| `REQUIRES_REVIEW_BY` | requiring node to the reviewer |
| `DERIVED_FROM` | delegated grant to its source |
| `SUPERSEDES` | successor version to predecessor version |
| `REVOKES` | revoking actor or policy to the revoked grant |
| `HAS_PERMISSION` | principal actor to the technical permission held |
| `PERMITS_IN` | technical permission to the system honoring it |
| `INITIATES` | initiating actor to the decision event |
| `MAKES` | final deciding actor to the decision event |
| `INSTANCE_OF` | decision event to its decision type |
| `AUTHORIZED_BY` | event to the grant that permitted it |
| `GOVERNED_BY` | governed node to the policy |
| `CHECKED_BY` | checked node to the control |
| `USES` | consuming node to the information asset |
| `SUPPORTED_BY` | asserted node to supporting evidence |
| `PRODUCES` | event to the outcome produced |
| `PERFORMS` | acting actor to the action event |
| `EXECUTED_IN` | action event to the system it ran in |
| `INVOKES` | event to the system it calls |
| `MODIFIES` | action event to what it changed |
| `RESULTS_IN` | decision event to the action it caused |
| `ESCALATED_TO` | decision event to the escalation target |
| `REVIEWS` | reviewing Person to the decision event |
| `VALIDATES` | control to what it validated |
| `SOURCED_FROM` | asset to the system it came from |
| `AUTHORITATIVE_FOR` | authoritative source to what it is authoritative for |
| `DERIVED_FROM_EVIDENCE` | derived asset to the evidence behind it |
| `GENERATES` | producer to what it produced |
| `VERIFIED_BY` | verified artifact to its verifier |

## 4. Generic edge names

`COVERS`, `LIMITED_TO`, and `USES` are generic names. They are acceptable only because their allowed node pairs and semantics are explicit in the registry:

- `COVERS` links a governing node to a decision type. Scope of applicability, never scope of permission.
- `LIMITED_TO` links a bounded node to a boundary it may not exceed. Absence means unrestricted, recorded explicitly rather than implied.
- `USES` links a consuming node to an information asset. Information consumption only.

## 5. Ownership: projection or graph canonical

The load-bearing field in the registry is `lapemoSourceOfTruth`, keyed **by source node type**.

Ownership is per source type, not per edge type, because one edge type can be canonical here for one pair and a projection for another. `COVERS` is the clearest case: an authority grant covering a decision type exists nowhere else and is graph canonical, while a control covering a decision type is owned by the platform and must be projected.

- **Entry present:** Lapemo owns the writable truth. The edge is a derived projection and carries `isProjection: true`. This package never writes it back.
- **No entry:** no other system models the relationship. The edge is canonical here.

Validation fails in **both** directions: a Lapemo-owned edge that is not marked as a projection, and a graph-canonical edge that falsely claims to be one.

### Graph-canonical relationships

`GRANTS`, `AUTHORIZES`, `DERIVED_FROM`, `REVOKES`, `LIMITED_TO`, `AUTHORIZED_BY`, `USES`, `SUPPORTED_BY`, `PRODUCES`, `PERFORMS`, `INVOKES`, `SPONSORS`, `TECHNICALLY_OWNS`, and the rest of the authority and evidence surface. No authority grant concept exists anywhere in the Lapemo ecosystem.

### Projected relationships

`ACCOUNTABLE_FOR`, `SUPERVISES`, `OWNS`, `OCCUPIES`, `REPORTS_TO`, `PART_OF`, `MAKES`, `INSTANCE_OF`, `HAS_PERMISSION`, `PERMITS_IN`, `OPERATES`, `ESCALATED_TO`, `SOURCED_FROM`, `AUTHORITATIVE_FOR`, and `COVERS` from a control.

## 6. Cardinality and temporal rules

`EXACTLY_ONE_ACTIVE_INBOUND` applies to `ACCOUNTABLE_FOR`, `SUPERVISES`, `OWNS`, `TECHNICALLY_OWNS`, and `MAKES`. Accountability and supervision terminate at exactly one Person. Joint assignment is rejected at the domain layer.

Where `allowsTemporalOverlap` is false, two edges of that type sharing an endpoint may not have overlapping effective periods. Successive non-overlapping edges are permitted, which is how an ownership transfer is modeled without ever having two simultaneous owners.

## 7. Evidence and confidence requirements

`GRANTS`, `DERIVED_FROM`, and `REVOKES` require a supporting evidence object. Authority that cannot point at its evidence is an assertion, not a grant.
