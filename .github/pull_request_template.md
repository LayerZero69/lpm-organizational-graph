## What changed

<!-- One paragraph. What is now true that was not true before? -->

## Ontology impact

<!-- New or changed node types, edge types, or relationship contracts.
     State the canonical direction for any new edge. Write "none" if none. -->

## Rule impact

<!-- New or changed authority rules, reason codes, or clearing predicates.
     Every failure code must document the exact graph condition that clears it. -->

## Migration impact

<!-- Phase 1A has no persistence, so this is normally "none".
     Any answer other than "none" needs an explicit reason. -->

## Tests

<!-- Which unit and acceptance tests cover this? A rule change without a rule
     test, or an acceptance criterion without an exact expected status, is not
     ready. No OR assertions. -->

## Documentation

<!-- Which documents changed? An ontology or rule change that does not touch
     docs/ONTOLOGY.md or docs/AUTHORITY_LINEAGE.md is probably incomplete. -->

## Security and privacy impact

<!-- Confirm explicitly, or explain: -->

- [ ] No connection to the shared Supabase instance, in any environment or code path
- [ ] No secret, credential, or connection string added
- [ ] Fixtures remain synthetic, with no real organization, person, vendor, system, or amount
- [ ] No second writable source of truth for anything Lapemo owns
- [ ] No platform formula reimplemented (Supervisory Control Capacity, gates, risk weighting)
- [ ] No hard delete introduced

## Boundaries

- [ ] Any numeric threshold or weight is proposed for owner ratification, not asserted as settled
- [ ] Canonical values are imported from `src/canon`, never retyped
- [ ] Knowledge Objects are referenced by identity and version, never copied

## Gates

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm validate:voice`
- [ ] `pnpm test`
- [ ] `pnpm test:acceptance`
- [ ] `pnpm validate:ontology`
- [ ] `pnpm validate:lineage`
- [ ] `pnpm build`
- [ ] `pnpm demo:authority-lineage`
