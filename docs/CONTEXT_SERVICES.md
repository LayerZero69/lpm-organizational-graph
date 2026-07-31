# Organizational Context Services

## Status

Organizational Context Services (OCS) is a ratified Lapemo portfolio capability.
The foundational directive is
`lpm-os-master/docs/product/LAPEMO_ORGANIZATIONAL_CONTEXT_SERVICES.md` v0.3.0.
The graph repository supplies its versioned contract, deterministic authority
evaluation, Context Package assembly, integrity verification, and executable
procurement reference slice. Network delivery, tenancy, authentication,
dashboards, and governed commands remain Lapemo Platform responsibilities.

## Boundary

The Organizational Graph models organizational truth. OCS assembles the minimum
sufficient governed context needed at the moment of work. OCS can read,
evaluate, assemble, audit its evaluation, and propose remediation. It cannot
grant authority, change ownership or policy, advance agent autonomy, promote an
Organizational Twin state, or mutate historical truth.

Organization mode is resolved by a trusted server-side adapter before evaluation.
`LIVE` evaluations emit an OCS audit artifact. `DIAGNOSTIC` evaluations read
frozen state and do not write to the tenant rail.

## Context Package v0.3.0

`src/context/contracts.ts` defines separate context and decision status axes,
organization mode, operating-model state scope, purpose, actor and target,
ownership, authority, governance, information, systems, approvals, escalation,
evidence, lineage, risks, required actions, separate context and gate confidence,
version markers, a temporal replay key, provenance manifest, package hash,
optional verification token, expiration, and a literal `readOnly: true`.

The following invariants are executable:

- incomplete, conflicted, or unavailable context never authorizes;
- `PROPOSED`, `SIMULATED`, and `APPROVED` states are advisory only;
- authority uncertainty fails closed;
- the same replay key and source state produce the same determination and hash;
- material packages are SHA-256 integrity-verifiable;
- `DIAGNOSTIC` evaluation writes no OCS audit artifact.

## Procurement vertical slice

The real authority evaluator and governed graph fixture produce:

- `$42,000` request against a `$25,000` grant;
- required human review missing;
- vendor-risk information missing;
- `$100,000` technical permission exceeding legitimate authority;
- exactly one accountable human and a complete delegation chain;
- `contextStatus: INCOMPLETE`;
- `decisionStatus: UNAUTHORIZED`;
- `recommendation: BLOCK_AND_ESCALATE`.

After the amount, permission, review, and vendor-risk evidence are corrected, the
same service returns `COMPLETE` and `AUTHORIZED`.

`tests/acceptance/context-services.test.ts` is the executable proof.
