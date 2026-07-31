# Security and Privacy

## 1. The database boundary (hard rule)

**This repository, its application code, tests, migrations, seeds, demonstrations, and CI must never connect directly to the shared Supabase instance used by Lapemo.**

Phase 1A satisfies this by having no persistence at all:

- No Prisma schema, no migrations, no connection string, no database client.
- No Docker service, no service container in CI.
- No environment variable is read anywhere in the package.
- Tests and the demonstration run against an in-memory repository and synthetic fixtures.

Shared credentials are never copied into this repository, its CI, its logs, its fixtures, its examples, or any report.

Later Lapemo integration occurs through imported package contracts, adapters, governed APIs, events, or approved exports. Never through an undocumented second connection to a shared database.

## 2. No secrets

Phase 1A reads no environment variable and holds no credential. `.env.example` documents that deliberately rather than being absent.

## 3. Synthetic data only

Every fixture is fabricated. No real organization, person, vendor, enterprise system, amount, or confidential organizational example appears anywhere in this repository.

The procurement scenario uses invented names and a fictional trading company. Any resemblance to a real organization is unintended.

## 4. Organization scoping

All traversal is organization-scoped. There is no cross-organization path.

- Every node and edge requires a non-empty organization identifier. Validation rejects an unscoped record.
- An edge that crosses an organizational boundary is a validation violation.
- A scope mismatch during evaluation produces `INDETERMINATE`, which is an explicit "cannot answer", not a silent empty result that could be mistaken for "nothing found".

Inbound platform data may carry a null organization scope. The adapter must reject it rather than defaulting it.

## 5. No hard deletes

No hard deletion exists anywhere in the domain surface. Records are superseded or voided, never destroyed. `validate:lineage` asserts mechanically that the repository exposes no delete, write, or mutate operation.

Superseded and voided versions remain readable for historical reconstruction, and never satisfy an effectiveness check.

## 6. Read-only posture

The graph repository port has no write method. Organizational Context Services
types a literal `readOnly: true` that cannot be set false. Its audit port records
only the evaluation artifact for `LIVE` organizations; it cannot mutate graph
truth, and it is not invoked for `DIAGNOSTIC` organizations. No port in
`src/adapters/lapemo/contracts.ts` mutates anything.

## 7. Audit truth

This package **never writes an audit record** and never competes with the Lapemo audit implementation, which is the single audit truth.

An accuracy note carried from the Phase 0 assessment: the platform audit model comment asserts that immutability is enforced at the PostgreSQL row-level security layer, but no migration contains any row-level security, policy, or trigger statement, and a ratified platform ADR confirms row-level security is deferred. **Audit immutability in the platform is currently an application-layer convention, not a database guarantee.** No document in this repository repeats the stronger claim. Recorded as IB-008.

## 8. Repository visibility

Private by default. Proprietary and confidential. Never published to a public registry; `package.json` carries `"private": true`.

## 9. Personal data

The domain contracts carry a person's display name and title only, because accountability requires naming a human. No contact details, credentials, authentication material, or free-text personal content appear in any contract.

A person is never deleted. Deactivation is modeled through `isActive`, and a deactivated person cannot satisfy an accountability or supervision predicate even while a stale relationship still points at them.

## 10. Dependency posture

Zero runtime dependencies. The package ships no third-party code into any consumer.

Development dependencies are limited to TypeScript, Vitest, tsx, and ESLint.
