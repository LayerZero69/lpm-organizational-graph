# Security

This repository is private, proprietary, and contains no production data.

## Reporting

Report a suspected vulnerability or a boundary violation privately to the
repository owner. Do not open a public issue.

## Standing boundaries

These are enforced by CI, not by convention. See docs/SECURITY_AND_PRIVACY.md.

- This repository never connects to the shared Supabase instance used by Lapemo,
  in any environment, from any code path, including tests and CI.
- No secret, credential, or connection string is committed.
- Phase 1A reads no environment variable at all.
- Fixtures are synthetic. No real organization, person, vendor, system, or
  amount appears anywhere.
- All traversal is organization-scoped. There is no cross-organization path.
- No hard deletes. Records are superseded or voided, never destroyed.

## Reporting a boundary violation

If you find a code path that could connect to a shared backend, read a secret,
or write to a Lapemo-owned record, treat it as a security defect and report it
before merging anything that depends on it.
