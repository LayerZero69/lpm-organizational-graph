/**
 * Unit tests for the authority rules.
 *
 * Each rule is exercised in isolation against a hand-built resolved context, with
 * no repository and no fixtures, which is the point of keeping the rules pure.
 */

import { describe, it, expect } from 'vitest'
import {
  auth001AccountableOwner,
  auth002Supervisor,
  auth003MatchingAuthority,
  auth004EffectiveAuthority,
  auth005PermissionAlignment,
  auth006AutonomyCeiling,
  auth007EarnedAutonomy,
  auth008HumanReview,
  auth009Information,
  auth010PolicyConflict,
  auth011OutcomeAccountability,
  auth012DelegationChain,
  dataIntegrityRule,
  agentReviewWarning,
  permissionFreshnessWarning,
} from '@/authority/rules.js'
import type { ResolvedContext } from '@/authority/types.js'
import type {
  PersonNode,
  AgentNode,
  DecisionEventNode,
  DecisionTypeNode,
  AuthorityGrantNode,
  AutonomyStateNode,
  SystemPermissionNode,
  PolicyNode,
} from '@/domain/nodes/index.js'
import type { AutonomyLevelKey } from '@/domain/enums/index.js'

const NOW = '2026-03-15T00:00:00.000Z'
const ORG = 'org-test'

function temporalBase(effectiveFrom = '2026-01-01T00:00:00.000Z') {
  return {
    status: 'ACTIVE' as const,
    effectiveFrom,
    effectiveTo: null,
    recordedFrom: effectiveFrom,
    recordedTo: null,
    supersedesVersionId: null,
  }
}

function identityBase(logicalId: string) {
  return {
    logicalId,
    versionId: `${logicalId}#v1`,
    versionNumber: 1,
    versionIdOrigin: 'GRAPH_NATIVE' as const,
    sourceRef: null,
    organizationId: ORG,
    confidence: 1,
    evidenceRefs: [] as string[],
  }
}

function person(logicalId: string, isActive = true): PersonNode {
  return {
    ...identityBase(logicalId),
    ...temporalBase(),
    nodeType: 'Person',
    displayName: logicalId,
    title: null,
    isActive,
  }
}

function agent(logicalId = 'agent-1', reviewDueAt: string | null = null): AgentNode {
  return {
    ...identityBase(logicalId),
    ...temporalBase(),
    nodeType: 'Agent',
    name: 'Test Governed Agent',
    businessPurpose: 'testing',
    agentKind: 'TEST',
    riskLevel: 'MODERATE',
    lifecycleState: 'ACTIVE',
    modelProvider: null,
    modelIdentifier: null,
    modelVersion: null,
    activatedAt: null,
    lastReviewedAt: null,
    reviewDueAt,
    retiredAt: null,
  }
}

function decisionType(overrides: Partial<DecisionTypeNode> = {}): DecisionTypeNode {
  return {
    ...identityBase('dt-1'),
    ...temporalBase(),
    nodeType: 'DecisionType',
    name: 'Test Decision',
    domain: 'Test',
    allowedActorClasses: ['Agent'],
    actionVocabulary: ['DO_THING'],
    riskLevel: 'MODERATE',
    humanReviewConditions: [],
    requiredInformationClasses: [],
    permittedSystemLogicalIds: [],
    escalationPersonLogicalId: null,
    governingPolicyLogicalIds: [],
    governingControlLogicalIds: [],
    ...overrides,
  }
}

function decisionEvent(overrides: Partial<DecisionEventNode> = {}): DecisionEventNode {
  return {
    ...identityBase('de-1'),
    ...temporalBase(),
    nodeType: 'DecisionEvent',
    decisionTypeLogicalId: 'dt-1',
    initiatingActor: { actorType: 'Agent', logicalId: 'agent-1' },
    finalActor: { actorType: 'Agent', logicalId: 'agent-1' },
    accountablePersonLogicalId: 'person-owner',
    businessContext: 'test',
    requestedAction: 'DO_THING',
    financialAmount: null,
    riskLevel: 'MODERATE',
    dataClassification: 'INTERNAL',
    geography: null,
    targetSystemLogicalIds: [],
    context: {},
    humanReview: { performed: false, reviewerPersonLogicalId: null, reviewedAt: null },
    decidedAt: NOW,
    executedAt: null,
    expectedOutcome: null,
    actualOutcomeLogicalId: null,
    correlationId: 'corr-1',
    source: 'test',
    ...overrides,
  }
}

function grant(overrides: Partial<AuthorityGrantNode> = {}): AuthorityGrantNode {
  return {
    ...identityBase('grant-1'),
    ...temporalBase(),
    nodeType: 'AuthorityGrant',
    grantType: 'ORGANIZATIONAL_SOURCE',
    grantor: { actorType: 'Person', logicalId: 'person-grantor' },
    grantee: { actorType: 'Agent', logicalId: 'agent-1' },
    decisionTypeLogicalId: 'dt-1',
    allowedActions: ['DO_THING'],
    prohibitedActions: [],
    financialLimit: null,
    riskLimit: null,
    dataClassificationLimit: null,
    systemScope: null,
    geographicScope: null,
    conditions: [],
    humanReviewRequired: false,
    revocation: null,
    governingPolicyLogicalId: null,
    derivedFromGrantLogicalId: null,
    organizationalSource: 'BOARD_RESOLUTION',
    ...overrides,
  }
}

function autonomyState(level: AutonomyLevelKey, evidenceRef: string | null = null): AutonomyStateNode {
  return {
    ...identityBase('as-1'),
    ...temporalBase(),
    nodeType: 'AutonomyState',
    agentLogicalId: 'agent-1',
    decisionTypeLogicalId: 'dt-1',
    level,
    gateClearanceEvidenceRef: evidenceRef,
    grantingBusinessOwnerPersonId: 'person-owner',
  }
}

function permission(overrides: Partial<SystemPermissionNode> = {}): SystemPermissionNode {
  return {
    ...identityBase('perm-1'),
    ...temporalBase(),
    nodeType: 'SystemPermission',
    principal: { actorType: 'Agent', logicalId: 'agent-1' },
    enterpriseSystemLogicalId: 'sys-1',
    permissionIdentifier: 'sys.do_thing',
    permittedActions: ['DO_THING'],
    resourceScope: [],
    functionScope: [],
    dataScope: [],
    financialLimit: null,
    volumeLimit: null,
    transactionLimit: null,
    technicalGrantor: null,
    sourceConnector: null,
    revoked: false,
    lastSynchronizedAt: null,
    stalenessState: 'FRESH',
    ...overrides,
  }
}

function policy(logicalId: string, humanReviewRequired: boolean | null, precedenceRank: number | null): PolicyNode {
  return {
    ...identityBase(logicalId),
    ...temporalBase(),
    nodeType: 'Policy',
    name: logicalId,
    appliesToDecisionTypeLogicalIds: ['dt-1'],
    requirements: { humanReviewRequired, maxFinancialAmount: null, prohibitedActions: [] },
    precedenceRank,
  }
}

function context(overrides: Partial<ResolvedContext> = {}): ResolvedContext {
  return {
    organizationId: ORG,
    temporal: { validAt: NOW, knownAt: null },
    evaluationInstant: NOW,
    decisionEvent: decisionEvent(),
    decisionType: decisionType(),
    agent: agent(),
    decidingPerson: null,
    accountableOwners: [person('person-owner')],
    supervisors: [person('person-supervisor')],
    accountablePersonForOutcome: person('person-owner'),
    candidateGrants: [],
    matchingGrant: grant(),
    delegationChain: [{ grant: grant(), depth: 0 }],
    delegationTerminates: true,
    delegationCycleDetected: false,
    autonomyState: autonomyState('AGENT_ASSISTED'),
    autonomyCeiling: { kind: 'LEVEL', level: 'AGENT_SUPERVISED' },
    gateClearanceEvidencePresent: false,
    systemPermissions: [],
    invokedSystems: [],
    invokedSystemLogicalIds: [],
    informationAssetsUsed: [],
    evidenceCompleteness: {
      requiredClassCount: 0,
      satisfiedClassCount: 0,
      gaps: [],
      completenessRatio: 1,
      satisfyingAssetLogicalIds: [],
    },
    applicablePolicies: [],
    applicableControls: [],
    applicableExceptions: [],
    reviewer: null,
    outcome: null,
    confidenceInputs: [],
    traversedEdges: [],
    ...overrides,
  }
}

const codesOf = (reasons: ReturnType<typeof auth001AccountableOwner>) => reasons.map((r) => r.code)

describe('AUTH-001 accountable owner', () => {
  it('passes with exactly one active accountable owner', () => {
    expect(auth001AccountableOwner(context())).toEqual([])
  })

  it('fires UNOWNED_AGENT with no owner', () => {
    expect(codesOf(auth001AccountableOwner(context({ accountableOwners: [] })))).toEqual(['UNOWNED_AGENT'])
  })

  it('fires UNOWNED_AGENT when the only owner is deactivated', () => {
    const ctx = context({ accountableOwners: [person('person-owner', false)] })
    expect(codesOf(auth001AccountableOwner(ctx))).toEqual(['UNOWNED_AGENT'])
  })

  it('fires AMBIGUOUS_AGENT_OWNERSHIP with two active owners', () => {
    const ctx = context({ accountableOwners: [person('a'), person('b')] })
    expect(codesOf(auth001AccountableOwner(ctx))).toEqual(['AMBIGUOUS_AGENT_OWNERSHIP'])
  })
})

describe('AUTH-002 supervisor', () => {
  it('passes with exactly one active supervisor', () => {
    expect(auth002Supervisor(context())).toEqual([])
  })

  it('fires with no supervisor', () => {
    expect(codesOf(auth002Supervisor(context({ supervisors: [] })))).toEqual(['UNSUPERVISED_AGENT'])
  })

  it('fires when the supervisor is deactivated', () => {
    const ctx = context({ supervisors: [person('s', false)] })
    expect(codesOf(auth002Supervisor(ctx))).toEqual(['UNSUPERVISED_AGENT'])
  })

  it('fires with more than one active supervisor', () => {
    const ctx = context({ supervisors: [person('s1'), person('s2')] })
    expect(codesOf(auth002Supervisor(ctx))).toEqual(['UNSUPERVISED_AGENT'])
  })
})

describe('AUTH-003 matching authority', () => {
  it('passes when the grant covers the action and imposes no limits', () => {
    expect(auth003MatchingAuthority(context())).toEqual([])
  })

  it('fires NO_MATCHING_AUTHORITY with no grant', () => {
    expect(codesOf(auth003MatchingAuthority(context({ matchingGrant: null })))).toEqual(['NO_MATCHING_AUTHORITY'])
  })

  it('fires ACTION_OUTSIDE_AUTHORITY for an action not allowed', () => {
    const ctx = context({ decisionEvent: decisionEvent({ requestedAction: 'OTHER_THING' }) })
    expect(codesOf(auth003MatchingAuthority(ctx))).toContain('ACTION_OUTSIDE_AUTHORITY')
  })

  it('fires ACTION_OUTSIDE_AUTHORITY for an explicitly prohibited action', () => {
    const ctx = context({ matchingGrant: grant({ prohibitedActions: ['DO_THING'] }) })
    expect(codesOf(auth003MatchingAuthority(ctx))).toContain('ACTION_OUTSIDE_AUTHORITY')
  })

  it('fires FINANCIAL_LIMIT_EXCEEDED above the limit', () => {
    const ctx = context({
      decisionEvent: decisionEvent({ financialAmount: { amount: 100, currency: 'USD' } }),
      matchingGrant: grant({ financialLimit: { amount: 50, currency: 'USD' } }),
    })
    expect(codesOf(auth003MatchingAuthority(ctx))).toContain('FINANCIAL_LIMIT_EXCEEDED')
  })

  it('passes exactly at the limit boundary', () => {
    const ctx = context({
      decisionEvent: decisionEvent({ financialAmount: { amount: 50, currency: 'USD' } }),
      matchingGrant: grant({ financialLimit: { amount: 50, currency: 'USD' } }),
    })
    expect(auth003MatchingAuthority(ctx)).toEqual([])
  })

  it('fires FINANCIAL_LIMIT_EXCEEDED on a currency mismatch rather than converting', () => {
    const ctx = context({
      decisionEvent: decisionEvent({ financialAmount: { amount: 1, currency: 'EUR' } }),
      matchingGrant: grant({ financialLimit: { amount: 1_000_000, currency: 'USD' } }),
    })
    const fired = auth003MatchingAuthority(ctx)
    expect(codesOf(fired)).toContain('FINANCIAL_LIMIT_EXCEEDED')
    expect(fired[0]?.detail).toContain('currency mismatch')
  })

  it('passes when the grant imposes no financial limit', () => {
    const ctx = context({
      decisionEvent: decisionEvent({ financialAmount: { amount: 999_999, currency: 'USD' } }),
      matchingGrant: grant({ financialLimit: null }),
    })
    expect(auth003MatchingAuthority(ctx)).toEqual([])
  })

  it('fires RISK_LIMIT_EXCEEDED above the risk limit', () => {
    const ctx = context({
      decisionEvent: decisionEvent({ riskLevel: 'CRITICAL' }),
      matchingGrant: grant({ riskLimit: 'MODERATE' }),
    })
    expect(codesOf(auth003MatchingAuthority(ctx))).toContain('RISK_LIMIT_EXCEEDED')
  })

  it('fires DATA_CLASSIFICATION_LIMIT_EXCEEDED above the classification limit', () => {
    const ctx = context({
      decisionEvent: decisionEvent({ dataClassification: 'RESTRICTED' }),
      matchingGrant: grant({ dataClassificationLimit: 'INTERNAL' }),
    })
    expect(codesOf(auth003MatchingAuthority(ctx))).toContain('DATA_CLASSIFICATION_LIMIT_EXCEEDED')
  })

  it('fires SYSTEM_SCOPE_EXCEEDED for a system outside scope', () => {
    const ctx = context({
      invokedSystemLogicalIds: ['sys-outside'],
      matchingGrant: grant({ systemScope: ['sys-inside'] }),
    })
    expect(codesOf(auth003MatchingAuthority(ctx))).toContain('SYSTEM_SCOPE_EXCEEDED')
  })

  it('fires GEOGRAPHIC_SCOPE_EXCEEDED outside the permitted geography', () => {
    const ctx = context({
      decisionEvent: decisionEvent({ geography: 'APAC' }),
      matchingGrant: grant({ geographicScope: ['EMEA'] }),
    })
    expect(codesOf(auth003MatchingAuthority(ctx))).toContain('GEOGRAPHIC_SCOPE_EXCEEDED')
  })
})

describe('AUTH-004 effective authority', () => {
  it('stays silent when a matching grant was found', () => {
    expect(auth004EffectiveAuthority(context({ candidateGrants: [grant()] }))).toEqual([])
  })

  it('fires AUTHORITY_EXPIRED when the only candidate ended before the decision', () => {
    const expired = { ...grant(), effectiveTo: '2026-01-15T00:00:00.000Z' }
    const ctx = context({ matchingGrant: null, candidateGrants: [expired] })
    expect(codesOf(auth004EffectiveAuthority(ctx))).toEqual(['AUTHORITY_EXPIRED'])
  })

  it('fires AUTHORITY_NOT_YET_EFFECTIVE for a future grant', () => {
    const future = { ...grant(), effectiveFrom: '2027-01-01T00:00:00.000Z' }
    const ctx = context({ matchingGrant: null, candidateGrants: [future] })
    expect(codesOf(auth004EffectiveAuthority(ctx))).toEqual(['AUTHORITY_NOT_YET_EFFECTIVE'])
  })

  it('fires AUTHORITY_REVOKED for a revoked grant', () => {
    const revoked = grant({
      revocation: { revokedAt: '2026-02-01T00:00:00.000Z', reason: 'withdrawn', revokedByPersonLogicalId: 'p' },
    })
    const ctx = context({ matchingGrant: null, candidateGrants: [revoked] })
    expect(codesOf(auth004EffectiveAuthority(ctx))).toEqual(['AUTHORITY_REVOKED'])
  })
})

describe('AUTH-005 permission and authority alignment', () => {
  it('stays silent when no permission touches an invoked system', () => {
    const ctx = context({ systemPermissions: [permission()], invokedSystemLogicalIds: [] })
    expect(auth005PermissionAlignment(ctx)).toEqual([])
  })

  it('passes when the permission stays inside authority', () => {
    const ctx = context({
      systemPermissions: [permission({ financialLimit: { amount: 10, currency: 'USD' } })],
      invokedSystemLogicalIds: ['sys-1'],
      matchingGrant: grant({ financialLimit: { amount: 100, currency: 'USD' } }),
    })
    expect(auth005PermissionAlignment(ctx)).toEqual([])
  })

  it('fires when the permission allows an action authority does not', () => {
    const ctx = context({
      systemPermissions: [permission({ permittedActions: ['DO_THING', 'DELETE_EVERYTHING'] })],
      invokedSystemLogicalIds: ['sys-1'],
    })
    expect(codesOf(auth005PermissionAlignment(ctx))).toEqual(['PERMISSION_AUTHORITY_MISMATCH'])
  })

  it('fires when the permission financial ceiling exceeds authority', () => {
    const ctx = context({
      systemPermissions: [permission({ financialLimit: { amount: 100_000, currency: 'USD' } })],
      invokedSystemLogicalIds: ['sys-1'],
      matchingGrant: grant({ financialLimit: { amount: 25_000, currency: 'USD' } }),
    })
    expect(codesOf(auth005PermissionAlignment(ctx))).toEqual(['PERMISSION_AUTHORITY_MISMATCH'])
  })

  it('fires when a permission exists with no authority at all', () => {
    const ctx = context({
      systemPermissions: [permission()],
      invokedSystemLogicalIds: ['sys-1'],
      matchingGrant: null,
    })
    expect(codesOf(auth005PermissionAlignment(ctx))).toEqual(['PERMISSION_AUTHORITY_MISMATCH'])
  })

  it('ignores a revoked permission', () => {
    const ctx = context({
      systemPermissions: [permission({ revoked: true, permittedActions: ['DELETE_EVERYTHING'] })],
      invokedSystemLogicalIds: ['sys-1'],
    })
    expect(auth005PermissionAlignment(ctx)).toEqual([])
  })

  it('warns, without blocking, when a permission is stale', () => {
    const ctx = context({
      systemPermissions: [permission({ stalenessState: 'STALE' })],
      invokedSystemLogicalIds: ['sys-1'],
    })
    const fired = permissionFreshnessWarning(ctx)
    expect(codesOf(fired)).toEqual(['STALE_SYSTEM_PERMISSION'])
    expect(fired[0]?.statusImpact).toBe('WARNING')
  })
})

describe('AUTH-006 autonomy ceiling', () => {
  it('passes below the ceiling', () => {
    expect(auth006AutonomyCeiling(context())).toEqual([])
  })

  it('passes exactly at the ceiling', () => {
    const ctx = context({ autonomyState: autonomyState('AGENT_SUPERVISED', 'ev-1') })
    expect(auth006AutonomyCeiling(ctx)).toEqual([])
  })

  it('fires above the ceiling', () => {
    const ctx = context({ autonomyState: autonomyState('AGENT_AUTONOMOUS', 'ev-1') })
    expect(codesOf(auth006AutonomyCeiling(ctx))).toEqual(['AUTONOMY_EXCEEDS_DECISION_LIMIT'])
  })

  it('fires AUTONOMY_CEILING_BLOCKED when a prerequisite is unsatisfied', () => {
    const ctx = context({
      autonomyCeiling: { kind: 'BLOCKED', blockingPrerequisite: 'the decision domain has no active owner' },
    })
    expect(codesOf(auth006AutonomyCeiling(ctx))).toEqual(['AUTONOMY_CEILING_BLOCKED'])
  })
})

describe('AUTH-007 earned autonomy', () => {
  it('passes at the canonical baseline with no evidence', () => {
    expect(auth007EarnedAutonomy(context())).toEqual([])
  })

  it('passes below the baseline with no evidence', () => {
    const ctx = context({ autonomyState: autonomyState('HUMAN_APPROVED') })
    expect(auth007EarnedAutonomy(ctx)).toEqual([])
  })

  it('fires above the baseline with no evidence reference', () => {
    const ctx = context({ autonomyState: autonomyState('AGENT_SUPERVISED', null) })
    expect(codesOf(auth007EarnedAutonomy(ctx))).toEqual(['UNEARNED_AUTONOMY_LEVEL'])
  })

  it('fires above the baseline when the evidence does not resolve', () => {
    const ctx = context({
      autonomyState: autonomyState('AGENT_SUPERVISED', 'ev-missing'),
      gateClearanceEvidencePresent: false,
    })
    expect(codesOf(auth007EarnedAutonomy(ctx))).toEqual(['UNEARNED_AUTONOMY_LEVEL'])
  })

  it('passes above the baseline with resolvable evidence', () => {
    const ctx = context({
      autonomyState: autonomyState('AGENT_AUTONOMOUS', 'ev-1'),
      gateClearanceEvidencePresent: true,
    })
    expect(auth007EarnedAutonomy(ctx)).toEqual([])
  })
})

describe('AUTH-008 human review', () => {
  const requiringType = decisionType({
    humanReviewConditions: [
      { conditionId: 'c1', description: 'requires review', contextKey: 'flag', equals: true },
    ],
  })

  it('stays silent when nothing requires review', () => {
    expect(auth008HumanReview(context())).toEqual([])
  })

  it('fires when a decision-type condition matches and review was not performed', () => {
    const ctx = context({
      decisionType: requiringType,
      decisionEvent: decisionEvent({ context: { flag: true } }),
    })
    expect(codesOf(auth008HumanReview(ctx))).toEqual(['MISSING_HUMAN_REVIEW'])
  })

  it('stays silent when the condition does not match', () => {
    const ctx = context({
      decisionType: requiringType,
      decisionEvent: decisionEvent({ context: { flag: false } }),
    })
    expect(auth008HumanReview(ctx)).toEqual([])
  })

  it('fires when the grant requires review regardless of context', () => {
    const ctx = context({ matchingGrant: grant({ humanReviewRequired: true }) })
    expect(codesOf(auth008HumanReview(ctx))).toEqual(['MISSING_HUMAN_REVIEW'])
  })

  it('passes when review was performed by an independent active person', () => {
    const ctx = context({
      matchingGrant: grant({ humanReviewRequired: true }),
      decisionEvent: decisionEvent({
        humanReview: { performed: true, reviewerPersonLogicalId: 'person-reviewer', reviewedAt: NOW },
      }),
      reviewer: person('person-reviewer'),
    })
    expect(auth008HumanReview(ctx)).toEqual([])
  })

  it('fires REVIEWER_NOT_INDEPENDENT when the reviewer is the deciding actor', () => {
    const ctx = context({
      matchingGrant: grant({ humanReviewRequired: true }),
      decisionEvent: decisionEvent({
        finalActor: { actorType: 'Person', logicalId: 'person-self' },
        humanReview: { performed: true, reviewerPersonLogicalId: 'person-self', reviewedAt: NOW },
      }),
      reviewer: person('person-self'),
    })
    expect(codesOf(auth008HumanReview(ctx))).toEqual(['REVIEWER_NOT_INDEPENDENT'])
  })

  it('fires REVIEWER_NOT_INDEPENDENT when the reviewer is deactivated', () => {
    const ctx = context({
      matchingGrant: grant({ humanReviewRequired: true }),
      decisionEvent: decisionEvent({
        humanReview: { performed: true, reviewerPersonLogicalId: 'person-gone', reviewedAt: NOW },
      }),
      reviewer: person('person-gone', false),
    })
    expect(codesOf(auth008HumanReview(ctx))).toEqual(['REVIEWER_NOT_INDEPENDENT'])
  })
})

describe('AUTH-009 information', () => {
  it('stays silent with no gaps', () => {
    expect(auth009Information(context())).toEqual([])
  })

  it('maps each gap kind to its own reason code', () => {
    const ctx = context({
      evidenceCompleteness: {
        requiredClassCount: 4,
        satisfiedClassCount: 0,
        completenessRatio: 0,
        satisfyingAssetLogicalIds: [],
        gaps: [
          { classId: 'a', kind: 'ABSENT', detail: 'absent', assetLogicalId: null },
          { classId: 'b', kind: 'NOT_AUTHORITATIVE', detail: 'not authoritative', assetLogicalId: 'x' },
          { classId: 'c', kind: 'STALE', detail: 'stale', assetLogicalId: 'y' },
          { classId: 'd', kind: 'CLASSIFICATION_NOT_PERMITTED', detail: 'not permitted', assetLogicalId: 'z' },
        ],
      },
    })
    expect(codesOf(auth009Information(ctx)).sort()).toEqual([
      'MISSING_REQUIRED_INFORMATION',
      'NON_AUTHORITATIVE_SOURCE',
      'STALE_INFORMATION',
      'UNAUTHORIZED_DATA_USE',
    ])
  })

  it('does not repeat the same code for the same class twice', () => {
    const ctx = context({
      evidenceCompleteness: {
        requiredClassCount: 1,
        satisfiedClassCount: 0,
        completenessRatio: 0,
        satisfyingAssetLogicalIds: [],
        gaps: [
          { classId: 'a', kind: 'STALE', detail: 'stale one', assetLogicalId: 'x' },
          { classId: 'a', kind: 'STALE', detail: 'stale two', assetLogicalId: 'y' },
        ],
      },
    })
    expect(codesOf(auth009Information(ctx))).toEqual(['STALE_INFORMATION'])
  })
})

describe('AUTH-010 policy conflict', () => {
  it('stays silent with a single policy', () => {
    expect(auth010PolicyConflict(context({ applicablePolicies: [policy('p1', true, null)] }))).toEqual([])
  })

  it('stays silent when policies agree', () => {
    const ctx = context({ applicablePolicies: [policy('p1', true, null), policy('p2', true, null)] })
    expect(auth010PolicyConflict(ctx)).toEqual([])
  })

  it('fires when policies contradict with no precedence', () => {
    const ctx = context({ applicablePolicies: [policy('p1', true, null), policy('p2', false, null)] })
    expect(codesOf(auth010PolicyConflict(ctx))).toEqual(['UNRESOLVED_POLICY_CONFLICT'])
  })

  it('stays silent when a strictly higher precedence resolves the contradiction', () => {
    const ctx = context({ applicablePolicies: [policy('p1', true, 10), policy('p2', false, 5)] })
    expect(auth010PolicyConflict(ctx)).toEqual([])
  })

  it('fires when contradicting policies share the same precedence', () => {
    const ctx = context({ applicablePolicies: [policy('p1', true, 5), policy('p2', false, 5)] })
    expect(codesOf(auth010PolicyConflict(ctx))).toEqual(['UNRESOLVED_POLICY_CONFLICT'])
  })

  it('treats a null requirement as silent rather than contradicting', () => {
    const ctx = context({ applicablePolicies: [policy('p1', true, null), policy('p2', null, null)] })
    expect(auth010PolicyConflict(ctx)).toEqual([])
  })
})

describe('AUTH-011 outcome accountability', () => {
  it('passes with a named active accountable person', () => {
    expect(auth011OutcomeAccountability(context())).toEqual([])
  })

  it('fires when no accountable human is named', () => {
    const ctx = context({ decisionEvent: decisionEvent({ accountablePersonLogicalId: null }) })
    expect(codesOf(auth011OutcomeAccountability(ctx))).toEqual(['NO_HUMAN_OUTCOME_ACCOUNTABILITY'])
  })

  it('fires when the named accountable human is deactivated', () => {
    const ctx = context({ accountablePersonForOutcome: person('person-owner', false) })
    expect(codesOf(auth011OutcomeAccountability(ctx))).toEqual(['NO_HUMAN_OUTCOME_ACCOUNTABILITY'])
  })
})

describe('AUTH-012 delegation chain', () => {
  it('passes for a chain terminating at an organizational source', () => {
    expect(auth012DelegationChain(context())).toEqual([])
  })

  it('fires INVALID_DELEGATION_CHAIN when the chain does not terminate', () => {
    const ctx = context({ delegationTerminates: false })
    expect(codesOf(auth012DelegationChain(ctx))).toEqual(['INVALID_DELEGATION_CHAIN'])
  })

  it('fires INVALID_DELEGATION_CHAIN on a cycle', () => {
    const ctx = context({ delegationCycleDetected: true, delegationTerminates: false })
    const fired = auth012DelegationChain(ctx)
    expect(codesOf(fired)).toEqual(['INVALID_DELEGATION_CHAIN'])
    expect(fired[0]?.detail).toContain('revisits')
  })

  it('fires when a child delegates a higher financial limit than the parent holds', () => {
    const child = grant({ logicalId: 'child', financialLimit: { amount: 500, currency: 'USD' }, derivedFromGrantLogicalId: 'parent', organizationalSource: null })
    const parent = grant({ logicalId: 'parent', financialLimit: { amount: 100, currency: 'USD' } })
    const ctx = context({
      matchingGrant: child,
      delegationChain: [{ grant: child, depth: 0 }, { grant: parent, depth: 1 }],
    })
    expect(codesOf(auth012DelegationChain(ctx))).toEqual(['DELEGATION_EXCEEDS_GRANTOR_AUTHORITY'])
  })

  it('fires when a child delegates an unlimited boundary from a bounded parent', () => {
    const child = grant({ logicalId: 'child', financialLimit: null, derivedFromGrantLogicalId: 'parent', organizationalSource: null })
    const parent = grant({ logicalId: 'parent', financialLimit: { amount: 100, currency: 'USD' } })
    const ctx = context({
      matchingGrant: child,
      delegationChain: [{ grant: child, depth: 0 }, { grant: parent, depth: 1 }],
    })
    expect(codesOf(auth012DelegationChain(ctx))).toEqual(['DELEGATION_EXCEEDS_GRANTOR_AUTHORITY'])
  })

  it('fires when a child delegates an action the parent does not hold', () => {
    const child = grant({ logicalId: 'child', allowedActions: ['DO_THING', 'EXTRA'], derivedFromGrantLogicalId: 'parent', organizationalSource: null })
    const parent = grant({ logicalId: 'parent', allowedActions: ['DO_THING'] })
    const ctx = context({
      matchingGrant: child,
      delegationChain: [{ grant: child, depth: 0 }, { grant: parent, depth: 1 }],
    })
    expect(codesOf(auth012DelegationChain(ctx))).toContain('DELEGATION_EXCEEDS_GRANTOR_AUTHORITY')
  })

  it('fires when a child delegates a higher risk limit than the parent holds', () => {
    const child = grant({ logicalId: 'child', riskLimit: 'CRITICAL', derivedFromGrantLogicalId: 'parent', organizationalSource: null })
    const parent = grant({ logicalId: 'parent', riskLimit: 'LOW' })
    const ctx = context({
      matchingGrant: child,
      delegationChain: [{ grant: child, depth: 0 }, { grant: parent, depth: 1 }],
    })
    expect(codesOf(auth012DelegationChain(ctx))).toContain('DELEGATION_EXCEEDS_GRANTOR_AUTHORITY')
  })
})

describe('Data integrity', () => {
  it('fires DECISION_EVENT_NOT_FOUND and stops there', () => {
    const fired = dataIntegrityRule(context({ decisionEvent: null }))
    expect(codesOf(fired)).toEqual(['DECISION_EVENT_NOT_FOUND'])
  })

  it('fires DECISION_TYPE_NOT_RESOLVABLE', () => {
    expect(codesOf(dataIntegrityRule(context({ decisionType: null })))).toContain('DECISION_TYPE_NOT_RESOLVABLE')
  })

  it('fires DECIDING_ACTOR_NOT_RESOLVABLE', () => {
    const ctx = context({ agent: null, decidingPerson: null })
    expect(codesOf(dataIntegrityRule(ctx))).toContain('DECIDING_ACTOR_NOT_RESOLVABLE')
  })

  it('fires ORGANIZATION_SCOPE_MISSING when the event is outside the requested scope', () => {
    const ctx = context({ organizationId: 'org-other' })
    expect(codesOf(dataIntegrityRule(ctx))).toContain('ORGANIZATION_SCOPE_MISSING')
  })
})

describe('Warnings', () => {
  it('warns when the governed agent review is overdue', () => {
    const ctx = context({ agent: agent('agent-1', '2026-01-01T00:00:00.000Z') })
    const fired = agentReviewWarning(ctx)
    expect(codesOf(fired)).toEqual(['AGENT_REVIEW_OVERDUE'])
    expect(fired[0]?.statusImpact).toBe('WARNING')
  })

  it('stays silent when the review is not yet due', () => {
    const ctx = context({ agent: agent('agent-1', '2027-01-01T00:00:00.000Z') })
    expect(agentReviewWarning(ctx)).toEqual([])
  })
})

describe('Rule purity', () => {
  it('does not mutate the context it is given', () => {
    const ctx = context()
    const before = JSON.stringify(ctx)
    auth001AccountableOwner(ctx)
    auth003MatchingAuthority(ctx)
    auth012DelegationChain(ctx)
    expect(JSON.stringify(ctx)).toEqual(before)
  })
})
