/**
 * Acceptance tests for the synthetic procurement scenario.
 *
 * Every expected status is exact. There are no OR assertions anywhere: a test
 * that would accept either of two statuses is a test that has not decided what
 * the system should do.
 */

import { describe, it, expect } from 'vitest'
import { InMemoryGraphRepository } from '@/adapters/memory/in-memory-repository.js'
import { AuthorityEvaluator } from '@/authority/evaluator.js'
import { temporalContext } from '@/graph/temporal.js'
import type { GraphDataset } from '@/adapters/memory/in-memory-repository.js'
import type { EvaluationResult } from '@/authority/types.js'
import {
  procurementScenario,
  withinFinancialLimit,
  fullyCompliant,
  expiredAuthority,
  withoutAccountableOwner,
  withoutSupervisor,
  withDeactivatedSupervisor,
  withExpandedPermission,
  withBrokenDelegation,
  withOverreachingDelegation,
  withUnearnedAutonomy,
  withEarnedAutonomy,
  withConflictingPolicies,
  withLimitRaisedLaterAtOriginalAmount,
  fixtureCeilingProvider,
  ORG,
  ID,
  T,
} from '@/fixtures/procurement-scenario.js'

async function evaluate(dataset: GraphDataset, at?: string): Promise<EvaluationResult> {
  const evaluator = new AuthorityEvaluator({
    repository: new InMemoryGraphRepository(dataset),
    ceilingProvider: fixtureCeilingProvider(),
  })
  return evaluator.evaluate({
    organizationId: ORG,
    decisionEventLogicalId: ID.decisionEvent,
    ...(at === undefined ? {} : { temporalContext: temporalContext(at) }),
  })
}

function codes(result: EvaluationResult): string[] {
  return result.violations.map((violation) => violation.code).sort()
}

describe('Acceptance 1: the seeded procurement scenario', () => {
  it('returns NOT_AUTHORIZED with exactly the four expected reason codes', async () => {
    const result = await evaluate(procurementScenario())

    expect(result.status).toBe('NOT_AUTHORIZED')
    expect(codes(result)).toEqual([
      'FINANCIAL_LIMIT_EXCEEDED',
      'MISSING_HUMAN_REVIEW',
      'MISSING_REQUIRED_INFORMATION',
      'PERMISSION_AUTHORITY_MISMATCH',
    ])
  })

  it('names the accountable human and the supervisor', async () => {
    const result = await evaluate(procurementScenario())
    expect(result.accountablePersonLogicalId).toBe(ID.procurementDirector)
    expect(result.supervisorPersonLogicalId).toBe(ID.procurementDirector)
  })

  it('returns the full authority lineage terminating at an organizational source', async () => {
    const result = await evaluate(procurementScenario())

    expect(result.delegationChain.map((link) => link.grantLogicalId)).toEqual([
      ID.grantAgent,
      ID.grantDirector,
      ID.grantRoot,
    ])
    expect(result.delegationChain.at(-1)?.organizationalSource).toBe('BOARD_RESOLUTION')
  })

  it('carries a clearing predicate on every reason code', async () => {
    const result = await evaluate(procurementScenario())
    for (const violation of result.violations) {
      expect(violation.clearingPredicateId.length).toBeGreaterThan(0)
      expect(violation.clearingPredicate.length).toBeGreaterThan(0)
    }
  })

  it('reports the financial limit as a machine-stable code, not free text', async () => {
    const result = await evaluate(procurementScenario())
    const financial = result.violations.find((v) => v.code === 'FINANCIAL_LIMIT_EXCEEDED')

    expect(financial).toBeDefined()
    expect(financial?.ruleId).toBe('AUTH-003')
    expect(financial?.statusImpact).toBe('BLOCKING')
    expect(financial?.clearingPredicateId).toBe('authority.financial_amount_within_grant_limit')
  })
})

describe('Acceptance 2: amount within the financial limit', () => {
  it('returns CONDITIONALLY_AUTHORIZED, the single ratified status', async () => {
    const result = await evaluate(withinFinancialLimit())

    expect(result.status).toBe('CONDITIONALLY_AUTHORIZED')
    expect(codes(result)).toEqual(['MISSING_HUMAN_REVIEW', 'MISSING_REQUIRED_INFORMATION'])
  })
})

describe('Acceptance 3: human review performed and vendor risk supplied', () => {
  it('returns AUTHORIZED with no violations', async () => {
    const result = await evaluate(fullyCompliant())

    expect(result.status).toBe('AUTHORIZED')
    expect(result.violations).toEqual([])
    expect(result.evidenceCompleteness.completenessRatio).toBe(1)
  })
})

describe('Acceptance 4: expired authority grant', () => {
  it('returns NOT_AUTHORIZED with AUTHORITY_EXPIRED', async () => {
    const result = await evaluate(expiredAuthority())

    expect(result.status).toBe('NOT_AUTHORIZED')
    expect(codes(result)).toContain('AUTHORITY_EXPIRED')
  })
})

describe('Acceptance 5: no accountable owner', () => {
  it('returns NOT_AUTHORIZED with UNOWNED_AGENT', async () => {
    const result = await evaluate(withoutAccountableOwner())

    expect(result.status).toBe('NOT_AUTHORIZED')
    expect(codes(result)).toContain('UNOWNED_AGENT')
  })
})

describe('Acceptance 6: no supervisor', () => {
  it('returns NOT_AUTHORIZED with UNSUPERVISED_AGENT', async () => {
    const result = await evaluate(withoutSupervisor())

    expect(result.status).toBe('NOT_AUTHORIZED')
    expect(codes(result)).toContain('UNSUPERVISED_AGENT')
  })
})

describe('Acceptance 7: technical permission expanded beyond authority', () => {
  it('returns PERMISSION_AUTHORITY_MISMATCH', async () => {
    const result = await evaluate(withExpandedPermission())

    expect(result.status).toBe('NOT_AUTHORIZED')
    expect(codes(result)).toContain('PERMISSION_AUTHORITY_MISMATCH')
  })

  it('names the uncovered action rather than reporting a bare mismatch', async () => {
    const result = await evaluate(withExpandedPermission())
    const mismatch = result.violations.find((v) => v.code === 'PERMISSION_AUTHORITY_MISMATCH')
    expect(mismatch?.detail).toContain('MODIFY_VENDOR_BANK_DETAILS')
  })
})

describe('Acceptance 8: grant from an unauthorized grantor', () => {
  it('returns INVALID_DELEGATION_CHAIN when the chain reaches no organizational source', async () => {
    const result = await evaluate(withBrokenDelegation())

    expect(result.status).toBe('NOT_AUTHORIZED')
    expect(codes(result)).toContain('INVALID_DELEGATION_CHAIN')
  })

  it('returns DELEGATION_EXCEEDS_GRANTOR_AUTHORITY when a grantor delegates more than they hold', async () => {
    const result = await evaluate(withOverreachingDelegation())

    expect(result.status).toBe('NOT_AUTHORIZED')
    expect(codes(result)).toContain('DELEGATION_EXCEEDS_GRANTOR_AUTHORITY')
  })
})

describe('Acceptance 9: autonomy raised without gate-clearance evidence', () => {
  it('returns UNEARNED_AUTONOMY_LEVEL', async () => {
    const result = await evaluate(withUnearnedAutonomy())

    expect(result.status).toBe('NOT_AUTHORIZED')
    expect(codes(result)).toContain('UNEARNED_AUTONOMY_LEVEL')
  })

  it('clears once resolvable gate-clearance evidence exists', async () => {
    const result = await evaluate(withEarnedAutonomy())

    expect(codes(result)).not.toContain('UNEARNED_AUTONOMY_LEVEL')
    expect(result.status).toBe('AUTHORIZED')
  })
})

describe('Acceptance 10: historical point-in-time reconstruction', () => {
  it('reconstructs the authority limit that held at the decision, not the current one', async () => {
    const dataset = withLimitRaisedLaterAtOriginalAmount()

    // At the decision instant the limit was twenty five thousand, so a forty two
    // thousand commitment exceeded it.
    const atDecision = await evaluate(dataset, T.decisionMade)
    expect(codes(atDecision)).toContain('FINANCIAL_LIMIT_EXCEEDED')

    // Evaluated later, the raised fifty thousand limit is in force. Same decision
    // event, same amount, different organizational reality.
    const later = await evaluate(dataset, T.laterEvaluation)
    expect(codes(later)).not.toContain('FINANCIAL_LIMIT_EXCEEDED')
  })

  it('reports the temporal context it evaluated under', async () => {
    const result = await evaluate(procurementScenario(), T.decisionMade)
    expect(result.temporalContext.validAt).toBe(T.decisionMade)
  })
})

describe('Acceptance 11: a deactivated supervisor does not satisfy supervision', () => {
  it('returns UNSUPERVISED_AGENT even though the relationship still exists', async () => {
    const result = await evaluate(withDeactivatedSupervisor())

    expect(result.status).toBe('NOT_AUTHORIZED')
    expect(codes(result)).toContain('UNSUPERVISED_AGENT')
    // The same person is also the accountable owner, so accountability fails too.
    expect(codes(result)).toContain('UNOWNED_AGENT')
  })
})

describe('Acceptance 12: unresolved policy conflict', () => {
  it('returns UNRESOLVED_POLICY_CONFLICT when two policies contradict without precedence', async () => {
    const result = await evaluate(withConflictingPolicies())

    expect(result.status).toBe('NOT_AUTHORIZED')
    expect(codes(result)).toContain('UNRESOLVED_POLICY_CONFLICT')
  })
})

describe('Determinism', () => {
  it('produces an identical result across repeated evaluations', async () => {
    const dataset = procurementScenario()
    const first = await evaluate(dataset)
    const second = await evaluate(dataset)

    expect(JSON.stringify(second)).toEqual(JSON.stringify(first))
  })

  it('produces an identical result regardless of node and edge ordering', async () => {
    const dataset = procurementScenario()
    const reversed: GraphDataset = {
      nodes: [...dataset.nodes].reverse(),
      edges: [...dataset.edges].reverse(),
    }

    const original = await evaluate(dataset)
    const shuffled = await evaluate(reversed)

    expect(shuffled.status).toBe(original.status)
    expect(codes(shuffled)).toEqual(codes(original))
  })
})
