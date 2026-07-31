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
  type ContextPackage,
  type ContextPackageRequest,
  type ContextVerificationFailureReason,
  type OrganizationMode,
} from '@/context/index.js'
import type { GraphDataset } from '@/adapters/memory/in-memory-repository.js'

const fixedNow = new Date('2026-04-10T14:00:00.000Z')
const TEST_KEY = 'synthetic-ocs-test-key'

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
  }
}

interface ServiceOptions {
  readonly mode?: OrganizationMode
  readonly signingSecret?: string | undefined
  readonly resolvedOrganizationId?: string
  readonly evaluationOrganizationId?: string
}

function service(
  dataset: GraphDataset,
  options: ServiceOptions = {},
): { service: OrganizationalContextService; audits: ContextEvaluationAudit[] } {
  const evaluator = new AuthorityEvaluator({
    repository: new InMemoryGraphRepository(dataset),
    ceilingProvider: fixtureCeilingProvider(),
  })
  const audits: ContextEvaluationAudit[] = []
  const signingSecret = Object.hasOwn(options, 'signingSecret')
    ? options.signingSecret
    : TEST_KEY
  return {
    service: new OrganizationalContextService({
      organizations: {
        resolve: async (organizationId) => ({
          organizationId: options.resolvedOrganizationId ?? organizationId,
          mode: options.mode ?? 'LIVE',
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
        evaluate: async (input) => ({
          organizationId: options.evaluationOrganizationId ?? input.organizationId,
          evaluation: await evaluator.evaluate({
            organizationId: input.organizationId,
            decisionEventLogicalId: input.decisionEventLogicalId,
            ...(input.effectiveAt === undefined
              ? {}
              : { temporalContext: temporalContext(input.effectiveAt) }),
            correlationId: input.correlationId,
          }),
        }),
      },
      audit: {
        recordEvaluation: async (audit) => {
          audits.push(audit)
        },
      },
      integrity: new Sha256ContextIntegrity(signingSecret),
      now: () => fixedNow,
    }),
    audits,
  }
}

async function signedPackage(): Promise<ContextPackage> {
  return service(procurementScenario()).service.assemblePackage(request())
}

async function expectInvalid(
  runtime: OrganizationalContextService,
  contextPackage: unknown,
  reason: ContextVerificationFailureReason,
  organizationId = ORG,
): Promise<void> {
  const result = await runtime.verifyPackage(contextPackage, { organizationId })
  expect(result.valid).toBe(false)
  expect(result.reasons).toContain(reason)
}

describe('Organizational Context Services procurement vertical slice', () => {
  it('returns a valid, integrity-verifiable, fail-closed Context Package', async () => {
    const runtime = service(procurementScenario())
    const contextPackage = await runtime.service.assemblePackage(request())
    const verification = await runtime.service.verifyPackage(contextPackage, { organizationId: ORG })

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
    expect(contextPackage.integrity.algorithm).toBe('SHA256_HMAC_SHA256')
    expect(contextPackage.integrity.contentHash).toMatch(/^[a-f0-9]{64}$/)
    expect(contextPackage.integrity.authenticationToken).toMatch(/^[a-f0-9]{64}$/)
    expect(verification).toMatchObject({
      valid: true,
      reasons: [],
      hashStatus: 'VALID',
      tokenStatus: 'VALID',
      versionStatus: 'VALID',
      organizationScopeStatus: 'VALID',
    })
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
    const runtime = service(procurementScenario(), { mode: 'DIAGNOSTIC' })
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
})

describe('OCS v0.3 integrity verification', () => {
  it('accepts the correct key and an unchanged package', async () => {
    const runtime = service(procurementScenario())
    const contextPackage = await runtime.service.assemblePackage(request())

    expect(await runtime.service.verifyPackage(contextPackage, { organizationId: ORG })).toMatchObject({
      valid: true,
      hashStatus: 'VALID',
      tokenStatus: 'VALID',
    })
  })

  it('rejects the wrong shared verification key', async () => {
    const contextPackage = await signedPackage()
    const wrongKey = service(procurementScenario(), { signingSecret: 'different-synthetic-key' })

    await expectInvalid(wrongKey.service, contextPackage, 'AUTHENTICATION_TOKEN_MISMATCH')
  })

  it('rejects an altered HMAC authentication token', async () => {
    const runtime = service(procurementScenario())
    const contextPackage = await runtime.service.assemblePackage(request())
    const altered = {
      ...contextPackage,
      integrity: { ...contextPackage.integrity, authenticationToken: '0'.repeat(64) },
    }

    await expectInvalid(runtime.service, altered, 'AUTHENTICATION_TOKEN_MISMATCH')
  })

  it('rejects a malformed HMAC authentication token', async () => {
    const runtime = service(procurementScenario())
    const contextPackage = await runtime.service.assemblePackage(request())
    const malformed = {
      ...contextPackage,
      integrity: { ...contextPackage.integrity, authenticationToken: 'not-hex' },
    }

    await expectInvalid(runtime.service, malformed, 'AUTHENTICATION_TOKEN_MALFORMED')
  })

  it('rejects a missing HMAC authentication token', async () => {
    const runtime = service(procurementScenario())
    const contextPackage = await runtime.service.assemblePackage(request())
    const missing = {
      ...contextPackage,
      integrity: { ...contextPackage.integrity, authenticationToken: null },
    }

    await expectInvalid(runtime.service, missing, 'AUTHENTICATION_TOKEN_MISSING')
  })

  it('rejects an unsupported integrity algorithm without dispatching to it', async () => {
    const runtime = service(procurementScenario())
    const contextPackage = await runtime.service.assemblePackage(request())
    const unsupported = {
      ...contextPackage,
      integrity: { ...contextPackage.integrity, algorithm: 'MD5' },
    }

    await expectInvalid(runtime.service, unsupported, 'UNSUPPORTED_INTEGRITY_ALGORITHM')
  })

  it('rejects tampered package content', async () => {
    const runtime = service(procurementScenario())
    const contextPackage = await runtime.service.assemblePackage(request())
    const tampered = { ...contextPackage, purpose: 'Altered purpose' }

    await expectInvalid(runtime.service, tampered, 'CONTENT_HASH_MISMATCH')
  })

  it.each([
    ['evidence ID', (value: ContextPackage) => ({ ...value, evidence: { ...value.evidence, logicalIds: ['evidence-altered'] } })],
    ['evidence completeness', (value: ContextPackage) => ({ ...value, evidence: { ...value.evidence, completeness: 0.123 } })],
    ['provenance reference', (value: ContextPackage) => ({ ...value, provenanceManifest: value.provenanceManifest.map((entry, index) => index === 0 ? { ...entry, logicalId: 'provenance-altered' } : entry) })],
    ['provenance version', (value: ContextPackage) => ({ ...value, provenanceManifest: value.provenanceManifest.map((entry, index) => index === 0 ? { ...entry, version: 'altered' } : entry) })],
    ['authoritative-source marker', (value: ContextPackage) => ({ ...value, provenanceManifest: value.provenanceManifest.map((entry, index) => index === 0 ? { ...entry, integrityState: 'UNVERIFIED' as const } : entry) })],
    ['evidence confidence', (value: ContextPackage) => ({ ...value, contextConfidence: { ...value.contextConfidence, score: 0.123 } })],
  ])('rejects tampered %s in the governed evidence payload', async (_name, alter) => {
    const runtime = service(procurementScenario())
    const contextPackage = await runtime.service.assemblePackage(request())

    await expectInvalid(runtime.service, alter(contextPackage), 'CONTENT_HASH_MISMATCH')
  })

  it('rejects a tampered organization identifier', async () => {
    const runtime = service(procurementScenario())
    const contextPackage = await runtime.service.assemblePackage(request())
    const tampered = {
      ...contextPackage,
      organization: { ...contextPackage.organization, organizationId: 'org-other' },
    }

    const result = await runtime.service.verifyPackage(tampered, { organizationId: ORG })
    expect(result.valid).toBe(false)
    expect(result.reasons).toEqual(expect.arrayContaining([
      'ORGANIZATION_SCOPE_MISMATCH',
      'CONTENT_HASH_MISMATCH',
    ]))
  })

  it('rejects cross-organization assembly returned by the resolver', async () => {
    const runtime = service(procurementScenario(), { resolvedOrganizationId: 'org-other' })

    await expect(runtime.service.assemblePackage(request())).rejects.toThrow('OCS_ORGANIZATION_UNRESOLVED')
  })

  it('rejects cross-organization query results before package assembly', async () => {
    const runtime = service(procurementScenario(), { evaluationOrganizationId: 'org-other' })

    await expect(runtime.service.assemblePackage(request())).rejects.toThrow('OCS_ORGANIZATION_SCOPE_MISMATCH')
  })

  it.each([
    ['schemaVersion', 'UNSUPPORTED_SCHEMA_VERSION'],
    ['contextContractVersion', 'UNSUPPORTED_CONTEXT_CONTRACT_VERSION'],
    ['ontologyVersion', 'UNSUPPORTED_ONTOLOGY_VERSION'],
    ['ruleSetVersion', 'UNSUPPORTED_RULE_SET_VERSION'],
  ] as const)('rejects an unsupported %s', async (field, reason) => {
    const runtime = service(procurementScenario())
    const contextPackage = await runtime.service.assemblePackage(request())
    const unsupported = { ...contextPackage, [field]: '999.0.0' }

    await expectInvalid(runtime.service, unsupported, reason)
  })

  it('rejects a malformed integrity envelope', async () => {
    const runtime = service(procurementScenario())
    const contextPackage = await runtime.service.assemblePackage(request())

    await expectInvalid(runtime.service, { ...contextPackage, integrity: null }, 'MALFORMED_INTEGRITY_ENVELOPE')
  })

  it('rejects an empty verification key', async () => {
    const contextPackage = await signedPackage()
    const runtime = service(procurementScenario(), { signingSecret: '' })

    await expectInvalid(runtime.service, contextPackage, 'VERIFICATION_KEY_INVALID')
  })

  it('rejects a malformed whitespace-only verification key', async () => {
    const contextPackage = await signedPackage()
    const runtime = service(procurementScenario(), { signingSecret: '   ' })

    await expectInvalid(runtime.service, contextPackage, 'VERIFICATION_KEY_INVALID')
  })

  it('rejects a missing verification key', async () => {
    const contextPackage = await signedPackage()
    const runtime = service(procurementScenario(), { signingSecret: undefined })

    await expectInvalid(runtime.service, contextPackage, 'VERIFICATION_KEY_UNAVAILABLE')
  })

  it('rejects a stored content-hash mismatch', async () => {
    const runtime = service(procurementScenario())
    const contextPackage = await runtime.service.assemblePackage(request())
    const altered = {
      ...contextPackage,
      integrity: { ...contextPackage.integrity, contentHash: '0'.repeat(64) },
    }

    await expectInvalid(runtime.service, altered, 'CONTENT_HASH_MISMATCH')
  })

  it('rejects a token mismatch even when the stored content hash matches', async () => {
    const runtime = service(procurementScenario())
    const contextPackage = await runtime.service.assemblePackage(request())
    const altered = {
      ...contextPackage,
      integrity: { ...contextPackage.integrity, authenticationToken: 'f'.repeat(64) },
    }
    const result = await runtime.service.verifyPackage(altered, { organizationId: ORG })

    expect(result.hashStatus).toBe('VALID')
    expect(result.tokenStatus).toBe('INVALID')
    expect(result.reasons).toContain('AUTHENTICATION_TOKEN_MISMATCH')
  })

  it('reassembles deterministically and verifies with the correct key', async () => {
    const first = service(procurementScenario())
    const second = service(procurementScenario())
    const firstPackage = await first.service.assemblePackage(request())
    const secondPackage = await second.service.assemblePackage({
      ...request(),
      effectiveAt: firstPackage.temporalReplayKey.effectiveAt,
    })

    expect(secondPackage.integrity).toEqual(firstPackage.integrity)
    expect(secondPackage.decisionStatus).toBe(firstPackage.decisionStatus)
    expect(secondPackage.authority).toEqual(firstPackage.authority)
    expect(await second.service.verifyPackage(secondPackage, { organizationId: ORG })).toMatchObject({ valid: true })
  })

  it('never silently defaults malformed input to successful verification', async () => {
    const runtime = service(procurementScenario())
    const result = await runtime.service.verifyPackage(undefined, { organizationId: ORG })

    expect(result).toMatchObject({
      valid: false,
      reasons: ['MALFORMED_PACKAGE'],
      hashStatus: 'NOT_CHECKED',
      tokenStatus: 'NOT_CHECKED',
    })
  })

  it('returns a typed failure when the expected organization scope is malformed', async () => {
    const runtime = service(procurementScenario())
    const contextPackage = await runtime.service.assemblePackage(request())
    const result = await runtime.service.verifyPackage(
      contextPackage,
      undefined as unknown as { organizationId: string },
    )

    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('MALFORMED_PACKAGE')
    expect(result.organizationScopeStatus).toBe('NOT_CHECKED')
  })
})
