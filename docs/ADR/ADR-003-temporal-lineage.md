# ADR-003. Temporal lineage: bitemporal-lite with append-only supersede

**Status:** Accepted, Phase 1A.

## Decision

Every material node and edge carries two time dimensions:

- **Valid time**, `effectiveFrom` and `effectiveTo`: when the fact held in the organization.
- **Record time**, `recordedFrom` and `recordedTo`: when the graph knew it.

A change never overwrites. It appends a successor version, closes the predecessor's **record-time** window, sets the predecessor's status to `SUPERSEDED`, and links the two through `supersedesVersionId` and a `SUPERSEDES` edge.

There are no hard deletes anywhere in the domain surface.

## How a predecessor is closed

Explicitly, and only in the record-time dimension. `closePredecessor` sets `status` to `SUPERSEDED` and `recordedTo` to the successor's `recordedFrom`. **Valid time is untouched**, because learning something new does not change what was true.

This is stated openly rather than claiming full immutability while quietly mutating history. The predecessor row does change, in exactly two fields, and those two fields are system-managed closure metadata.

## Valid-time succession is not supersede

A crucial distinction the model makes explicit:

- A financial limit **raised effective June** is two versions with adjacent valid-time periods, both currently known, both `ACTIVE`. Evaluating in March sees the old limit; evaluating in July sees the new one. Nothing was corrected.
- A limit that was **recorded wrongly and fixed** is a supersede: the predecessor's record window closes, and only the successor is currently known.

Conflating them would make it impossible to distinguish "the organization changed" from "we were wrong", which is the whole point of carrying two time dimensions.

## Effectiveness predicate

One predicate decides whether a fact counts anywhere in the package:

```text
status is ACTIVE
  AND effectiveFrom <= validAt < effectiveTo
  AND record window contains knownAt
```

Start inclusive, end exclusive. A null `knownAt` means latest knowledge, which requires an open record window. Superseded and voided records remain readable for reconstruction and never satisfy this.

## Consequences

Point-in-time reconstruction is real, not aspirational: an acceptance test evaluates the same decision at two instants and gets different answers because the organizational reality differed. `validate:lineage` asserts unbroken supersede chains, monotonic version numbers, closed superseded windows, no inverted periods, and no overlapping active versions of one logical record.

## Rejected

**Single-dimension valid time only.** Cannot answer "what did we believe then?".

**Full bitemporality with retroactive valid-time correction chains.** More than v0.1 needs, and much harder to validate.

**Soft-delete flags.** A deleted flag is a hard delete with extra steps. Supersede and void carry lineage; a flag does not.
