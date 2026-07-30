# ADR-009. Autonomy boundary: canon is authoritative, the platform enum is mapped at the edge

**Status:** Accepted, Phase 1A. Directed by the Phase 1A authorization.

This ADR does not exist in the original brief's list. It was added because Phase 0 found the platform migration unfinished, which the brief did not anticipate.

## Decision

`lpm-canon` is authoritative for the autonomy spectrum. The graph uses the canonical five levels:

1. Human Only
2. Human Approved
3. Agent Assisted (canonical baseline)
4. Agent Supervised (earned)
5. Agent Autonomous (earned)

**Agent Autonomous Plus is not introduced anywhere.** The retired value appears only in `src/adapters/lapemo/autonomy-mapping.ts`, whose sole job is to map it away, and in documents that explain the conflict. `scripts/validate-voice.ts` enforces that mechanically and fails the build otherwise.

## The conflict

The platform Prisma enum at commit `879508d` is `HUMAN_ONLY, HUMAN_APPROVED, AGENT_ASSISTED, AGENT_AUTONOMOUS, AGENT_AUTONOMOUS_PLUS`. Its top two labels are **shifted by one position** relative to canon:

| Platform value | Canon position | Canon meaning | Name misleads |
|---|---|---|---|
| `HUMAN_ONLY` | 1 | Human Only | no |
| `HUMAN_APPROVED` | 2 | Human Approved | no |
| `AGENT_ASSISTED` | 3 | Agent Assisted | no |
| `AGENT_AUTONOMOUS` | 4 | **Agent Supervised** | **yes** |
| `AGENT_AUTONOMOUS_PLUS` | 5 | **Agent Autonomous** | **yes** |

Reading a platform value by its **name** rather than its **position** silently promotes a supervised governed agent to autonomous. That is a governance failure, not a labeling inconvenience.

Two compounding facts found in Phase 0:

- The platform holds **two disagreeing autonomy representations**. Its display module renders the canon labels against a numeric one to five scale, while the persisted enum carries the shifted names.
- A ratified platform ADR spells the stale names into its decision text, so correcting the enum also requires amending that ADR.

## Why map at the adapter rather than adopt the platform names

Adopting the platform enum would import a known-wrong label set into a package whose entire purpose is governing authority. Canon is the higher source, the authorization directs canon, and the conflict is already tracked as ecosystem deferred item D1.

Mapping in exactly one module means there is one place to audit, one place to test, and one file to **delete** when D1 lands. The mapping module is designed to be removed, not maintained.

## Autonomy remains temporal, earned and derived

- Temporal: `AutonomyState` carries an effective period and supersede lineage. It is never a mutable scalar on the governed agent.
- Business-granted: every state records the business owner who granted it, never engineering by default.
- Evidence-backed: any level above the canonical baseline requires gate-clearance evidence that resolves. AUTH-007 enforces it.
- Derived ceiling: the ceiling for a decision context is supplied at evaluation time by `AutonomyCeilingProvider` and is never stored. The derivation is ratified and owned by the platform; this package consumes the result and does not reimplement it.

## Validation

`validate:ontology` compares the pinned spectrum against a sibling `../lpm-canon` checkout when one exists, checking the version, the ordered names, the baseline, and the absence of any Agent Autonomous Plus level. When no sibling checkout exists the check is **skipped loudly** and reported, never assumed to pass.

## To close

Complete ecosystem deferred item D1. Then delete `autonomy-mapping.ts` rather than editing it, and remove its exemption from the voice validator.
