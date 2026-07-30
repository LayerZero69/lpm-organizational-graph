/**
 * Confidence and provenance semantics.
 *
 * Every numeric default in this file is marked as REQUIRING OWNER RATIFICATION.
 * Numeric thresholds and weights are owner decisions. They are proposed here so
 * the package runs deterministically, never asserted as settled.
 *
 * See docs/ADR/ADR-005-confidence-semantics.md.
 */

import type { SourceRef } from '../domain/identity.js'

/**
 * Confidence sits on a single 0.0 to 1.0 scale everywhere.
 *
 * The scale was chosen because every existing confidence-shaped field in the
 * Lapemo platform already uses it: the external entity mapping confidence, the
 * decision-type gate threshold, the recorded AI confidence score, and the agent
 * confidence score. Introducing a second scale would guarantee a conversion bug.
 */
export const CONFIDENCE_SCALE = { min: 0, max: 1 } as const

/**
 * PROPOSED defaults. Owner ratification required before any production use.
 * Nothing in the evaluator hardcodes these; they arrive through this object so a
 * ratified set can replace them in one edit.
 */
export const PROPOSED_CONFIDENCE_DEFAULTS = {
  ownerRatificationRequired: true,
  /** A fact asserted by a named human with evidence. */
  humanAssertedWithEvidence: 0.95,
  /** A fact asserted by a named human without supporting evidence. */
  humanAssertedWithoutEvidence: 0.8,
  /** A fact synchronized from a connector whose identity mapping is confirmed. */
  connectorSyncedConfirmed: 0.9,
  /** A fact synchronized from a connector whose identity mapping is not confirmed. */
  connectorSyncedUnconfirmed: 0.5,
  /** A fact inferred rather than observed. */
  inferred: 0.4,
  /** Multiplier applied when a source identity is proposed rather than confirmed. */
  unresolvedIdentityPenalty: 0.6,
} as const

export function isValidConfidence(value: number): boolean {
  return Number.isFinite(value) && value >= CONFIDENCE_SCALE.min && value <= CONFIDENCE_SCALE.max
}

export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return CONFIDENCE_SCALE.min
  return Math.min(CONFIDENCE_SCALE.max, Math.max(CONFIDENCE_SCALE.min, value))
}

/**
 * Confidence propagation for v0.1: the MINIMUM along the path.
 *
 * A conclusion is never more trustworthy than the least trustworthy fact it
 * rests on. Averaging would let a single unreliable link disappear into a
 * comfortable-looking number, which is the failure mode this whole package
 * exists to prevent.
 */
export function propagateConfidence(values: readonly number[]): number {
  if (values.length === 0) return CONFIDENCE_SCALE.max
  return clampConfidence(Math.min(...values))
}

/** Apply the unresolved-identity penalty when a source mapping is not confirmed. */
export function applySourcePenalty(confidence: number, sourceRef: SourceRef | null): number {
  if (sourceRef === null) return confidence
  if (sourceRef.resolutionStatus === 'CONFIRMED') return confidence
  if (sourceRef.resolutionStatus === 'REJECTED') return CONFIDENCE_SCALE.min
  return clampConfidence(confidence * PROPOSED_CONFIDENCE_DEFAULTS.unresolvedIdentityPenalty)
}

/**
 * Source precedence: an artifact WITH lineage outranks a derived copy WITHOUT
 * lineage, regardless of which looks more current.
 *
 * Encoded as a comparator rather than stated as a comment, so the rule is
 * executable. Returns a negative number when `a` should win.
 */
export interface ProvenancedValue {
  readonly hasLineage: boolean
  readonly observedAt: string
  readonly confidence: number
}

export function compareProvenance(a: ProvenancedValue, b: ProvenancedValue): number {
  if (a.hasLineage !== b.hasLineage) return a.hasLineage ? -1 : 1
  if (a.confidence !== b.confidence) return b.confidence - a.confidence
  return Date.parse(b.observedAt) - Date.parse(a.observedAt)
}

/** Pick the authoritative value from a set, applying source precedence. */
export function selectAuthoritative<T extends ProvenancedValue>(values: readonly T[]): T | null {
  if (values.length === 0) return null
  return values.slice().sort(compareProvenance)[0] ?? null
}
