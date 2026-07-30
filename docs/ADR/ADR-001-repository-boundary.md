# ADR-001. Repository boundary

**Status:** Accepted, Phase 1A.

## Decision

`lpm-organizational-graph` is a standalone private repository, a clean sibling of the existing ecosystem repositories, with default branch `main`.

It owns portable domain types, typed node and relationship contracts, temporal and supersede contracts, authority evaluation rules, evaluation status and reason-code contracts, clearing predicates, repository and query interfaces, adapter contracts, synthetic fixtures, deterministic validation, and the ontology, schema and rule-set versions.

It does **not** own application records, runtime persistence, the formula layer, the audit implementation, the Condition Family Registry, or production workflows. Those remain with Lapemo.

## Default branch

`main`, not `master`.

The original brief assumed `master` was the ecosystem convention. Phase 0 found otherwise: six of the seven ecosystem repositories use `main`, and only `lpm-os-master`, the oldest, uses `master`. `main` is the current convention, and the Phase 1A authorization directs it.

## Location

A sibling directory beside the existing repositories. The workspace root is not a git repository, so a sibling creates no nested-repository hazard and cannot disturb the concurrent work active in other repositories.

## What this repository must never do

- Rewrite history of, move, rename, or delete anything in an existing repository.
- Commit to an existing repository.
- Connect to the shared Supabase instance, in any environment, from any code path.
- Publish publicly.
- Create a second writable source of truth for anything Lapemo owns.

## GitHub creation

The GitHub repository is created **only when the correct authenticated owner is known with certainty**.

At the time of writing, `gh auth status` reports no logged-in host. Every ecosystem remote resolves to the same owner, which is strong evidence, but evidence is not authentication. The local repository is therefore complete, no speculative remote is configured, and the exact recommended creation command is documented in `CHANGELOG.md` and the completion report.

## Licence

Proprietary. Copyright Lapemo Systems LLC, whose legal identity comes from the authoritative company identity record, not from this repository. Product repositories must not redefine company identity.

## Rejected

**A directory inside `lpm-os-master`.** Couples the graph release cycle to the platform's and makes the boundary a convention rather than a structure.

**A monorepo.** Changes the entire ecosystem repository and deployment model for one new package.

**Creating the GitHub repository under an inferred owner.** Creating a private repository under the wrong account is not trivially reversible.
