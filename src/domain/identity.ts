/**
 * Identity contracts.
 *
 * Three identifiers, never conflated (see docs/ADR/ADR-007-identity-and-versioning.md):
 *
 *   sourceRef   which record, in which system, this fact came from
 *   logicalId   the thing itself, stable across every version of it
 *   versionId   this one immutable version of the thing
 *
 * The Lapemo platform has no version identifier of its own. Its supersede chains
 * give lineage while the row mutates in place, so an adapter synthesizes
 * versionId at projection time and records that it did so through
 * `versionIdOrigin`. A consumer must be able to tell a real version identity
 * from a synthesized one.
 */

import type { SourceResolutionStatus } from './enums/index.js'

/** A reference to the originating record in an external system of record. */
export interface SourceRef {
  /** Stable system identifier, for example 'lapemo' or 'erp.netsuite'. */
  readonly sourceSystem: string
  /** The identifier that system uses for the record. */
  readonly sourceRecordId: string
  /** When the source system recorded the fact, if known. ISO 8601. */
  readonly sourceRecordedAt: string | null
  /**
   * Confidence that this graph node and that source record are the same thing.
   * Anything other than CONFIRMED degrades evaluation confidence rather than
   * being silently treated as resolved.
   */
  readonly resolutionStatus: SourceResolutionStatus
}

export type VersionIdOrigin =
  /** The source system supplied a genuine immutable version identifier. */
  | 'NATIVE'
  /** The adapter synthesized it because the source has no version identity. */
  | 'SYNTHESIZED'
  /** Authored directly in this package, for example a synthetic fixture. */
  | 'GRAPH_NATIVE'

/** The full identity triple carried by every governed node. */
export interface NodeIdentity {
  readonly logicalId: string
  readonly versionId: string
  /** Monotonic per logicalId, starting at 1. */
  readonly versionNumber: number
  readonly versionIdOrigin: VersionIdOrigin
  readonly sourceRef: SourceRef | null
}

/** A typed pointer to an actor, used where a node may reference a Person or an Agent. */
export interface ActorRef {
  readonly actorType: 'Person' | 'Agent' | 'System'
  readonly logicalId: string
}

/** A monetary amount. Currency is always explicit; a bare number is never a limit. */
export interface MonetaryAmount {
  readonly amount: number
  readonly currency: string
}

export function sameCurrency(a: MonetaryAmount, b: MonetaryAmount): boolean {
  return a.currency === b.currency
}

/**
 * Build a deterministic version identifier for authored fixtures.
 * Deliberately not random, so fixtures and demonstrations are reproducible.
 */
export function fixtureVersionId(logicalId: string, versionNumber: number): string {
  return `${logicalId}#v${versionNumber}`
}
