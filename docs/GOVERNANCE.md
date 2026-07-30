# Governance

## 1. Ontology change control

A change to a node type, an edge type, or a relationship contract requires:

1. The problem it solves, stated as an enterprise question the graph currently cannot answer.
2. The proposed object or edge, with its canonical direction.
3. The framework layers affected, by plain name.
4. Compatibility impact on existing consumers.
5. Migration impact.
6. Evidence that the concept is real, not speculative.
7. The accountable owner.
8. The decision required, if any.

**New ontology concepts require documented evidence.** Do not create a generic node where a canonical object already exists. Do not add a concept that supports no enterprise question.

## 2. Numeric values are owner decisions

Numeric thresholds, weights, and confidence defaults are **owner decisions**. They are proposed in an ADR and marked as requiring ratification. They are never asserted as settled by an implementer.

`PROPOSED_CONFIDENCE_DEFAULTS` carries an explicit `ownerRatificationRequired: true` field for exactly this reason. Nothing in the evaluator hardcodes a threshold; every value arrives through that object so a ratified set replaces them in one edit.

## 3. Source-of-truth discipline

Before adding a concept, establish who owns it:

- **Owned by Lapemo already.** Reference it and project it. Never create a writable copy.
- **Owned by canon.** Import it from `src/canon`. Never retype a canonical string.
- **Owned by `lpm-knowledge-objects`.** Reference by identity and version. Never copy content or schema.
- **Owned by nobody.** It may be graph canonical, with evidence.

`validate:ontology` enforces the first case mechanically through the relationship contract registry.

## 4. Voice rules are enforced, not reviewed

The canon voice rules are load-bearing here and are checked by `validate:voice` in CI:

- Say "governed agents", never the prohibited legacy phrase.
- No em dashes in any source file or document.
- No layer or module shorthand codes on a rendered surface.
- The retired autonomy level appears only in the one adapter module whose job is to map it away.

A voice violation fails the build. It is not a review comment.

## 5. Anti-drift rules

1. Every graph object must support an enterprise question.
2. Every object must have a clear owner or governing source.
3. Every material relationship must be temporal.
4. Technical permission is never treated as authority.
5. Agent autonomy never implies accountability, and autonomy is earned, never defaulted.
6. Historical state is preserved. No hard deletes anywhere.
7. New ontology concepts require documented evidence.
8. No generic nodes where canonical objects exist.
9. No infrastructure without a current use case.
10. No native graph database for visual appeal.
11. No user interface in this repository.
12. No duplication of Lapemo application concerns. Formulas live in the platform formula layer; this repository returns structural facts.
13. Domain logic stays independent of persistence.
14. Authority evaluation stays deterministic.
15. Every release includes tests, documentation, and a demonstrable capability.
16. This repository never connects to the shared Supabase instance.
17. Numeric thresholds and confidence defaults are owner decisions.
18. Ownership and supervision always terminate at exactly one Person. Joint assignment is rejected at the domain layer.
19. No second writable source of truth for any Lapemo-owned entity, relationship, audit record, formula, condition family, or Knowledge Object.
20. Every cross-system identity distinguishes source record identity, graph logical identity, and immutable version identity.
21. The proposed context contracts are types and schemas only. No network service, no action execution.
22. Phase 1B does not start until every integration blocker is dispositioned.

## 6. Versioning

Four versions move independently: package, ontology, rule set, schema. A fifth covers the proposed context contract. Every evaluation result carries the ontology, rule-set and schema versions, so a stored result can always be re-interpreted against the contract that produced it.

## 7. Review expectations

Every pull request documents ontology impact, rule impact, migration impact, tests, documentation, and security and privacy impact. Every quality gate passes before merge. No suppressed type errors. No placeholder assertions. No scoped test run as a substitute for the full suite.
