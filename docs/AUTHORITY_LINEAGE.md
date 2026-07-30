# Authority Lineage

How this package decides whether a governed agent held legitimate organizational authority.

## 1. The evaluation model

Outcome and cause are separate. A result carries **exactly one primary status** and **zero or more reason codes**. A reason code is never a status, and a status is never a reason.

### Primary statuses

| Status | Meaning |
|---|---|
| `AUTHORIZED` | Nothing blocking or conditional fired |
| `CONDITIONALLY_AUTHORIZED` | Authorized subject to a pending, obtainable action |
| `NOT_AUTHORIZED` | A hard violation fired |
| `INDETERMINATE` | The graph lacks the data to evaluate at all |

`INDETERMINATE` is not a polite refusal. It means the question could not be answered, which is a different thing from answering no, and must never be reported as one.

### Deterministic precedence

`src/authority/precedence.ts` maps any set of fired reasons onto exactly one status:

1. Any `INDETERMINATE` reason wins.
2. Otherwise any `BLOCKING` reason produces `NOT_AUTHORIZED`.
3. Otherwise any `CONDITIONAL` reason produces `CONDITIONALLY_AUTHORIZED`.
4. Otherwise `AUTHORIZED`. Warnings never move the status.

The mapping is total, pure, and order independent. The same reason set always produces the same status regardless of the order the rules ran in, and there is a unit test that asserts exactly that over every permutation of impacts.

## 2. Clearing predicates

Every failure code documents its **clearing predicate**: the exact graph condition that, when it becomes true, makes the failure false.

The identity of a condition is determined by what makes it false, never by its severity or its label. That is the same rule the Lapemo Condition Family Registry enforces, which is why each reason code also carries the `lapemoConditionKey` it maps onto. Where the platform already owns a condition, this package **maps** rather than reimplements.

A clearing predicate is not prose. It is the specification a resolver would implement, and it is what the demonstration prints under "required response".

## 3. The twelve rules

| Rule | Codes | Impact |
|---|---|---|
| AUTH-001 accountable owner | `UNOWNED_AGENT`, `AMBIGUOUS_AGENT_OWNERSHIP` | Blocking |
| AUTH-002 named supervisor | `UNSUPERVISED_AGENT` | Blocking |
| AUTH-003 matching authority | `NO_MATCHING_AUTHORITY`, `ACTION_OUTSIDE_AUTHORITY`, `FINANCIAL_LIMIT_EXCEEDED`, `RISK_LIMIT_EXCEEDED`, `DATA_CLASSIFICATION_LIMIT_EXCEEDED`, `SYSTEM_SCOPE_EXCEEDED`, `GEOGRAPHIC_SCOPE_EXCEEDED` | Blocking |
| AUTH-004 effective authority | `AUTHORITY_NOT_YET_EFFECTIVE`, `AUTHORITY_EXPIRED`, `AUTHORITY_REVOKED` | Blocking |
| AUTH-005 permission alignment | `PERMISSION_AUTHORITY_MISMATCH` | Blocking |
| AUTH-006 autonomy ceiling | `AUTONOMY_EXCEEDS_DECISION_LIMIT`, `AUTONOMY_CEILING_BLOCKED` | Blocking |
| AUTH-007 earned autonomy | `UNEARNED_AUTONOMY_LEVEL` | Blocking |
| AUTH-008 mandatory human review | `MISSING_HUMAN_REVIEW`, `REVIEWER_NOT_INDEPENDENT` | Conditional, blocking |
| AUTH-009 authoritative information | `MISSING_REQUIRED_INFORMATION`, `NON_AUTHORITATIVE_SOURCE`, `STALE_INFORMATION`, `UNAUTHORIZED_DATA_USE` | Conditional, blocking |
| AUTH-010 policy conflict | `UNRESOLVED_POLICY_CONFLICT` | Blocking |
| AUTH-011 outcome accountability | `NO_HUMAN_OUTCOME_ACCOUNTABILITY` | Blocking |
| AUTH-012 valid delegation chain | `INVALID_DELEGATION_CHAIN`, `DELEGATION_EXCEEDS_GRANTOR_AUTHORITY` | Blocking |

Plus four data-integrity codes producing `INDETERMINATE`, and three warnings.

### Why some information failures are conditional and others are blocking

A **missing** required class is obtainable: fetch the vendor risk classification and the condition clears. That is `CONDITIONAL`.

A **non-authoritative** or **stale** source, or data used beyond its permitted classification, is not a gap to be filled. It is a governance failure that already happened. Those are `BLOCKING`.

## 4. The financial-limit condition

`FINANCIAL_LIMIT_EXCEEDED` is a machine-stable code, not free text, with this clearing predicate:

> The matching grant has `financialLimit` of null, OR the decision event carries no financial amount, OR `financialLimit.currency` equals `financialAmount.currency` AND `financialLimit.amount` is greater than or equal to `financialAmount.amount`. A currency mismatch never clears this condition and is reported rather than converted.

The currency clause matters. Silently converting currencies inside an authority check would let an exchange-rate assumption decide whether a purchase was authorized. The package refuses, and reports the mismatch instead.

## 5. Delegation chains

AUTH-012 walks `derivedFromGrantLogicalId` from the matching grant toward an organizational source. The walk is cycle-safe and depth-bounded, because a malformed chain must produce a finding rather than an infinite loop.

Two distinct failures:

- **`INVALID_DELEGATION_CHAIN`.** The chain does not reach a grant naming an organizational source, or it revisits a grant it already passed through. Authority cannot be self-conferring.
- **`DELEGATION_EXCEEDS_GRANTOR_AUTHORITY`.** Every parent and child pair is compared: the child's financial limit, risk limit, data-classification limit and action set must all sit inside the parent's. A grantor cannot delegate authority they do not hold. Delegating an *unlimited* boundary from a bounded grantor is caught explicitly, because null is more permissive than any number, not less.

A chain terminates only at `BOARD_RESOLUTION`, `EXECUTIVE_MANDATE`, `CORPORATE_POLICY`, or `DELEGATION_OF_AUTHORITY_MATRIX`. Never at another governed agent.

## 6. Permission is never authority

AUTH-005 compares what the technology permits against what the organization authorized, for every technical permission held on a system the decision invokes.

The finding is that permission **exceeds** authority. A permission narrower than authority is fine. A permission wider than authority is the risk, and it is exactly the case the demonstration scenario contains: an ERP that will approve up to USD 100,000 held by a governed agent authorized to USD 25,000.

A technical permission never establishes authority. It only has to stay inside it.

## 7. Autonomy

`AUTH-006` compares the effective `AutonomyState` against a ceiling supplied by the `AutonomyCeilingProvider`. The ceiling is derived at evaluation time and never stored, matching the ratified platform principle.

`AUTONOMY_CEILING_BLOCKED` is a distinct code from `AUTONOMY_EXCEEDS_DECISION_LIMIT`. A blocked ceiling means a prerequisite is unsatisfied, for example the decision domain has no active owner, so no level is permitted at all. It is not level zero, and it is not the same finding as operating above a level that does exist.

`AUTH-007` enforces that autonomy is earned. Any state above the canonical baseline of Agent Assisted must carry gate-clearance evidence that resolves, granted by a named business owner.

## 8. Temporal evaluation

Every evaluation happens at an instant. By default that is the decision's own timestamp, which is the correct default for reconstructing what was true when the decision was made.

The temporal context carries two dimensions:

- `validAt`: which organizational reality to reconstruct.
- `knownAt`: which state of knowledge to reconstruct it from. Null means everything the graph knows now.

Separating them is what makes "what did we believe at the time?" a different question from "what was actually true at the time?". Both are answerable.

The result reports the temporal context it evaluated under, so a stored result can always be re-read against the reality it was computed from.

## 9. Confidence

Confidence sits on a single 0.0 to 1.0 scale, chosen because every existing confidence-shaped field in the Lapemo platform already uses it.

Propagation is the **minimum along the path**. A conclusion is never more trustworthy than the least trustworthy fact it rests on. Averaging would let one unreliable link disappear into a comfortable-looking number.

An unconfirmed cross-system identity mapping applies a penalty; a rejected mapping drops confidence to zero. All numeric defaults are marked as requiring owner ratification.

## 10. Result payload

Every evaluation returns the status, violations, warnings, required actions, evaluated governed agent, decision event, accountable human, supervisor, matching grant, full delegation chain, applicable policies and controls, information assets used, systems and permissions invoked, evidence completeness, review requirements with their sources, confidence, correlation id, evaluation timestamp, temporal context, and the ontology, rule-set and schema versions.
