# Graph Queries

Typed application services in `src/graph/queries.ts`. These are the internal engine that a future Organizational Context Services would wrap.

Every query is organization-scoped and takes a temporal context. There is no untimed answer.

## QRY-001. Was this governed agent authorized?

Returns the full evaluation result: primary status, reason codes with clearing predicates, matching grant, accountable human, supervisor, applicable policies and controls, evidence completeness, and confidence.

## QRY-002. Who is accountable?

```text
Action Event
  <- PERFORMS           Agent
  <- ACCOUNTABLE_FOR    Person
  -> OCCUPIES           Role
```

Returns the acting governed agent, the accountable Person with their display name, the roles they occupy, and the supervisor. Returns an empty answer rather than throwing for an unknown action.

## QRY-003. What authority allowed the decision?

```text
Decision Event
  -> AUTHORIZED_BY   Authority Grant
  -> DERIVED_FROM    ... up to an organizational source
```

Returns the matching grant and the full delegation chain in order.

## QRY-004. Where does permission exceed authority?

Compares every technical permission against the authority grants held by the same principal. Three finding kinds:

| Kind | Meaning |
|---|---|
| `NO_AUTHORITY_AT_ALL` | The principal holds a technical permission with no organizational authority of any kind |
| `ACTION_NOT_AUTHORIZED` | The technology permits actions no authority covers |
| `FINANCIAL_LIMIT_ABOVE_AUTHORITY` | The technology permits a higher amount than any authority allows |

Revoked permissions are excluded. Currency-incomparable limits are not silently converted.

## QRY-005. Which decisions lack complete lineage?

Reports missing accountable owner, supervisor, authority grant, governing policy, information, required information, human review, outcome, or action record.

"Information" and "required information" are deliberately separate gaps. A decision can cite information and still lack the specific class its decision type requires, and telling someone "information is missing" when what they actually need is the vendor risk classification is not useful.

## QRY-006. What changed after approval?

Reads supersede lineage and reports any subject whose version advanced after a reference instant, with the from and to version identifiers and the change timestamp, ordered oldest first.

## QRY-007. Supervisory Control Capacity concentration

Returns **structural facts only**: active agents supervised, active agents accountable for, risk distribution across those agents, decision volume, open exceptions, and unreviewed outcomes.

There is deliberately no capacity, utilization, overload flag, or score anywhere in the return type. Canon pins the numeric formula to the Lapemo platform and states that it is never reimplemented. Oversight being finite is a fact this query supplies the evidence for; measuring how finite belongs to the platform formula layer. A unit test asserts the absence of those fields, so the boundary cannot erode by accident.

## QRY-008. Trace a decision end to end

Returns the complete path: organization, decision type, governed agent, accountable human, supervisor, authority grant and its full delegation chain, invoked systems, technical permissions, information assets, action events, outcome, human review state, and the full evaluation result.

Returns null for an unknown decision rather than a partial trace.
