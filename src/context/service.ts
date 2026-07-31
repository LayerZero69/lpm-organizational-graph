import type { EvaluationResult } from '../authority/types.js'
import type {
  ContextPackage,
  ContextPackageRequest,
  ContextServiceDependencies,
  ContextStatus,
  DecisionStatus,
  OperatingModelStateScope,
  ProvenanceEntry,
} from './contracts.js'

const ADVISORY_SCOPES = new Set<OperatingModelStateScope>(['PROPOSED', 'SIMULATED', 'APPROVED'])

export class OrganizationalContextService {
  private readonly deps: ContextServiceDependencies

  constructor(deps: ContextServiceDependencies) {
    this.deps = deps
  }

  async assemblePackage(request: ContextPackageRequest): Promise<ContextPackage> {
    assertRequest(request)
    const organization = await this.deps.organizations.resolve(request.organizationId)
    if (organization === null || organization.organizationId !== request.organizationId) {
      throw new Error('OCS_ORGANIZATION_UNRESOLVED')
    }

    const stateScope = request.stateScope ?? 'CURRENT'
    const evaluation = await this.deps.authority.evaluate({
      organizationId: organization.organizationId,
      decisionEventLogicalId: request.target.logicalId,
      ...(request.effectiveAt === undefined ? {} : { effectiveAt: request.effectiveAt }),
      correlationId: request.correlationId,
    })
    const effectiveAt = request.effectiveAt ?? evaluation.temporalContext.validAt
    const evaluatedAt = this.deps.now?.().toISOString() ?? evaluation.evaluatedAt
    const contextStatus = resolveContextStatus(evaluation)
    const decisionStatus = resolveDecisionStatus(evaluation, stateScope, contextStatus)
    const stateReference =
      stateScope === 'CURRENT'
        ? organization.currentStateReference
        : {
            referenceId: `${organization.currentStateReference.referenceId}:${stateScope.toLowerCase()}`,
            stateScope,
            version: organization.currentStateReference.version,
            source:
              stateScope === 'ACTUAL'
                ? ('ORGANIZATIONAL_GRAPH' as const)
                : ('ORGANIZATIONAL_TWIN' as const),
            canAuthorizeLiveExecution: stateScope === 'ACTUAL',
          }
    const ttlSeconds = this.deps.ttlSeconds ?? 300
    const expiresAt = new Date(Date.parse(evaluatedAt) + ttlSeconds * 1000).toISOString()
    const evidenceLogicalIds = unique([
      ...evaluation.evidenceCompleteness.satisfyingAssetLogicalIds,
      ...evaluation.violations.flatMap((reason) => reason.evidenceRefs),
    ])
    const provenanceManifest = buildProvenance(evaluation)
    const humanReviewRequired = evaluation.reviewRequirements.length > 0
    const humanReviewMissing = evaluation.violations.some((reason) => reason.code === 'MISSING_HUMAN_REVIEW')
    const mismatch = evaluation.violations.some((reason) => reason.code === 'PERMISSION_AUTHORITY_MISMATCH')
    const recommendation = recommendationFor(decisionStatus)

    const unsigned: ContextPackage = {
      contextPackageId: `ocs-${request.requestId}`,
      request: {
        requestId: request.requestId,
        correlationId: request.correlationId,
        idempotencyKey: request.idempotencyKey ?? null,
      },
      organization: {
        organizationId: organization.organizationId,
        mode: organization.mode,
      },
      requestingActor: request.requestingActor,
      target: request.target,
      purpose: request.purpose,
      evaluatedAt,
      effectiveAt,
      expiresAt,
      refreshRequired: Date.parse(expiresAt) <= Date.parse(evaluatedAt),
      contextStatus,
      decisionStatus,
      stateScope,
      stateReference,
      ownership: {
        accountablePersonLogicalId: evaluation.accountablePersonLogicalId,
        accountablePersonName: null,
        operationalOwnerLogicalId: null,
        technicalOwnerLogicalId: null,
      },
      authority: {
        matchingGrantLogicalId: evaluation.matchingGrantLogicalId,
        limitations: evaluation.requiredActions.map((action) => action.description),
        violations: evaluation.violations.map((reason) => ({
          code: reason.code,
          detail: reason.detail,
          clearingPredicate: reason.clearingPredicate,
        })),
      },
      governance: {
        policyLogicalIds: evaluation.applicablePolicyLogicalIds,
        controlLogicalIds: evaluation.applicableControlLogicalIds,
        reviewRequirements: evaluation.reviewRequirements,
      },
      information: {
        informationAssetLogicalIds: evaluation.informationAssetLogicalIds,
        requiredCount: evaluation.evidenceCompleteness.requiredClassCount,
        presentCount: evaluation.evidenceCompleteness.satisfiedClassCount,
        missingLogicalIds: evaluation.evidenceCompleteness.gaps.map((gap) => gap.classId),
      },
      systems: {
        invokedSystemLogicalIds: evaluation.invokedSystemLogicalIds,
        permissionLogicalIds: evaluation.systemPermissionLogicalIds,
        permissionAuthorityMismatch: mismatch,
      },
      approvals: {
        humanReviewRequired,
        satisfied: !humanReviewMissing,
      },
      escalation: {
        accountablePersonLogicalId: evaluation.accountablePersonLogicalId,
        supervisorPersonLogicalId: evaluation.supervisorPersonLogicalId,
        supervisorCapacity: 'UNKNOWN',
      },
      evidence: {
        logicalIds: evidenceLogicalIds,
        completeness: evaluation.evidenceCompleteness.completenessRatio,
      },
      lineage: {
        delegationChain: evaluation.delegationChain.map((link) => ({
          grantLogicalId: link.grantLogicalId,
          depth: link.depth,
          organizationalSource: link.organizationalSource,
        })),
        complete:
          evaluation.delegationChain.length > 0 &&
          evaluation.delegationChain.at(-1)?.organizationalSource !== null,
      },
      risks: evaluation.violations.map((reason) => reason.code),
      requiredActions: evaluation.requiredActions,
      recommendation,
      contextConfidence: {
        score: evaluation.confidence,
        completeness: evaluation.evidenceCompleteness.completenessRatio,
        freshness: evaluation.evidenceCompleteness.gaps.some((gap) => gap.kind === 'STALE')
          ? 'STALE'
          : 'CURRENT',
        lineageComplete:
          evaluation.delegationChain.length > 0 &&
          evaluation.delegationChain.at(-1)?.organizationalSource !== null,
      },
      gateConfidence: null,
      ontologyVersion: evaluation.ontologyVersion,
      schemaVersion: evaluation.schemaVersion,
      ruleSetVersion: evaluation.ruleSetVersion,
      contextContractVersion: '0.3.0',
      temporalReplayKey: {
        organizationId: organization.organizationId,
        effectiveAt,
        ruleSetVersion: evaluation.ruleSetVersion,
        stateReferenceId: stateReference.referenceId,
      },
      provenanceManifest,
      contextPackageHash: '',
      verificationToken: null,
      policyDecisionId: `policy-${evaluation.correlationId}`,
      readOnly: true,
    }

    const contextPackageHash = await this.deps.integrity.hash(canonicalPayload(unsigned))
    const verificationToken =
      request.requireVerificationToken === true && this.deps.integrity.sign !== undefined
        ? await this.deps.integrity.sign(contextPackageHash)
        : null
    const contextPackage = { ...unsigned, contextPackageHash, verificationToken }

    // DIAGNOSTIC history is frozen input. Even OCS evaluation artifacts remain
    // outside that tenant's write rail.
    if (organization.mode === 'LIVE') {
      await this.deps.audit.recordEvaluation({
        contextPackageId: contextPackage.contextPackageId,
        organizationId: organization.organizationId,
        organizationMode: organization.mode,
        correlationId: request.correlationId,
        contextStatus,
        decisionStatus,
        contextPackageHash,
        evaluatedAt,
      })
    }

    return contextPackage
  }

  async verifyPackage(contextPackage: ContextPackage): Promise<boolean> {
    const expected = await this.deps.integrity.hash(canonicalPayload(contextPackage))
    return expected === contextPackage.contextPackageHash
  }
}

function assertRequest(request: ContextPackageRequest): void {
  for (const [field, value] of [
    ['requestId', request.requestId],
    ['organizationId', request.organizationId],
    ['purpose', request.purpose],
    ['correlationId', request.correlationId],
    ['requestingActor.logicalId', request.requestingActor.logicalId],
    ['target.logicalId', request.target.logicalId],
    ['target.intendedAction', request.target.intendedAction],
  ] as const) {
    if (value.trim().length === 0) throw new Error(`OCS_INVALID_REQUEST:${field}`)
  }
  if (request.effectiveAt !== undefined && Number.isNaN(Date.parse(request.effectiveAt))) {
    throw new Error('OCS_INVALID_REQUEST:effectiveAt')
  }
}

function resolveContextStatus(result: EvaluationResult): ContextStatus {
  const codes = new Set(result.violations.map((reason) => reason.code))
  if (result.status === 'INDETERMINATE') return 'UNAVAILABLE'
  if (codes.has('POLICY_CONFLICT')) return 'CONFLICTED'
  if (
    result.evidenceCompleteness.completenessRatio < 1 ||
    result.accountablePersonLogicalId === null ||
    result.matchingGrantLogicalId === null
  ) {
    return 'INCOMPLETE'
  }
  if (result.status === 'CONDITIONALLY_AUTHORIZED') return 'CONDITIONALLY_COMPLETE'
  return 'COMPLETE'
}

function resolveDecisionStatus(
  result: EvaluationResult,
  stateScope: OperatingModelStateScope,
  contextStatus: ContextStatus,
): DecisionStatus {
  if (ADVISORY_SCOPES.has(stateScope)) return 'NOT_APPLICABLE'
  if (contextStatus === 'UNAVAILABLE' || contextStatus === 'CONFLICTED' || contextStatus === 'INCOMPLETE') {
    return 'UNAUTHORIZED'
  }
  if (result.status === 'AUTHORIZED') return 'AUTHORIZED'
  if (result.status === 'CONDITIONALLY_AUTHORIZED') return 'CONDITIONALLY_AUTHORIZED'
  return 'UNAUTHORIZED'
}

function recommendationFor(
  status: DecisionStatus,
): ContextPackage['recommendation'] {
  if (status === 'AUTHORIZED') return 'PROCEED'
  if (status === 'CONDITIONALLY_AUTHORIZED' || status === 'REVIEW_REQUIRED') return 'HOLD_FOR_REVIEW'
  if (status === 'NOT_APPLICABLE') return 'ADVISORY_ONLY'
  return 'BLOCK_AND_ESCALATE'
}

function buildProvenance(result: EvaluationResult): ProvenanceEntry[] {
  const entries: ProvenanceEntry[] = []
  const add = (artifactType: string, ids: readonly string[]): void => {
    for (const logicalId of ids) {
      entries.push({
        artifactType,
        logicalId,
        version: result.schemaVersion,
        integrityState: 'VERIFIED',
      })
    }
  }
  add('AUTHORITY_GRANT', result.delegationChain.map((link) => link.grantLogicalId))
  add('POLICY', result.applicablePolicyLogicalIds)
  add('CONTROL', result.applicableControlLogicalIds)
  add('INFORMATION_ASSET', result.informationAssetLogicalIds)
  add('SYSTEM_PERMISSION', result.systemPermissionLogicalIds)
  return entries
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort()
}

function canonicalPayload(contextPackage: ContextPackage): string {
  return stableStringify({
    ...contextPackage,
    contextPackageHash: '',
    verificationToken: null,
  })
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}
