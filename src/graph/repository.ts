/**
 * The graph repository port.
 *
 * The domain evaluator and every query service depend on this interface and
 * never on a database. That is what lets Phase 1B add a Lapemo-backed adapter
 * without touching the evaluator: a new implementation of this port is the whole
 * integration surface.
 *
 * Every read is organization-scoped and temporally qualified. There is no method
 * that returns "the current state" without a TemporalContext, because there is
 * no such thing as an untimed answer in a temporal graph.
 *
 * The port is deliberately READ-ONLY. This package computes and explains; it
 * never writes into a system that owns the record.
 */

import type { GraphNode } from '../domain/nodes/index.js'
import type { GraphEdge, EdgeType } from '../domain/edges/index.js'
import type { NodeType } from '../domain/enums/index.js'
import type { TemporalContext } from './temporal.js'

export interface NodeQuery {
  readonly organizationId: string
  readonly nodeType?: NodeType
  readonly logicalIds?: readonly string[]
}

export interface EdgeQuery {
  readonly organizationId: string
  readonly edgeType?: EdgeType
  readonly fromLogicalId?: string
  readonly toLogicalId?: string
}

export interface GraphRepository {
  /**
   * Resolve one node by logical id, returning the version effective in the given
   * temporal context. Returns null when no version is effective then.
   */
  getNode(logicalId: string, organizationId: string, ctx: TemporalContext): Promise<GraphNode | null>

  /**
   * Resolve the most recently recorded version of a node REGARDLESS of valid
   * time, ignoring whether it is currently effective.
   *
   * This is not a convenience. An expired authority grant has to be findable in
   * order to be reported as expired: if the only available read filtered it out,
   * the evaluator could not tell "the authority ran out" apart from "there was
   * never any authority", and those are different findings with different
   * clearing predicates.
   */
  getLatestVersion(logicalId: string, organizationId: string): Promise<GraphNode | null>

  /** All node versions for a logical id, newest first, including superseded ones. */
  getNodeHistory(logicalId: string, organizationId: string): Promise<readonly GraphNode[]>

  /** Nodes matching the query and effective in the given temporal context. */
  findNodes(query: NodeQuery, ctx: TemporalContext): Promise<readonly GraphNode[]>

  /**
   * Nodes matching the query regardless of valid time, one entry per logical id
   * (the most recently recorded version). Used for the same reason as
   * getLatestVersion: to distinguish absent from lapsed.
   */
  findAllVersions(query: NodeQuery): Promise<readonly GraphNode[]>

  /** Edges matching the query and effective in the given temporal context. */
  findEdges(query: EdgeQuery, ctx: TemporalContext): Promise<readonly GraphEdge[]>
}

/** Narrow a node to an expected type, or return null. Keeps call sites readable. */
export function asNodeType<T extends NodeType>(
  node: GraphNode | null,
  nodeType: T,
): Extract<GraphNode, { nodeType: T }> | null {
  if (node === null || node.nodeType !== nodeType) return null
  return node as Extract<GraphNode, { nodeType: T }>
}
