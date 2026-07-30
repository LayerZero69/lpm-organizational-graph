# Organizational Context Services

## Status: proposed future contract and roadmap concept. It does not exist.

Organizational Context Services is **not** a component of the Lapemo ecosystem today. The phrase appears in no canon file, no governance record, and no product surface anywhere in the workspace. It is recorded as integration blocker IB-010 and must be routed through `lpm-canon` before it appears on any public surface.

Nothing in this repository should be read as a claim that Organizational Context Services currently exists, is available, or is being built.

**Phase 1A defines typed request and response shapes and nothing else.** There is no network service, no endpoint host, no authentication layer, no deployment, and no action execution. The contract exists so that the graph and any future service stay aligned from the start, without building premature infrastructure.

## Proposed definition

A runtime service layer that would let a human, an assistant, a workflow, or a governed agent retrieve trusted organizational context before making or executing a decision.

RAG retrieves documents. MCP exposes tools. The proposed service would deliver structured organizational understanding.

## Proposed context endpoints

| Endpoint | Would answer |
|---|---|
| Ownership context | Who owns this outcome, entity, or domain, with lineage |
| Authority context | What an actor is authorized to decide or do, within what limits, from active grants and delegation chains |
| Governance context | Which policies, controls, review requirements and risk levels apply |
| Decision context | How this class of decision is made, its autonomy ceiling, gates, and escalation path |
| Accountability context | Which human is accountable and which human supervises |

## Response envelope

Every response would carry:

- `asOf` timestamp. All answers are temporal.
- Organization scope.
- Ontology version, rule-set version, schema version, context contract version.
- Confidence.
- Staleness indicators for the underlying signals.
- Evidence references.
- `readOnly: true`, which is a literal type, not a flag that could be set false.

`src/context/schemas.ts` validates all seven properties. `assertValidEnvelope` throws with the specific reasons when any is missing, and there are contract tests for each.

## Non-goals

- **Read-only.** It would never execute an action.
- **Organization-scoped.** There would be no cross-organization context.
- **Governed graph only.** It would never improvise context from unstructured sources.
- **Not built in Phase 1A.** Contract types only.

## Relationship to this repository

The authority evaluator, the query services and these typed contracts are the engine such a service would wrap. Building the service surface is a later roadmap phase and is not authorized.
