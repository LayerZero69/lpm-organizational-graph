/**
 * The evaluation status model.
 *
 * Outcome and cause are separate. A result carries exactly one primary status
 * and zero or more reason codes. A reason code is never a status, and a status
 * is never a reason. This is what lets AUTHORITY_EXPIRED be a cause of
 * NOT_AUTHORIZED rather than pretending to be both.
 */

import type { ReasonCategory, StatusImpact } from './reason-codes.js'

export const PRIMARY_STATUSES = [
  'AUTHORIZED',
  'CONDITIONALLY_AUTHORIZED',
  'NOT_AUTHORIZED',
  'INDETERMINATE',
] as const

export type PrimaryStatus = (typeof PRIMARY_STATUSES)[number]

/** A reason code as it actually fired, with the evidence of why. */
export interface FiredReason {
  readonly code: string
  readonly ruleId: string
  readonly category: ReasonCategory
  readonly statusImpact: StatusImpact
  readonly clearingPredicateId: string
  readonly clearingPredicate: string
  readonly lapemoConditionKey: string | null
  /** Plain-language statement of what was observed in this specific evaluation. */
  readonly detail: string
  /** Logical ids of the nodes and edges that caused this reason to fire. */
  readonly subjects: readonly string[]
  /** Evidence object logical ids relevant to clearing it. */
  readonly evidenceRefs: readonly string[]
}

/** An action that, if completed, would clear a conditional or blocking reason. */
export interface RequiredAction {
  readonly forCode: string
  readonly description: string
  readonly clearingPredicateId: string
}

export function isBlocking(reason: FiredReason): boolean {
  return reason.statusImpact === 'BLOCKING'
}

export function isConditional(reason: FiredReason): boolean {
  return reason.statusImpact === 'CONDITIONAL'
}

export function isIndeterminate(reason: FiredReason): boolean {
  return reason.statusImpact === 'INDETERMINATE'
}

export function isWarning(reason: FiredReason): boolean {
  return reason.statusImpact === 'WARNING'
}
