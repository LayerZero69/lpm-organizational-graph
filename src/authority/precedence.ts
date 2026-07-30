/**
 * Deterministic status precedence.
 *
 * Maps any set of fired reasons onto exactly one primary status. The mapping is
 * total, order-independent, and pure, so the same reason set always produces the
 * same status regardless of the order rules ran in.
 *
 * Ratified ordering (docs/ADR/ADR-004-authority-evaluation.md):
 *
 *   1. Any INDETERMINATE reason wins. The graph could not evaluate, which is a
 *      different thing from a negative business result and must never be
 *      reported as one.
 *   2. Otherwise any BLOCKING reason produces NOT_AUTHORIZED.
 *   3. Otherwise any CONDITIONAL reason produces CONDITIONALLY_AUTHORIZED.
 *   4. Otherwise AUTHORIZED. WARNING reasons never move the status.
 */

import type { FiredReason, PrimaryStatus } from './status.js'

/** The precedence ladder, highest priority first. Exported so it is testable as data. */
export const STATUS_PRECEDENCE = [
  { impact: 'INDETERMINATE', status: 'INDETERMINATE' },
  { impact: 'BLOCKING', status: 'NOT_AUTHORIZED' },
  { impact: 'CONDITIONAL', status: 'CONDITIONALLY_AUTHORIZED' },
] as const

export function resolvePrimaryStatus(reasons: readonly FiredReason[]): PrimaryStatus {
  for (const rung of STATUS_PRECEDENCE) {
    if (reasons.some((reason) => reason.statusImpact === rung.impact)) {
      return rung.status
    }
  }
  return 'AUTHORIZED'
}

/**
 * Explain the status decision. Returns the reason that determined the status,
 * or null when nothing fired and the result is AUTHORIZED.
 */
export function decidingReason(reasons: readonly FiredReason[]): FiredReason | null {
  for (const rung of STATUS_PRECEDENCE) {
    const match = reasons.find((reason) => reason.statusImpact === rung.impact)
    if (match) return match
  }
  return null
}
