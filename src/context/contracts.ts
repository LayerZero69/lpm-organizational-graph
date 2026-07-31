/**
 * Organizational Context Services v0.3 contract.
 *
 * The graph owns organizational truth and deterministic evaluation. OCS owns
 * purpose-bound assembly and delivery. These types are the versioned boundary
 * between those responsibilities; they do not create a mutation path.
 */

import type { EvaluationResult } from '../authority/types.js'
import type { RequiredAction } from '../authority/status.js'

export const ORGANIZATION_MODES = ['LIVE', 'DIAGNOSTIC'] as const
export type OrganizationMode = (typeof ORGANIZATION_MODES)[number]

export const OPERATING_MODEL_STATE_SCOPES = [
  'CURRENT',
  'PROPOSED',
  'SIMULATED',
  'APPROVED',
  'ACTUAL',
] as const
export type OperatingModelStateScope = (typeof OPERATING_MODEL_STATE_SCOPES)[number]

export const CONTEXT_STATUSES = [
  'COMPLETE',
  'CONDITIONALLY_COMPLETE',
  'INCOMPLETE',
  'CONFLICTED',
  'UNAVAILABLE',
] as const
export type ContextStatus = (typeof CONTEXT_STATUSES)[number]

export const DECISION_STATUSES = [
  'AUTHORIZED',
  'CONDITIONALLY_AUTHORIZED',
  'UNAUTHORIZED',
  'REVIEW_REQUIRED',
  'NOT_APPLICABLE',
] as const
export type DecisionStatus = (typeof DECISION_STATUSES)[number]

export interface ContextActor {
  readonly actorType: 'PERSON' | 'GOVERNED_AGENT' | 'SYSTEM'
  readonly logicalId: string
}

export interface ContextTarget {
  readonly objectType: string
  readonly logicalId: string
  readonly intendedAction: string
}

/** Client-supplied request. Organization mode is deliberately absent. */
export interface ContextPackageRequest {
  readonly requestId: string
  readonly organizationId: string
  readonly requestingActor: ContextActor
  readonly target: ContextTarget
  readonly purpose: string
  readonly effectiveAt?: string
  readonly stateScope?: OperatingModelStateScope
  readonly correlationId: string
  readonly idempotencyKey?: string
  readonly requireVerificationToken?: boolean
}

export interface TemporalReplayKey {
  readonly organizationId: string
  readonly effectiveAt: string
  readonly ruleSetVersion: string
  readonly stateReferenceId: string
}

/** Versioned boundary owned by the Organizational Twin or current graph state. */
export interface OperatingModelStateReference {
  readonly referenceId: string
  readonly stateScope: OperatingModelStateScope
  readonly version: string
  readonly source: 'ORGANIZATIONAL_GRAPH' | 'ORGANIZATIONAL_TWIN'
  readonly canAuthorizeLiveExecution: boolean
}

export interface ContextConfidence {
  readonly score: number
  readonly completeness: number
  readonly freshness: 'CURRENT' | 'STALE' | 'UNKNOWN'
  readonly lineageComplete: boolean
}

export interface GateConfidence {
  readonly score: number
  readonly threshold: number
  readonly cleared: boolean
  readonly measuredAt: string
}

export interface ProvenanceEntry {
  readonly artifactType: string
  readonly logicalId: string
  readonly version: string
  readonly integrityState: 'VERIFIED' | 'UNVERIFIED'
}

export interface OwnershipContext {
  readonly accountablePersonLogicalId: string | null
  readonly accountablePersonName: string | null
  readonly operationalOwnerLogicalId: string | null
  readonly technicalOwnerLogicalId: string | null
}

export interface AuthorityContext {
  readonly matchingGrantLogicalId: string | null
  readonly limitations: readonly string[]
  readonly violations: readonly {
    readonly code: string
    readonly detail: string
    readonly clearingPredicate: string
  }[]
}

export interface GovernanceContext {
  readonly policyLogicalIds: readonly string[]
  readonly controlLogicalIds: readonly string[]
  readonly reviewRequirements: readonly {
    readonly source: string
    readonly reference: string
    readonly detail: string
  }[]
}

export interface InformationContext {
  readonly informationAssetLogicalIds: readonly string[]
  readonly requiredCount: number
  readonly presentCount: number
  readonly missingLogicalIds: readonly string[]
}

export interface SystemContext {
  readonly invokedSystemLogicalIds: readonly string[]
  readonly permissionLogicalIds: readonly string[]
  readonly permissionAuthorityMismatch: boolean
}

export interface EscalationContext {
  readonly accountablePersonLogicalId: string | null
  readonly supervisorPersonLogicalId: string | null
  readonly supervisorCapacity: 'AVAILABLE' | 'OVER_CAPACITY' | 'UNKNOWN'
}

export interface LineageContext {
  readonly delegationChain: readonly {
    readonly grantLogicalId: string
    readonly depth: number
    readonly organizationalSource: string | null
  }[]
  readonly complete: boolean
}

export interface ContextPackage {
  readonly contextPackageId: string
  readonly request: {
    readonly requestId: string
    readonly correlationId: string
    readonly idempotencyKey: string | null
  }
  readonly organization: {
    readonly organizationId: string
    readonly mode: OrganizationMode
  }
  readonly requestingActor: ContextActor
  readonly target: ContextTarget
  readonly purpose: string
  readonly evaluatedAt: string
  readonly effectiveAt: string
  readonly expiresAt: string
  readonly refreshRequired: boolean
  readonly contextStatus: ContextStatus
  readonly decisionStatus: DecisionStatus
  readonly stateScope: OperatingModelStateScope
  readonly stateReference: OperatingModelStateReference
  readonly ownership: OwnershipContext
  readonly authority: AuthorityContext
  readonly governance: GovernanceContext
  readonly information: InformationContext
  readonly systems: SystemContext
  readonly approvals: {
    readonly humanReviewRequired: boolean
    readonly satisfied: boolean
  }
  readonly escalation: EscalationContext
  readonly evidence: {
    readonly logicalIds: readonly string[]
    readonly completeness: number
  }
  readonly lineage: LineageContext
  readonly risks: readonly string[]
  readonly requiredActions: readonly RequiredAction[]
  readonly recommendation: 'PROCEED' | 'HOLD_FOR_REVIEW' | 'BLOCK_AND_ESCALATE' | 'ADVISORY_ONLY'
  readonly contextConfidence: ContextConfidence
  readonly gateConfidence: GateConfidence | null
  readonly ontologyVersion: string
  readonly schemaVersion: string
  readonly ruleSetVersion: string
  readonly contextContractVersion: string
  readonly temporalReplayKey: TemporalReplayKey
  readonly provenanceManifest: readonly ProvenanceEntry[]
  readonly contextPackageHash: string
  readonly verificationToken: string | null
  readonly policyDecisionId: string
  readonly readOnly: true
}

export interface OrganizationResolution {
  readonly organizationId: string
  readonly mode: OrganizationMode
  readonly currentStateReference: OperatingModelStateReference
}

export interface OrganizationResolver {
  resolve(organizationId: string): Promise<OrganizationResolution | null>
}

export interface AuthorityEvaluationPort {
  evaluate(request: {
    readonly organizationId: string
    readonly decisionEventLogicalId: string
    readonly effectiveAt?: string
    readonly correlationId: string
  }): Promise<EvaluationResult>
}

export interface ContextEvaluationAudit {
  readonly contextPackageId: string
  readonly organizationId: string
  readonly organizationMode: OrganizationMode
  readonly correlationId: string
  readonly contextStatus: ContextStatus
  readonly decisionStatus: DecisionStatus
  readonly contextPackageHash: string
  readonly evaluatedAt: string
}

export interface ContextAuditPort {
  recordEvaluation(audit: ContextEvaluationAudit): Promise<void>
}

export interface ContextIntegrityPort {
  hash(payload: string): Promise<string>
  sign?(hash: string): Promise<string>
}

export interface ContextServiceDependencies {
  readonly organizations: OrganizationResolver
  readonly authority: AuthorityEvaluationPort
  readonly audit: ContextAuditPort
  readonly integrity: ContextIntegrityPort
  readonly now?: () => Date
  readonly ttlSeconds?: number
}

export interface OrganizationalContextServiceContract {
  assemblePackage(request: ContextPackageRequest): Promise<ContextPackage>
  verifyPackage(contextPackage: ContextPackage): Promise<boolean>
}

export const CONTEXT_SERVICE_BOUNDARIES = [
  'Purpose-bound and organization-scoped.',
  'Organization mode is resolved server-side before graph traversal.',
  'Read and evaluate organizational truth; never mutate it.',
  'Proposed, simulated, and approved future states are advisory only.',
  'Authority-bearing uncertainty fails closed.',
] as const
