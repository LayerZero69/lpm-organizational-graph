/**
 * Typed edge contracts.
 *
 * Direction convention: every edge type has exactly ONE canonical direction and
 * there are no reversed aliases. Traversal handles the reverse path. OWNED_BY,
 * PARENT_OF and similar inversions are deliberately absent. See docs/ONTOLOGY.md.
 */

import type { TemporalFields } from '../../graph/temporal.js'
import type { SourceRef } from '../identity.js'
import type { NodeType } from '../enums/index.js'

export const EDGE_TYPES = [
  // Structure and identity
  'PART_OF',
  'ASSIGNED_TO',
  'OCCUPIES',
  'REPORTS_TO',
  // Ownership and supervision
  'OWNS',
  'ACCOUNTABLE_FOR',
  'SUPERVISES',
  'OPERATES',
  'SPONSORS',
  'TECHNICALLY_OWNS',
  // Authority
  'GRANTS',
  'AUTHORIZES',
  'COVERS',
  'LIMITED_TO',
  'REQUIRES_REVIEW_BY',
  'DERIVED_FROM',
  'SUPERSEDES',
  'REVOKES',
  // Permission, technical and never organizational
  'HAS_PERMISSION',
  'PERMITS_IN',
  // Decision and execution
  'INITIATES',
  'MAKES',
  'INSTANCE_OF',
  'AUTHORIZED_BY',
  'GOVERNED_BY',
  'CHECKED_BY',
  'USES',
  'SUPPORTED_BY',
  'PRODUCES',
  'PERFORMS',
  'EXECUTED_IN',
  'INVOKES',
  'MODIFIES',
  'RESULTS_IN',
  'ESCALATED_TO',
  'REVIEWS',
  'VALIDATES',
  // Information and evidence
  'SOURCED_FROM',
  'AUTHORITATIVE_FOR',
  'DERIVED_FROM_EVIDENCE',
  'GENERATES',
  'VERIFIED_BY',
] as const

export type EdgeType = (typeof EDGE_TYPES)[number]

export interface GraphEdge extends TemporalFields {
  readonly id: string
  readonly organizationId: string
  readonly edgeType: EdgeType
  readonly fromNodeType: NodeType
  readonly fromLogicalId: string
  readonly toNodeType: NodeType
  readonly toLogicalId: string
  readonly confidence: number
  readonly sourceRef: SourceRef | null
  readonly evidenceObjectLogicalId: string | null
  readonly metadata: Readonly<Record<string, string | number | boolean>>
  /**
   * True when this edge is a derived projection of a record that another system
   * owns, and therefore must never be written back. False when the edge is
   * canonical in this graph. See ADR-002.
   */
  readonly isProjection: boolean
}

/** Cardinality constraint applied to the edges of a type sharing an endpoint. */
export type EdgeCardinality =
  /** At most one effective edge of this type into the target at any instant. */
  | 'EXACTLY_ONE_ACTIVE_INBOUND'
  /** At most one effective edge of this type out of the source at any instant. */
  | 'EXACTLY_ONE_ACTIVE_OUTBOUND'
  | 'MANY_TO_MANY'
  | 'MANY_TO_ONE'

/** The machine-readable relationship contract for one edge type. */
export interface RelationshipContract {
  readonly edgeType: EdgeType
  readonly allowedSourceTypes: readonly NodeType[]
  readonly allowedTargetTypes: readonly NodeType[]
  /** Plain-language statement of the single canonical direction. */
  readonly direction: string
  readonly cardinality: EdgeCardinality
  /** Whether overlapping effective periods are permitted for the same endpoints. */
  readonly allowsTemporalOverlap: boolean
  readonly requiresEvidence: boolean
  readonly minimumConfidence: number | null
  /**
   * Which Lapemo record owns this relationship today, keyed BY SOURCE NODE TYPE.
   *
   * Ownership is per source type, not per edge type, because one edge type can
   * be canonical in this graph for one pair and a projection for another. COVERS
   * is the clearest case: an AuthorityGrant covering a DecisionType exists
   * nowhere else and is graph-canonical, while a Control covering a DecisionType
   * is owned by the platform governance control and must be projected.
   *
   * An entry means: for edges starting at that node type, the named Lapemo
   * record is the writable truth and the edge must be a derived projection.
   * Null, or an absent key, means the graph is the first system to model it.
   */
  readonly lapemoSourceOfTruth: Readonly<Partial<Record<NodeType, string>>> | null
  readonly notes: string
}
