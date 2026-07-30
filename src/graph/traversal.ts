/**
 * Typed traversal helpers.
 *
 * Direction is a property of the edge type, not of the call site. These helpers
 * make the single canonical direction explicit and handle the reverse path,
 * which is why the ontology needs no reversed aliases.
 */

import type { GraphNode } from '../domain/nodes/index.js'
import type { EdgeType, GraphEdge } from '../domain/edges/index.js'
import type { GraphRepository } from './repository.js'
import type { TemporalContext } from './temporal.js'

/** Follow an edge type forward from a node, returning the target nodes. */
export async function followOutbound(
  repo: GraphRepository,
  edgeType: EdgeType,
  fromLogicalId: string,
  organizationId: string,
  ctx: TemporalContext,
): Promise<GraphNode[]> {
  const edges = await repo.findEdges({ organizationId, edgeType, fromLogicalId }, ctx)
  return resolveTargets(repo, edges, organizationId, ctx, 'to')
}

/** Follow an edge type backward into a node, returning the source nodes. */
export async function followInbound(
  repo: GraphRepository,
  edgeType: EdgeType,
  toLogicalId: string,
  organizationId: string,
  ctx: TemporalContext,
): Promise<GraphNode[]> {
  const edges = await repo.findEdges({ organizationId, edgeType, toLogicalId }, ctx)
  return resolveTargets(repo, edges, organizationId, ctx, 'from')
}

async function resolveTargets(
  repo: GraphRepository,
  edges: readonly GraphEdge[],
  organizationId: string,
  ctx: TemporalContext,
  end: 'from' | 'to',
): Promise<GraphNode[]> {
  const resolved: GraphNode[] = []
  for (const edge of edges) {
    const logicalId = end === 'to' ? edge.toLogicalId : edge.fromLogicalId
    const node = await repo.getNode(logicalId, organizationId, ctx)
    if (node !== null) resolved.push(node)
  }
  return resolved
}

/**
 * Follow an edge type backward and return the edges themselves alongside their
 * source nodes. Used where the evaluator needs the edge confidence, not just the
 * node at the other end.
 */
export async function inboundWithEdges(
  repo: GraphRepository,
  edgeType: EdgeType,
  toLogicalId: string,
  organizationId: string,
  ctx: TemporalContext,
): Promise<Array<{ edge: GraphEdge; node: GraphNode }>> {
  const edges = await repo.findEdges({ organizationId, edgeType, toLogicalId }, ctx)
  const pairs: Array<{ edge: GraphEdge; node: GraphNode }> = []
  for (const edge of edges) {
    const node = await repo.getNode(edge.fromLogicalId, organizationId, ctx)
    if (node !== null) pairs.push({ edge, node })
  }
  return pairs
}

export async function outboundWithEdges(
  repo: GraphRepository,
  edgeType: EdgeType,
  fromLogicalId: string,
  organizationId: string,
  ctx: TemporalContext,
): Promise<Array<{ edge: GraphEdge; node: GraphNode }>> {
  const edges = await repo.findEdges({ organizationId, edgeType, fromLogicalId }, ctx)
  const pairs: Array<{ edge: GraphEdge; node: GraphNode }> = []
  for (const edge of edges) {
    const node = await repo.getNode(edge.toLogicalId, organizationId, ctx)
    if (node !== null) pairs.push({ edge, node })
  }
  return pairs
}
