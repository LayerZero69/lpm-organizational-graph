/**
 * Deterministic ontology validation.
 *
 * Validates nodes and edges against the relationship contract registry and the
 * temporal contracts. Pure functions, no I/O, no clock reads. Every violation
 * carries a stable code so `validate:ontology` output is machine-readable.
 */

import type { GraphNode } from '../nodes/index.js'
import type { GraphEdge } from '../edges/index.js'
import { relationshipContract } from './registry.js'
import { hasInvertedPeriod, periodsOverlap } from '../../graph/temporal.js'

export interface OntologyViolation {
  readonly code: string
  readonly subject: string
  readonly message: string
}

function violation(code: string, subject: string, message: string): OntologyViolation {
  return { code, subject, message }
}

/** Validate a single node against the shared node contract. */
export function validateNode(node: GraphNode): OntologyViolation[] {
  const found: OntologyViolation[] = []
  const subject = `${node.nodeType}:${node.logicalId}@${node.versionId}`

  if (node.organizationId.trim() === '') {
    found.push(violation('NODE_UNSCOPED', subject, 'organizationId is required and must be non-empty. All traversal is organization-scoped.'))
  }
  if (node.versionNumber < 1 || !Number.isInteger(node.versionNumber)) {
    found.push(violation('NODE_BAD_VERSION_NUMBER', subject, `versionNumber must be a positive integer, got ${node.versionNumber}.`))
  }
  if (node.confidence < 0 || node.confidence > 1) {
    found.push(violation('NODE_CONFIDENCE_OUT_OF_RANGE', subject, `confidence must sit on the 0.0 to 1.0 scale, got ${node.confidence}.`))
  }
  if (hasInvertedPeriod(node)) {
    found.push(violation('NODE_INVERTED_PERIOD', subject, 'A record period ends before it begins.'))
  }
  if (node.versionNumber === 1 && node.supersedesVersionId !== null) {
    found.push(violation('NODE_FIRST_VERSION_SUPERSEDES', subject, 'Version 1 cannot supersede an earlier version.'))
  }
  if (node.versionNumber > 1 && node.supersedesVersionId === null) {
    found.push(violation('NODE_MISSING_SUPERSEDE_LINEAGE', subject, `Version ${node.versionNumber} must record the version it superseded. Supersede lineage is append-only and unbroken.`))
  }
  if (node.status === 'SUPERSEDED' && node.recordedTo === null) {
    found.push(violation('NODE_SUPERSEDED_NOT_CLOSED', subject, 'A superseded version must have its record-time window closed. See ADR-003.'))
  }

  // Node-specific invariants that the type system cannot express.
  if (node.nodeType === 'AutonomyState') {
    if (node.grantingBusinessOwnerPersonId.trim() === '') {
      found.push(violation('AUTONOMY_STATE_NO_GRANTOR', subject, 'An autonomy state must record the business owner who granted it.'))
    }
  }
  if (node.nodeType === 'AuthorityGrant') {
    if (node.derivedFromGrantLogicalId === null && node.organizationalSource === null) {
      found.push(violation('GRANT_NO_AUTHORITY_SOURCE', subject, 'An authority grant must either derive from another grant or name an organizational source. A grant that comes from nowhere is not authority.'))
    }
    if (node.derivedFromGrantLogicalId !== null && node.organizationalSource !== null) {
      found.push(violation('GRANT_AMBIGUOUS_AUTHORITY_SOURCE', subject, 'An authority grant cannot both derive from another grant and claim to be a root organizational source.'))
    }
    if (node.grantee.actorType === 'System') {
      found.push(violation('GRANT_TO_SYSTEM', subject, 'A system cannot hold organizational authority. Authority is held by a Person or a governed agent.'))
    }
    const overlap = node.allowedActions.filter((a) => node.prohibitedActions.includes(a))
    if (overlap.length > 0) {
      found.push(violation('GRANT_CONTRADICTORY_ACTIONS', subject, `Actions appear as both allowed and prohibited: ${overlap.join(', ')}.`))
    }
  }
  if (node.nodeType === 'Outcome' && node.accountablePersonLogicalId.trim() === '') {
    found.push(violation('OUTCOME_NO_ACCOUNTABLE_PERSON', subject, 'A tool cannot own an outcome. A named Person must remain accountable.'))
  }

  return found
}

/** Validate a single edge against its relationship contract. */
export function validateEdge(edge: GraphEdge): OntologyViolation[] {
  const found: OntologyViolation[] = []
  const subject = `${edge.edgeType}:${edge.id}`

  let contract
  try {
    contract = relationshipContract(edge.edgeType)
  } catch {
    return [violation('EDGE_UNREGISTERED_TYPE', subject, `Edge type ${edge.edgeType} has no relationship contract.`)]
  }

  if (!contract.allowedSourceTypes.includes(edge.fromNodeType)) {
    found.push(violation('EDGE_BAD_SOURCE_TYPE', subject, `${edge.edgeType} may not start at ${edge.fromNodeType}. Allowed: ${contract.allowedSourceTypes.join(', ')}.`))
  }
  if (!contract.allowedTargetTypes.includes(edge.toNodeType)) {
    found.push(violation('EDGE_BAD_TARGET_TYPE', subject, `${edge.edgeType} may not end at ${edge.toNodeType}. Allowed: ${contract.allowedTargetTypes.join(', ')}.`))
  }
  if (edge.organizationId.trim() === '') {
    found.push(violation('EDGE_UNSCOPED', subject, 'organizationId is required on every edge.'))
  }
  if (edge.confidence < 0 || edge.confidence > 1) {
    found.push(violation('EDGE_CONFIDENCE_OUT_OF_RANGE', subject, `confidence must sit on the 0.0 to 1.0 scale, got ${edge.confidence}.`))
  }
  if (contract.minimumConfidence !== null && edge.confidence < contract.minimumConfidence) {
    found.push(violation('EDGE_CONFIDENCE_BELOW_MINIMUM', subject, `${edge.edgeType} requires confidence of at least ${contract.minimumConfidence}.`))
  }
  if (contract.requiresEvidence && edge.evidenceObjectLogicalId === null) {
    found.push(violation('EDGE_MISSING_EVIDENCE', subject, `${edge.edgeType} requires a supporting evidence object.`))
  }
  if (hasInvertedPeriod(edge)) {
    found.push(violation('EDGE_INVERTED_PERIOD', subject, 'The edge period ends before it begins.'))
  }
  // Ownership is per source type: the same edge type can be graph-canonical for
  // one pair and a Lapemo projection for another.
  const owner = contract.lapemoSourceOfTruth?.[edge.fromNodeType] ?? null
  if (owner !== null && !edge.isProjection) {
    found.push(violation('EDGE_SHOULD_BE_PROJECTION', subject, `${edge.edgeType} from ${edge.fromNodeType} is owned by Lapemo (${owner}) and must be marked as a projection. Two writable truths for one relationship are prohibited.`))
  }
  if (owner === null && edge.isProjection) {
    found.push(violation('EDGE_FALSE_PROJECTION', subject, `${edge.edgeType} from ${edge.fromNodeType} is canonical in this graph and must not claim to be a projection of a Lapemo record.`))
  }

  return found
}

/**
 * Validate cardinality and temporal-overlap rules across a whole edge set.
 * These are set-level invariants that a single edge cannot violate alone.
 */
export function validateEdgeSet(edges: readonly GraphEdge[]): OntologyViolation[] {
  const found: OntologyViolation[] = []
  const active = edges.filter((e) => e.status === 'ACTIVE')

  const byTypeAndEndpoint = new Map<string, GraphEdge[]>()
  for (const edge of active) {
    let contract
    try {
      contract = relationshipContract(edge.edgeType)
    } catch {
      continue
    }
    let key: string | null = null
    if (contract.cardinality === 'EXACTLY_ONE_ACTIVE_INBOUND') {
      key = `${edge.edgeType}|in|${edge.toLogicalId}`
    } else if (contract.cardinality === 'EXACTLY_ONE_ACTIVE_OUTBOUND') {
      key = `${edge.edgeType}|out|${edge.fromLogicalId}`
    } else if (contract.cardinality === 'MANY_TO_ONE') {
      key = `${edge.edgeType}|out|${edge.fromLogicalId}`
    }
    if (key === null) continue
    const bucket = byTypeAndEndpoint.get(key)
    if (bucket) bucket.push(edge)
    else byTypeAndEndpoint.set(key, [edge])
  }

  for (const [key, bucket] of byTypeAndEndpoint) {
    if (bucket.length < 2) continue
    const first = bucket[0]
    if (!first) continue
    const contract = relationshipContract(first.edgeType)
    if (contract.allowsTemporalOverlap) continue
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const a = bucket[i]
        const b = bucket[j]
        if (!a || !b) continue
        if (periodsOverlap(a, b)) {
          found.push(
            violation(
              'EDGE_CARDINALITY_VIOLATION',
              key,
              `${contract.cardinality} is violated: ${a.id} and ${b.id} are both effective over an overlapping period.`,
            ),
          )
        }
      }
    }
  }

  return found
}

/** Validate that every edge endpoint resolves to a node present in the set. */
export function validateReferentialIntegrity(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): OntologyViolation[] {
  const found: OntologyViolation[] = []
  const byLogicalId = new Map<string, GraphNode>()
  for (const node of nodes) byLogicalId.set(node.logicalId, node)

  for (const edge of edges) {
    const from = byLogicalId.get(edge.fromLogicalId)
    const to = byLogicalId.get(edge.toLogicalId)
    if (!from) {
      found.push(violation('EDGE_DANGLING_SOURCE', edge.id, `Source ${edge.fromLogicalId} resolves to no node.`))
    } else if (from.nodeType !== edge.fromNodeType) {
      found.push(violation('EDGE_SOURCE_TYPE_MISMATCH', edge.id, `Edge declares source type ${edge.fromNodeType} but ${edge.fromLogicalId} is a ${from.nodeType}.`))
    }
    if (!to) {
      found.push(violation('EDGE_DANGLING_TARGET', edge.id, `Target ${edge.toLogicalId} resolves to no node.`))
    } else if (to.nodeType !== edge.toNodeType) {
      found.push(violation('EDGE_TARGET_TYPE_MISMATCH', edge.id, `Edge declares target type ${edge.toNodeType} but ${edge.toLogicalId} is a ${to.nodeType}.`))
    }
    if (from && to && from.organizationId !== to.organizationId) {
      found.push(violation('EDGE_CROSSES_ORGANIZATION', edge.id, 'An edge may not cross an organizational boundary. There is no cross-organization traversal.'))
    }
  }

  return found
}

/** Run every ontology check over a complete graph. */
export function validateGraph(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): OntologyViolation[] {
  return [
    ...nodes.flatMap(validateNode),
    ...edges.flatMap(validateEdge),
    ...validateEdgeSet(edges),
    ...validateReferentialIntegrity(nodes, edges),
  ]
}
