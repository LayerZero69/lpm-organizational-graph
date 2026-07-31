import { describe, expect, it } from 'vitest'
import { InMemoryGraphRepository } from '@/adapters/memory/in-memory-repository.js'
import { AuthorityEvaluator } from '@/authority/evaluator.js'
import {
  fixtureCeilingProvider,
  fullyCompliant,
  ID,
  ORG,
  procurementScenario,
} from '@/fixtures/procurement-scenario.js'
import { temporalContext } from '@/graph/temporal.js'
import {
  OrganizationalContextService,
  Sha256ContextIntegrity,
  assertValidContextPackage,
  type ContextEvaluationAudit,
  type ContextPackageRequest,
  type OrganizationMode,
} from '@/context/index.js'
import type { GraphDataset } from '@/adapters/memory/in-memory-repository.js'

const fixedNow = new Date('2026-04-10T14:00:00.000Z')

function request(
  stateScope: ContextPackageRequest['stateScope'] = 'CURRENT',
): ContextPackageRequest {
  return {
    requestId: 'request-procurement-42k',
    organizationId: ORG,
    requestingActor: { actorType: 'GOVERNED_AGENT', logicalId: ID.agent },
    target: {
      objectType: 'DecisionEvent',
      logicalId: ID.decisionEvent,
      intendedAction: 'APPROVE_PURCHASE',
    },
    purpose: 'Pre-action procurement authority check',
    stateScope,
    correlationId: 'corr-procurement-42k',
    idempotencyKey: 'idem-procurement-42k',
    requireVerificationToken: true,
  }
}

function service(
  dataset: GraphDataset,
  mode: OrganizationMode = 'LIVE',
): { service: OrganizationalContextService; audits: ContextEvaluationAudit[] } {
  const evaluator = new AuthorityEvaluator({
    repository: new InMemoryGraphRepository(dataset),
    ceilingProvider: fixtureCeilingProvider(),
  })
  const audits: ContextEvaluationAudit[] = []
  return {
    service: new OrganizationalContextService({
      organizations: {
        resolve: async (organizationId) => ({
          organizationId,
          mode,
          currentStateReference: {
            referenceId: 'org-state-current-v1',
            stateScope: 'CURRENT',
            version: '1',
            source: 'ORGANIZATIONAL_GRAPH',
            canAuthorizeLiveExecution: true,
          },
        }),
      },
      authority: {
        evaluate: async (input) =>
          evaluator.evaluate({
            organizationId: input.organizationId,
            decisionEventLogicalId: input.decisionEventLogicalId,
            ...(input.effectiveAt === undefined
              ? {}
              : { temporalContext: temporalContext(input.effectiveAt) }),
            correlationId: input.correlationId,
          }),
      },
      audit: {
        recordEvaluation: async (audit) => {
          audits.push(audit)
        },
      },
      integrity: new Sha256ContextIntegrity('test-signing-secret'),
      now: () => fixedNow,
    }),
    audits,
  }
}

describe('Organizational Context Services procurement vertical slice', () => {
  it('returns a valid, integrity-verifiable, fail-closed Context Package', async () => {
    const runtime = service(procurementScenario())
    const contextPackage = await runtime.service.assemblePackage(request())

    expect(contextPackage.organization.mode).toBe('LIVE')
    expect(contextPackage.contextStatus).toBe('INCOMPLETE')
    expect(contextPackage.decisionStatus).toBe('UNAUTHORIZED')
    expect(contextPackage.recommendation).toBe('BLOCK_AND_ESCALATE')
    expect(contextPackage.ownership.accountablePersonLogicalId).toBe(ID.procurementDirector)
    expect(contextPackage.authority.matchingGrantLogicalId).toBe(ID.grantAgent)
    expect(contextPackage.authority.violations.map((v) => v.code).sort()).toEqual([
      'FINANCIAL_LIMIT_EXCEEDED',
      'MISSING_HUMAN_REVIEW',
      'MISSING_REQUIRED_INFORMATION',
      'PERMISSION_AUTHORITY_MISMATCH',
    ])
    expect(contextPackage.systems.permissionAuthorityMismatch).toBe(true)
    expect(contextPackage.information.missingLogicalIds).toContain('vendor.risk_classification')
    expect(contextPackage.lineage.complete).toBe(true)
    expect(contextPackage.temporalReplayKey.ruleSetVersion).toBe(contextPackage.ruleSetVersion)
    expect(contextPackage.contextPackageHash).toMatch(/^[a-f0-9]{64}$/)
    expect(contextPackage.verificationToken).toMatch(/^[a-f0-9]{64}$/)
    expect(await runtime.service.verifyPackage(contextPackage)).toBe(true)
    expect(runtime.audits).toHaveLength(1)
    expect(() => assertValidContextPackage(contextPackage)).not.toThrow()
  })

  it('returns AUTHORIZED only after review, evidence, and authority all clear', async () => {
    const runtime = service(fullyCompliant())
    const contextPackage = await runtime.service.assemblePackage(request())

    expect(contextPackage.contextStatus).toBe('COMPLETE')
    expect(contextPackage.decisionStatus).toBe('AUTHORIZED')
    expect(contextPackage.recommendation).toBe('PROCEED')
    expect(contextPackage.authority.violations).toEqual([])
    expect(contextPackage.approvals.satisfied).toBe(true)
    expect(contextPackage.evidence.completeness).toBe(1)
  })

  it('serves DIAGNOSTIC frozen state without writing an evaluation artifact', async () => {
    const runtime = service(procurementScenario(), 'DIAGNOSTIC')
    const contextPackage = await runtime.service.assemblePackage(request())

    expect(contextPackage.organization.mode).toBe('DIAGNOSTIC')
    expect(contextPackage.decisionStatus).toBe('UNAUTHORIZED')
    expect(runtime.audits).toEqual([])
  })

  it('never turns a proposed state into executable authority', async () => {
    const runtime = service(fullyCompliant())
    const contextPackage = await runtime.service.assemblePackage(request('PROPOSED'))

    expect(contextPackage.contextStatus).toBe('COMPLETE')
    expect(contextPackage.decisionStatus).toBe('NOT_APPLICABLE')
    expect(contextPackage.recommendation).toBe('ADVISORY_ONLY')
  })

  it('replays deterministically from the temporal replay key', async () => {
    const first = service(procurementScenario())
    const second = service(procurementScenario())
    const firstPackage = await first.service.assemblePackage(request())
    const secondPackage = await second.service.assemblePackage({
      ...request(),
      effectiveAt: firstPackage.temporalReplayKey.effectiveAt,
    })

    expect(secondPackage.contextPackageHash).toBe(firstPackage.contextPackageHash)
    expect(secondPackage.decisionStatus).toBe(firstPackage.decisionStatus)
    expect(secondPackage.authority).toEqual(firstPackage.authority)
  })
})
