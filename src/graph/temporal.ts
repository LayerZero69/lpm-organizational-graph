/**
 * Bitemporal-lite temporal contracts.
 *
 * Valid time  (effectiveFrom / effectiveTo) when a fact held in the organization.
 * Record time (recordedFrom / recordedTo)   when the graph knew the fact.
 *
 * A change never overwrites. It appends a successor version, closes the
 * predecessor's record-time window, and links the two with a SUPERSEDES edge in
 * the same operation. See docs/ADR/ADR-003-temporal-lineage.md.
 *
 * There are no hard deletes anywhere in the domain. A record is superseded or
 * voided, never destroyed.
 */

import type { RecordStatus } from '../domain/enums/index.js'

/**
 * The moment an evaluation is asked about.
 *
 * `validAt`  which organizational reality to reconstruct. Required.
 * `knownAt`  which state of knowledge to reconstruct it from. Null means
 *            "everything the graph knows now", which is the common case.
 *
 * Separating the two is what makes "what did we believe at the time?" a
 * different question from "what was actually true at the time?".
 */
export interface TemporalContext {
  readonly validAt: string
  readonly knownAt: string | null
}

export function temporalContext(validAt: string, knownAt: string | null = null): TemporalContext {
  return { validAt, knownAt }
}

/** The temporal shape every governed node and edge carries. */
export interface TemporalFields {
  readonly status: RecordStatus
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
  readonly recordedFrom: string
  readonly recordedTo: string | null
  /** The version this one replaced, if any. Append-only supersede lineage. */
  readonly supersedesVersionId: string | null
}

function toMillis(iso: string): number {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) throw new Error(`Invalid ISO 8601 timestamp: ${iso}`)
  return ms
}

/** Valid-time containment. Start is inclusive, end is exclusive. */
export function isValidAt(fields: TemporalFields, validAt: string): boolean {
  const at = toMillis(validAt)
  if (toMillis(fields.effectiveFrom) > at) return false
  if (fields.effectiveTo !== null && toMillis(fields.effectiveTo) <= at) return false
  return true
}

/** Record-time containment. A null knownAt means "use the latest knowledge". */
export function isKnownAt(fields: TemporalFields, knownAt: string | null): boolean {
  if (knownAt === null) return fields.recordedTo === null
  const at = toMillis(knownAt)
  if (toMillis(fields.recordedFrom) > at) return false
  if (fields.recordedTo !== null && toMillis(fields.recordedTo) <= at) return false
  return true
}

/**
 * The single predicate the whole package uses to decide whether a fact counts.
 *
 * A fact counts when its record lifecycle is ACTIVE, it held in the organization
 * at validAt, and the graph knew it at knownAt. VOIDED and SUPERSEDED records
 * remain readable for historical reconstruction but never satisfy this.
 */
export function isEffective(fields: TemporalFields, ctx: TemporalContext): boolean {
  if (fields.status !== 'ACTIVE') return false
  return isValidAt(fields, ctx.validAt) && isKnownAt(fields, ctx.knownAt)
}

/** True when the record was closed before it began, which is always a data defect. */
export function hasInvertedPeriod(fields: TemporalFields): boolean {
  if (fields.effectiveTo !== null && toMillis(fields.effectiveTo) < toMillis(fields.effectiveFrom)) return true
  if (fields.recordedTo !== null && toMillis(fields.recordedTo) < toMillis(fields.recordedFrom)) return true
  return false
}

/** True when two valid-time periods overlap at all. Used by uniqueness invariants. */
export function periodsOverlap(a: TemporalFields, b: TemporalFields): boolean {
  const aStart = toMillis(a.effectiveFrom)
  const aEnd = a.effectiveTo === null ? Number.POSITIVE_INFINITY : toMillis(a.effectiveTo)
  const bStart = toMillis(b.effectiveFrom)
  const bEnd = b.effectiveTo === null ? Number.POSITIVE_INFINITY : toMillis(b.effectiveTo)
  return aStart < bEnd && bStart < aEnd
}

/**
 * Close a predecessor version as part of an append-only supersede.
 *
 * ADR-003 requires this be explicit rather than implied. The predecessor's
 * record-time window is closed at the moment the successor was recorded, and its
 * lifecycle marker moves to SUPERSEDED. Valid time is untouched, because what
 * held in the organization did not change retroactively just because the graph
 * learned something new.
 */
export function closePredecessor<T extends TemporalFields>(predecessor: T, successorRecordedFrom: string): T {
  return {
    ...predecessor,
    status: 'SUPERSEDED',
    recordedTo: successorRecordedFrom,
  }
}

/** Order effective records newest-first by valid-time start, then record-time start. */
export function byMostRecentFirst(a: TemporalFields, b: TemporalFields): number {
  const validDelta = toMillis(b.effectiveFrom) - toMillis(a.effectiveFrom)
  if (validDelta !== 0) return validDelta
  return toMillis(b.recordedFrom) - toMillis(a.recordedFrom)
}
