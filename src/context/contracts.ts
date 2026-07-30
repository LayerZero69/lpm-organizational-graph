/**
 * Organizational Context Services: PROPOSED FUTURE CONTRACT ONLY.
 *
 * Organizational Context Services does not exist in the Lapemo ecosystem today.
 * The phrase appears in no canon file, no governance record, and no product
 * surface. It is a proposed future contract and a roadmap concept, and nothing
 * in this package should be read as a claim that it currently exists.
 *
 * Phase 1A defines the typed request and response shapes and nothing else. There
 * is deliberately NO network service, no endpoint host, no authentication layer,
 * no deployment, and no action execution. Defining the contract early keeps the
 * graph and any future service aligned without building premature infrastructure.
 *
 * The proposed service, were it built, would be READ-ONLY, organization-scoped,
 * and answerable only from the governed graph.
 */

import type { AutonomyLevelKey, RiskLevel } from '../domain/enums/index.js'
import type { PrimaryStatus } from '../authority/status.js'

/** Every response is temporal, versioned, evidence-backed and organization-scoped. */
export interface ContextResponseEnvelope {
  /** All answers are temporal. There is no untimed answer. */
  readonly asOf: string
  readonly organizationId: string
  readonly ontologyVersion: string
  readonly ruleSetVersion: string
  readonly schemaVersion: string
  readonly contextContractVersion: string
  readonly confidence: number
  /** Staleness indicators for the signals underlying the answer. */
  readonly stalenessIndicators: readonly StalenessIndicator[]
  readonly evidenceRefs: readonly string[]
  /** Always true. The proposed service never executes an action. */
  readonly readOnly: true
}

export interface StalenessIndicator {
  readonly signal: string
  readonly lastRefreshedAt: string | null
  readonly isStale: boolean
}

export interface ContextRequestBase {
  readonly organizationId: string
  /** Omit to ask about now. Supply to reconstruct a past state. */
  readonly asOf?: string
}

// ── Ownership context ───────────────────────────────────────────────────────
export interface OwnershipContextRequest extends ContextRequestBase {
  readonly subjectLogicalId: string
}

export interface OwnershipContextResponse {
  readonly envelope: ContextResponseEnvelope
  readonly subjectLogicalId: string
  readonly accountablePersonLogicalId: string | null
  readonly accountablePersonName: string | null
  readonly ownershipLineage: readonly OwnershipLineageEntry[]
}

export interface OwnershipLineageEntry {
  readonly personLogicalId: string
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
  readonly sourceSystem: string | null
}

// ── Authority context ───────────────────────────────────────────────────────
export interface AuthorityContextRequest extends ContextRequestBase {
  readonly actorLogicalId: string
  readonly decisionTypeLogicalId?: string
}

export interface AuthorityContextResponse {
  readonly envelope: ContextResponseEnvelope
  readonly actorLogicalId: string
  readonly grants: readonly AuthorityContextGrant[]
}

export interface AuthorityContextGrant {
  readonly grantLogicalId: string
  readonly decisionTypeLogicalId: string
  readonly allowedActions: readonly string[]
  readonly prohibitedActions: readonly string[]
  readonly financialLimit: { readonly amount: number; readonly currency: string } | null
  readonly riskLimit: RiskLevel | null
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
  readonly delegationChainLogicalIds: readonly string[]
}

// ── Governance context ──────────────────────────────────────────────────────
export interface GovernanceContextRequest extends ContextRequestBase {
  readonly decisionTypeLogicalId: string
}

export interface GovernanceContextResponse {
  readonly envelope: ContextResponseEnvelope
  readonly decisionTypeLogicalId: string
  readonly policyLogicalIds: readonly string[]
  readonly controlLogicalIds: readonly string[]
  readonly riskLevel: RiskLevel
  readonly humanReviewConditions: readonly string[]
}

// ── Decision context ────────────────────────────────────────────────────────
export interface DecisionContextRequest extends ContextRequestBase {
  readonly decisionTypeLogicalId: string
  readonly actorLogicalId?: string
}

export interface DecisionContextResponse {
  readonly envelope: ContextResponseEnvelope
  readonly decisionTypeLogicalId: string
  /** Derived at request time from lineage. Never a stored field. */
  readonly autonomyCeiling: AutonomyLevelKey | null
  readonly autonomyCeilingBlockedBy: string | null
  readonly effectiveAutonomyLevel: AutonomyLevelKey | null
  readonly requiredInformationClassIds: readonly string[]
  readonly escalationPersonLogicalId: string | null
}

// ── Accountability context ──────────────────────────────────────────────────
export interface AccountabilityContextRequest extends ContextRequestBase {
  readonly subjectLogicalId: string
}

export interface AccountabilityContextResponse {
  readonly envelope: ContextResponseEnvelope
  readonly subjectLogicalId: string
  readonly accountablePersonLogicalId: string | null
  readonly supervisorPersonLogicalId: string | null
  readonly lastEvaluationStatus: PrimaryStatus | null
}

/**
 * The five proposed context endpoints.
 *
 * This is a TYPE, not an implementation. Nothing in Phase 1A implements it, and
 * implementing it is explicitly out of scope until the roadmap phase that builds
 * the service surface is approved.
 */
export interface OrganizationalContextServiceContract {
  ownershipContext(request: OwnershipContextRequest): Promise<OwnershipContextResponse>
  authorityContext(request: AuthorityContextRequest): Promise<AuthorityContextResponse>
  governanceContext(request: GovernanceContextRequest): Promise<GovernanceContextResponse>
  decisionContext(request: DecisionContextRequest): Promise<DecisionContextResponse>
  accountabilityContext(request: AccountabilityContextRequest): Promise<AccountabilityContextResponse>
}

/** Non-goals, stated in the contract so they cannot be quietly forgotten. */
export const CONTEXT_SERVICE_NON_GOALS = [
  'Read-only. It never executes an action.',
  'Organization-scoped. There is no cross-organization context.',
  'Answers from the governed graph only. It never improvises context from unstructured sources.',
  'Not built in Phase 1A. Contract types only, with no network service of any kind.',
] as const
