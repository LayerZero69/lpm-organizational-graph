# Architecture

## 1. Shape

A portable TypeScript domain package with **zero runtime dependencies**. It computes and explains. It never writes into a system that owns a record.

```text
  adapters                     domain                    evaluation
  --------                     ------                    ----------
  InMemoryGraphRepository  ->  GraphRepository port  ->  AuthorityEvaluator
  LapemoProjectionPort         node + edge contracts     12 pure rules
  AutonomyCeilingProvider      relationship registry     reason codes
  SupervisoryLoadPort          temporal contracts        precedence
  ConditionFamilyPort                                         |
  (Phase 1B implements)                                       v
                                                        GraphQueryService
                                                        QRY-001 to QRY-008
```

## 2. The resolution and rules split

The evaluator has two halves that never mix:

- **Resolution** is asynchronous, touches the repository, and gathers facts into a `ResolvedContext`.
- **Rules** are synchronous and pure, and take that context. No rule performs I/O, reads a clock, or depends on the order the others ran in.

That split is what makes every rule independently unit-testable without a repository, and what makes the whole evaluation reproducible. A lint rule forbids wall-clock reads inside domain logic so the property cannot erode over time.

## 3. Ports

Everything the package needs from the outside world is a port:

| Port | Purpose |
|---|---|
| `GraphRepository` | Read-only, organization-scoped, temporally qualified graph reads |
| `AutonomyCeilingProvider` | Consumes the platform-owned ceiling derivation |
| `LapemoProjectionPort` | Projects Lapemo-owned records into nodes and edges |
| `SupervisoryLoadPort` | Returns supervisory structural facts, never a formula result |
| `ConditionFamilyPort` | Maps graph reason codes onto platform condition families |
| `IdentityResolutionPort` | Resolves an external identifier to a graph logical id |

Phase 1A ships exactly one implementation, the in-memory repository. Everything else is a contract with no implementation, by design.

## 4. Why there is no database

The Phase 0 assessment found that the first vertical slice divides cleanly into two groups:

- Concepts Lapemo **already owns and enforces**: Organization, Person, Agent, DecisionType, DecisionEvent, Control, EnterpriseSystem, Outcome. Creating writable tables for these would create a second source of truth.
- Concepts that **exist nowhere**: AuthorityGrant, SystemPermission as an actor-facing concept, AutonomyState with lineage, and the typed edge model.

The second group is load-bearing runtime governance. An authority grant that blocks a decision has to be enforced where decisions are actually executed, which is the platform. A graph-owned authority store that the platform does not read is decorative. One that it does read is a runtime dependency introduced without an integration decision. Neither is acceptable in a first release.

So Phase 1A ships contracts, evaluation and adapter interfaces, and Phase 1B proposes the new concepts as a reviewed Lapemo migration.

## 5. The read-only repository port

The port has no write method of any kind. `validate:lineage` asserts that mechanically by reflecting over the repository surface and failing if any method name suggests a mutation.

Two read shapes exist for a specific reason:

- `getNode` and `findNodes` return what is **effective** in a temporal context.
- `getLatestVersion` and `findAllVersions` return records **regardless of valid time**.

The second pair is not a convenience. An expired authority grant has to be findable in order to be reported as expired. If the only available read filtered it out, the evaluator could not tell "the authority ran out" from "there was never any authority", and those are different findings with different clearing predicates.

## 6. Determinism

Guaranteed by pure rules, no clock reads in domain logic, order-independent precedence, deterministic fixture identifiers, and minimum-based confidence propagation.

Tested by asserting that repeated evaluations produce byte-identical results, and that reversing the input node and edge ordering produces the same status and the same reason codes.
