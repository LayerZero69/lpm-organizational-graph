# ADR-006. Risk semantics: semantic levels, never a portable numbered tier

**Status:** Accepted, Phase 1A. Directed by the Phase 1A authorization.

## Decision

The graph package uses **semantic risk levels only**: `LOW`, `MODERATE`, `HIGH`, `CRITICAL`.

The package **never assigns portable business meaning to a numbered tier**. Every adapter that receives a numbered tier must identify its source scheme and map explicitly. There is no default scheme, and an unmapped tier throws rather than being coerced.

There is no field named `riskTier` anywhere in the domain package. Fields are named `riskLevel` and carry a semantic value.

## The conflict this resolves

The Phase 0 assessment expected a corpus-level conflict between two tier systems. What it found was worse: **both directions are live code inside `lpm-os-master` itself**.

| Scheme | Tier 1 means | Tiers | Evidence at commit `879508d` |
|---|---|---|---|
| Retention tier, the `RiskTier` database enum | **Most** severe | 3 | `TIER_1` maps to seven-year audit retention, `TIER_2` to three years, `TIER_3` to one year. The Supervisory Control Capacity input is documented as expecting 1 to 3 with 1 as highest risk |
| Classification tier, the risk-tiering module | **Least** severe | 4 | Tier 1 is "Automated Pass" for low stakes, rising to tier 4 "Human Only" |

Tier 1 therefore means the most severe thing in one scheme and the least severe in the other, and one has four tiers while the other has three.

A field named `riskTier` in this package would silently inherit whichever scheme the reader assumed. Given that a risk limit gates whether a governed agent may act, that is not a naming preference. It is a live governance defect waiting to happen.

## Mapping

`src/adapters/lapemo/risk-mapping.ts`:

| Scheme | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| `RETENTION_TIER` | `CRITICAL` | `HIGH` | `MODERATE` | throws |
| `CLASSIFICATION_TIER` | `LOW` | `MODERATE` | `HIGH` | `CRITICAL` |

`mapNumberedTier` requires the scheme as its first argument. Passing tier 4 to the retention scheme throws `RiskMappingError` rather than returning `CRITICAL`, because a fourth retention tier does not exist and inventing one would hide a data defect at the integration boundary.

A unit test asserts that tier 1 maps to different levels in the two schemes, so nobody can quietly collapse them.

## Consequences

Adapters are slightly more verbose: a caller must name its scheme. That is the intended cost. `riskSchemeMappingTable()` renders both schemes side by side for the integration guide, so the conflict is documented where an implementer will meet it.

## Open for owner ratification

Which scheme applies to which platform field, and whether the platform needs two distinctly named fields rather than one ambiguous `riskTier`. Recorded as IB-002. This ADR does not decide platform naming; it makes the graph safe regardless of the outcome.

## Rejected

**Picking one direction and normalizing silently.** Guarantees a wrong answer for whichever scheme was not chosen.

**Carrying the number through untranslated.** Exports the ambiguity to every consumer.

**A default scheme.** A default is the ambiguity with a friendlier face.
