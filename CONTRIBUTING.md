# Contributing

## Setup

```bash
pnpm install
```

Node 20 or later. No database, no environment variable, no secret.

## The gates

All of these pass before merge. No scoped test run substitutes for the full suite.

```bash
pnpm typecheck
pnpm lint
pnpm validate:voice
pnpm test
pnpm test:acceptance
pnpm validate:ontology
pnpm validate:lineage
pnpm build
pnpm demo:authority-lineage
```

## Rules that are enforced mechanically

These fail the build. They are not review comments.

- **Voice.** No em dashes. Say "governed agents". No layer or module shorthand codes on a rendered surface. The retired autonomy level appears only in the adapter module that maps it away.
- **Determinism.** A lint rule forbids wall-clock reads inside domain logic. Time arrives through an explicit `TemporalContext`.
- **Ownership.** An edge whose relationship Lapemo owns must be marked as a projection. A graph-canonical edge must not claim to be one. Both directions fail validation.
- **Clearing predicates.** Every reason code documents one, with a unique identifier.
- **Boundary.** CI fails if a prisma directory, a shared-backend reference, a connection string, or a committed env file appears.

## Where things belong

| Adding | Goes in |
|---|---|
| A canonical string | `src/canon`, and nowhere else. Import it |
| A node or edge type | `src/domain`, plus a registry contract |
| An authority rule | `src/authority/rules.ts`, as a pure function, plus a reason code with a clearing predicate |
| A query | `src/graph/queries.ts` |
| Anything touching Lapemo | `src/adapters/lapemo`, as a read-only contract |
| A scenario variant | `src/fixtures`, as a named variant, never a mutation of a shared object |

## Writing a rule

A rule is a pure function from `ResolvedContext` to fired reasons. It must not perform I/O, read a clock, or depend on the order other rules ran in.

Every rule needs:

1. A registered reason code for each way it can fire.
2. A clearing predicate stating the exact graph condition that makes the failure false.
3. A `lapemoConditionKey` where the platform already owns an equivalent condition. Map, do not reimplement.
4. Unit tests covering the passing case, each failing case, and the boundary. A limit rule needs a test exactly at the limit.

## Writing an acceptance test

Assert **one exact expected status**. There are no `OR` assertions in this repository. A test that would accept either of two statuses has not decided what the system should do.

## Numeric values

Thresholds, weights and confidence defaults are **owner decisions**. Propose them in an ADR, mark them as requiring ratification, and route them through `PROPOSED_CONFIDENCE_DEFAULTS`. Never hardcode a threshold in a rule.

## Fixtures

Synthetic only. No real organization, person, vendor, system, or amount, ever.

Add a named variant rather than mutating a shared dataset, so no test can silently depend on another test's edit.

## What not to do

- Do not connect to any database from this repository.
- Do not create a second writable source of truth for anything Lapemo owns.
- Do not reimplement a platform formula. Return structural facts.
- Do not copy Knowledge Object content or schema. Reference by identity and version.
- Do not add a reversed edge alias. Traversal handles direction.
- Do not introduce the retired autonomy level.
- Do not edit a canonical value to make a test pass. Edit canon, publish, re-pin, re-run the validator.
