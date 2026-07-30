import { describe, it, expect } from 'vitest'
import { resolvePrimaryStatus, decidingReason, STATUS_PRECEDENCE } from '@/authority/precedence.js'
import type { FiredReason } from '@/authority/status.js'
import type { StatusImpact } from '@/authority/reason-codes.js'
import {
  isValidAt,
  isKnownAt,
  isEffective,
  hasInvertedPeriod,
  periodsOverlap,
  closePredecessor,
  temporalContext,
} from '@/graph/temporal.js'
import type { TemporalFields } from '@/graph/temporal.js'

function reason(code: string, statusImpact: StatusImpact): FiredReason {
  return {
    code,
    ruleId: 'TEST',
    category: 'AUTHORITY',
    statusImpact,
    clearingPredicateId: 'test.predicate',
    clearingPredicate: 'test',
    lapemoConditionKey: null,
    detail: 'test',
    subjects: [],
    evidenceRefs: [],
  }
}

describe('Status precedence', () => {
  it('returns AUTHORIZED for an empty reason set', () => {
    expect(resolvePrimaryStatus([])).toBe('AUTHORIZED')
  })

  it('returns AUTHORIZED when only warnings fired', () => {
    expect(resolvePrimaryStatus([reason('W', 'WARNING')])).toBe('AUTHORIZED')
  })

  it('returns CONDITIONALLY_AUTHORIZED for a conditional reason', () => {
    expect(resolvePrimaryStatus([reason('C', 'CONDITIONAL')])).toBe('CONDITIONALLY_AUTHORIZED')
  })

  it('returns NOT_AUTHORIZED for a blocking reason', () => {
    expect(resolvePrimaryStatus([reason('B', 'BLOCKING')])).toBe('NOT_AUTHORIZED')
  })

  it('returns INDETERMINATE for a data-integrity reason', () => {
    expect(resolvePrimaryStatus([reason('I', 'INDETERMINATE')])).toBe('INDETERMINATE')
  })

  it('lets INDETERMINATE outrank BLOCKING, so an unevaluable graph is never reported as a business refusal', () => {
    expect(resolvePrimaryStatus([reason('B', 'BLOCKING'), reason('I', 'INDETERMINATE')])).toBe('INDETERMINATE')
  })

  it('lets BLOCKING outrank CONDITIONAL', () => {
    expect(resolvePrimaryStatus([reason('C', 'CONDITIONAL'), reason('B', 'BLOCKING')])).toBe('NOT_AUTHORIZED')
  })

  it('is order independent', () => {
    const reasons = [reason('C', 'CONDITIONAL'), reason('B', 'BLOCKING'), reason('W', 'WARNING')]
    const forward = resolvePrimaryStatus(reasons)
    const backward = resolvePrimaryStatus([...reasons].reverse())
    expect(backward).toBe(forward)
  })

  it('is total over every permutation of impacts', () => {
    const impacts: StatusImpact[] = ['WARNING', 'CONDITIONAL', 'BLOCKING', 'INDETERMINATE']
    for (const a of impacts) {
      for (const b of impacts) {
        const status = resolvePrimaryStatus([reason('a', a), reason('b', b)])
        expect(['AUTHORIZED', 'CONDITIONALLY_AUTHORIZED', 'NOT_AUTHORIZED', 'INDETERMINATE']).toContain(status)
      }
    }
  })

  it('names the reason that decided the status', () => {
    const blocking = reason('B', 'BLOCKING')
    expect(decidingReason([reason('C', 'CONDITIONAL'), blocking])?.code).toBe('B')
  })

  it('names no deciding reason when the result is AUTHORIZED', () => {
    expect(decidingReason([reason('W', 'WARNING')])).toBeNull()
  })

  it('exposes the ladder as inspectable data', () => {
    expect(STATUS_PRECEDENCE.map((rung) => rung.impact)).toEqual(['INDETERMINATE', 'BLOCKING', 'CONDITIONAL'])
  })
})

function fields(overrides: Partial<TemporalFields> = {}): TemporalFields {
  return {
    status: 'ACTIVE',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    recordedFrom: '2026-01-01T00:00:00.000Z',
    recordedTo: null,
    supersedesVersionId: null,
    ...overrides,
  }
}

describe('Temporal contracts', () => {
  it('treats the effective start as inclusive', () => {
    expect(isValidAt(fields(), '2026-01-01T00:00:00.000Z')).toBe(true)
  })

  it('treats the effective end as exclusive', () => {
    const f = fields({ effectiveTo: '2026-06-01T00:00:00.000Z' })
    expect(isValidAt(f, '2026-05-31T23:59:59.000Z')).toBe(true)
    expect(isValidAt(f, '2026-06-01T00:00:00.000Z')).toBe(false)
  })

  it('excludes an instant before the effective start', () => {
    expect(isValidAt(fields(), '2025-12-31T00:00:00.000Z')).toBe(false)
  })

  it('treats a null knownAt as latest knowledge only', () => {
    expect(isKnownAt(fields(), null)).toBe(true)
    expect(isKnownAt(fields({ recordedTo: '2026-02-01T00:00:00.000Z' }), null)).toBe(false)
  })

  it('reconstructs a past state of knowledge when knownAt is supplied', () => {
    const closed = fields({ recordedTo: '2026-02-01T00:00:00.000Z' })
    expect(isKnownAt(closed, '2026-01-15T00:00:00.000Z')).toBe(true)
    expect(isKnownAt(closed, '2026-03-01T00:00:00.000Z')).toBe(false)
  })

  it('never treats a superseded record as effective', () => {
    const f = fields({ status: 'SUPERSEDED' })
    expect(isEffective(f, temporalContext('2026-03-01T00:00:00.000Z'))).toBe(false)
  })

  it('never treats a voided record as effective', () => {
    const f = fields({ status: 'VOIDED' })
    expect(isEffective(f, temporalContext('2026-03-01T00:00:00.000Z'))).toBe(false)
  })

  it('detects an inverted valid period', () => {
    expect(hasInvertedPeriod(fields({ effectiveTo: '2025-01-01T00:00:00.000Z' }))).toBe(true)
  })

  it('detects an inverted record period', () => {
    expect(hasInvertedPeriod(fields({ recordedTo: '2025-01-01T00:00:00.000Z' }))).toBe(true)
  })

  it('detects overlapping periods', () => {
    const a = fields({ effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveTo: '2026-06-01T00:00:00.000Z' })
    const b = fields({ effectiveFrom: '2026-03-01T00:00:00.000Z', effectiveTo: null })
    expect(periodsOverlap(a, b)).toBe(true)
  })

  it('treats adjacent periods as non-overlapping', () => {
    const a = fields({ effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveTo: '2026-06-01T00:00:00.000Z' })
    const b = fields({ effectiveFrom: '2026-06-01T00:00:00.000Z', effectiveTo: null })
    expect(periodsOverlap(a, b)).toBe(false)
  })

  it('closes a predecessor without rewriting what held in the organization', () => {
    const predecessor = fields()
    const closed = closePredecessor(predecessor, '2026-04-01T00:00:00.000Z')

    expect(closed.status).toBe('SUPERSEDED')
    expect(closed.recordedTo).toBe('2026-04-01T00:00:00.000Z')
    // Valid time is untouched: learning something new does not change what was true.
    expect(closed.effectiveFrom).toBe(predecessor.effectiveFrom)
    expect(closed.effectiveTo).toBe(predecessor.effectiveTo)
  })

  it('does not mutate the predecessor it closes', () => {
    const predecessor = fields()
    closePredecessor(predecessor, '2026-04-01T00:00:00.000Z')
    expect(predecessor.status).toBe('ACTIVE')
    expect(predecessor.recordedTo).toBeNull()
  })

  it('rejects an unparseable timestamp rather than silently treating it as zero', () => {
    expect(() => isValidAt(fields({ effectiveFrom: 'not-a-date' }), '2026-01-01T00:00:00.000Z')).toThrow()
  })
})
