# Organizational Context Services

## Status

Organizational Context Services (OCS) is a ratified Lapemo portfolio capability.
The foundational directive is
`lpm-os-master/docs/product/LAPEMO_ORGANIZATIONAL_CONTEXT_SERVICES.md` v0.3.0.
The graph repository supplies its versioned contract, deterministic authority
evaluation, Context Package assembly, integrity verification, and executable
procurement reference slice. Network delivery, tenancy, authentication,
dashboards, and governed commands remain Lapemo Platform responsibilities.
OCS v0.3 remains unreleased until the integrity correction is merged. No
deployed OCS service or production key-management design exists in this work.

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
version markers, a temporal replay key, provenance manifest, integrity envelope,
expiration, and a literal `readOnly: true`.

The integrity envelope declares `SHA256_HMAC_SHA256`. Its content integrity hash
detects changes to the canonical package payload. Its HMAC authentication token
proves possession of the configured shared verification key. HMAC verification
is mandatory, and hash-only verification is rejected. HMAC is shared-secret
authentication, not a digital signature. Neither mechanism grants authority or
replaces ownership, supervision, governance, or human accountability.

Verification enforces Context Package contract, schema, ontology, and rule-set
versions by exact match to the versions supported by this package. There is no
compatibility fallback in v0.3. The caller must also supply the expected
organization identifier; both assembly adapters and verification reject a scope
mismatch. The algorithm is validated before the implementation is selected.

The canonical payload contains organization scope and every evidence field
currently exposed by the package, including evidence identifiers, completeness,
provenance identifiers and versions, integrity markers, and context confidence.
The envelope's hash and token values are replaced with empty placeholders during
canonicalization, so the envelope never verifies itself recursively. The current
contract does not expose evidence contents, external source records, or a
source-specific observation timestamp.

The following invariants are executable:

- incomplete, conflicted, or unavailable context never authorizes;
- `PROPOSED`, `SIMULATED`, and `APPROVED` states are advisory only;
- authority uncertainty fails closed;
- the same replay key and source state produce the same determination and hash;
- material packages require both a SHA-256 content integrity hash and a valid
  HMAC authentication token;
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
