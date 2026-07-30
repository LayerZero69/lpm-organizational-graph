# ADR-007. Identity and versioning

**Status:** Accepted, Phase 1A.

## Decision

Three identifiers, never conflated:

| Identifier | Answers | Mutable |
|---|---|---|
| `sourceRef` | Which record, in which system, did this come from | no |
| `logicalId` | Which thing is this, across every version of it | no |
| `versionId` | Which immutable version of that thing is this | no |

Plus `versionNumber`, a monotonic integer per `logicalId` starting at 1.

## versionIdOrigin

Every node records how its version identity came to exist:

- `NATIVE`: the source system supplied a genuine immutable version identifier.
- `SYNTHESIZED`: an adapter invented one because the source has no version identity.
- `GRAPH_NATIVE`: authored here, for example a synthetic fixture.

This field exists because **the Lapemo platform has no version identifier anywhere**. Its supersede chains give lineage while the row mutates in place. An adapter therefore has to synthesize a version identity, and a consumer must be able to tell a real one from a synthesized one. Hiding that distinction would let a synthesized identity be trusted as if the source had guaranteed it.

## sourceRef reuses existing platform semantics

The platform's external entity mapping already implements this idea: an external type and identifier, the canonical entity it maps to, a confidence value, and a resolution status of unresolved, proposed, confirmed, rejected or ambiguous.

The graph reuses those semantics rather than inventing a parallel vocabulary, and carries the resolution status through into confidence handling so an unconfirmed mapping degrades the answer instead of silently resolving.

## Identifier format

Graph-native identifiers should be ULID or UUIDv7. **Not cuid**, which the platform uses, because cuid carries no sortable time component and version ordering for free is worth having.

Platform cuids are stored only inside `sourceRef`, never as a graph logical or version identifier.

Fixtures use a deterministic `logicalId#vN` form so the demonstration and its output are reproducible.

## Knowledge Object identity

Referenced by the governed identifier and semantic version only. The identifier is immutable and the version is not part of it, matching the owning repository's schema exactly. Content and schema are never copied.

## Validation

- Version 1 may not claim to supersede anything.
- Version N above 1 must record the version it superseded. Supersede lineage is unbroken.
- Version numbers increase monotonically per logical id.
- `validate:lineage` asserts all of the above across every fixture.

## Rejected

**A single identifier serving as both logical and version identity.** Then a version cannot be immutable and a logical record cannot be stable. It has to be two.

**Reusing platform cuids as graph logical identifiers.** Couples graph identity to one system's identifier format and loses time ordering.

**Omitting `versionIdOrigin`.** A synthesized version identity that looks native is a false guarantee.
