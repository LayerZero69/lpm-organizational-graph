/**
 * In-memory graph repository.
 *
 * The only repository implementation shipped in Phase 1A. It requires no
 * database, no service container, and no network, which is what lets the whole
 * test suite and the demonstration run deterministically anywhere.
 *
 * It is a faithful implementation of the port, not a stub: it honors
 * organization scoping, both temporal dimensions, and supersede lineage, so a
 * later Lapemo-backed adapter has a real reference behavior to match.
 */

import type { GraphNode } from '../../domain/nodes/index.js'
import type { GraphEdge } from '../../domain/edges/index.js'
import type { GraphRepository, NodeQuery, EdgeQuery } from '../../graph/repository.js'
import type { TemporalContext } from '../../graph/temporal.js'
import { isEffective, byMostRecentFirst } from '../../graph/temporal.js'

export interface GraphDataset {
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly GraphEdge[]
}

export class InMemoryGraphRepository implements GraphRepository {
  private readonly nodes: readonly GraphNode[]
  private readonly edges: readonly GraphEdge[]

  constructor(dataset: GraphDataset) {
    this.nodes = dataset.nodes
    this.edges = dataset.edges
  }

  async getNode(logicalId: string, organizationId: string, ctx: TemporalContext): Promise<GraphNode | null> {
    const candidates = this.nodes
      .filter((node) => node.logicalId === logicalId)
      .filter((node) => node.organizationId === organizationId)
      .filter((node) => isEffective(node, ctx))
      .sort(byMostRecentFirst)
    return candidates[0] ?? null
  }

  async getLatestVersion(logicalId: string, organizationId: string): Promise<GraphNode | null> {
    const candidates = this.nodes
      .filter((node) => node.logicalId === logicalId)
      .filter((node) => node.organizationId === organizationId)
      .filter((node) => node.status !== 'VOIDED')
      .sort(byMostRecentFirst)
    return candidates[0] ?? null
  }

  async findAllVersions(query: NodeQuery): Promise<readonly GraphNode[]> {
    const wanted = query.logicalIds === undefined ? null : new Set(query.logicalIds)
    const matching = this.nodes
      .filter((node) => node.organizationId === query.organizationId)
      .filter((node) => query.nodeType === undefined || node.nodeType === query.nodeType)
      .filter((node) => wanted === null || wanted.has(node.logicalId))
      .filter((node) => node.status !== 'VOIDED')
      .sort(byMostRecentFirst)

    // One entry per logical id: the most recently recorded version.
    const seen = new Set<string>()
    const latest: GraphNode[] = []
    for (const node of matching) {
      if (seen.has(node.logicalId)) continue
      seen.add(node.logicalId)
      latest.push(node)
    }
    return latest
  }

  async getNodeHistory(logicalId: string, organizationId: string): Promise<readonly GraphNode[]> {
    return this.nodes
      .filter((node) => node.logicalId === logicalId)
      .filter((node) => node.organizationId === organizationId)
      .slice()
      .sort(byMostRecentFirst)
  }

  async findNodes(query: NodeQuery, ctx: TemporalContext): Promise<readonly GraphNode[]> {
    const wanted = query.logicalIds === undefined ? null : new Set(query.logicalIds)
    return this.nodes
      .filter((node) => node.organizationId === query.organizationId)
      .filter((node) => query.nodeType === undefined || node.nodeType === query.nodeType)
      .filter((node) => wanted === null || wanted.has(node.logicalId))
      .filter((node) => isEffective(node, ctx))
      .sort(byMostRecentFirst)
  }

  async findEdges(query: EdgeQuery, ctx: TemporalContext): Promise<readonly GraphEdge[]> {
    return this.edges
      .filter((edge) => edge.organizationId === query.organizationId)
      .filter((edge) => query.edgeType === undefined || edge.edgeType === query.edgeType)
      .filter((edge) => query.fromLogicalId === undefined || edge.fromLogicalId === query.fromLogicalId)
      .filter((edge) => query.toLogicalId === undefined || edge.toLogicalId === query.toLogicalId)
      .filter((edge) => isEffective(edge, ctx))
      .sort(byMostRecentFirst)
  }

  /** Full dataset access for validation scripts. Not part of the port. */
  snapshot(): GraphDataset {
    return { nodes: this.nodes, edges: this.edges }
  }
}
