/**
 * Authority evaluation types.
 *
 * The evaluator is split into two halves on purpose:
 *
 *   RESOLUTION  asynchronous, touches the repository, gathers facts.
 *   RULES       synchronous, pure, deterministic, no I/O at all.
 *
 * Every rule is a pure function from a fully resolved context to fired reasons.
 * That is what makes each rule independently testable without a repository and
 * what guarantees the same facts always produce the same result.
 */

import type {
  AgentNode,
  PersonNode,
  DecisionEventNode,
  DecisionTypeNode,
  AuthorityGrantNode,
  AutonomyStateNode,
  SystemPermissionNode,
  InformationAssetNode,
  PolicyNode,
  ControlNode,
  ExceptionNode,
  OutcomeNode,
  EnterpriseSystemNode,
} from '../domain/nodes/index.js'
import type { GraphEdge } from '../domain/edges/index.js'
import type { TemporalContext } from '../graph/temporal.js'
import type { AutonomyCeiling } from '../adapters/lapemo/contracts.js'
import type { EvidenceCompleteness } from '../evidence/completeness.js'
import type { FiredReason, PrimaryStatus, RequiredAction } from './status.js'

export interface EvaluationRequest {
  readonly organizationId: string
  readonly decisionEventLogicalId: string
  /**
   * When to evaluate. Omit to evaluate at the decision timestamp, which is the
   * correct default for reconstructing what was true when the decision was made.
   */
  readonly temporalContext?: TemporalContext
  readonly correlationId?: string
}

/** One link in a delegation chain. */
export interface DelegationLink {
  readonly grant: AuthorityGrantNode
  readonly depth: number
}

/** Every fact the rules need, resolved once, before any rule runs. */
export interface ResolvedContext {
  readonly organizationId: string
  readonly temporal: TemporalContext
  /** The instant rules compare timestamps against. */
  readonly evaluationInstant: string

  readonly decisionEvent: DecisionEventNode | null
  readonly decisionType: DecisionTypeNode | null
  readonly agent: AgentNode | null
  /** Present when the final actor is a Person rather than a governed agent. */
  readonly decidingPerson: PersonNode | null

  readonly accountableOwners: readonly PersonNode[]
  readonly supervisors: readonly PersonNode[]
  readonly accountablePersonForOutcome: PersonNode | null

  readonly candidateGrants: readonly AuthorityGrantNode[]
  readonly matchingGrant: AuthorityGrantNode | null
  readonly delegationChain: readonly DelegationLink[]
  readonly delegationTerminates: boolean
  readonly delegationCycleDetected: boolean

  readonly autonomyState: AutonomyStateNode | null
  readonly autonomyCeiling: AutonomyCeiling
  readonly gateClearanceEvidencePresent: boolean

  readonly systemPermissions: readonly SystemPermissionNode[]
  readonly invokedSystems: readonly EnterpriseSystemNode[]
  readonly invokedSystemLogicalIds: readonly string[]

  readonly informationAssetsUsed: readonly InformationAssetNode[]
  readonly evidenceCompleteness: EvidenceCompleteness

  readonly applicablePolicies: readonly PolicyNode[]
  readonly applicableControls: readonly ControlNode[]
  readonly applicableExceptions: readonly ExceptionNode[]

  readonly reviewer: PersonNode | null
  readonly outcome: OutcomeNode | null

  /** Confidence values gathered along every traversed path. */
  readonly confidenceInputs: readonly number[]
  /** Edges traversed, retained for the lineage payload. */
  readonly traversedEdges: readonly GraphEdge[]
}

/** A rule is a pure function over the resolved context. */
export type AuthorityRule = (ctx: ResolvedContext) => FiredReason[]

/** Why human review was required, when it was. */
export interface ReviewRequirementSource {
  readonly source: 'DECISION_TYPE' | 'AUTHORITY_GRANT' | 'POLICY' | 'EXCEPTION'
  readonly reference: string
  readonly detail: string
}

export interface AuthorityLineage {
  readonly grantLogicalId: string
  readonly grantType: string
  readonly grantorActorType: string
  readonly grantorLogicalId: string
  readonly depth: number
  readonly organizationalSource: string | null
}

export interface EvaluationResult {
  readonly status: PrimaryStatus
  readonly violations: readonly FiredReason[]
  readonly warnings: readonly FiredReason[]
  readonly requiredActions: readonly RequiredAction[]

  readonly evaluatedAgentLogicalId: string | null
  readonly decisionEventLogicalId: string
  readonly accountablePersonLogicalId: string | null
  readonly supervisorPersonLogicalId: string | null
  readonly matchingGrantLogicalId: string | null
  readonly delegationChain: readonly AuthorityLineage[]

  readonly applicablePolicyLogicalIds: readonly string[]
  readonly applicableControlLogicalIds: readonly string[]
  readonly informationAssetLogicalIds: readonly string[]
  readonly invokedSystemLogicalIds: readonly string[]
  readonly systemPermissionLogicalIds: readonly string[]

  readonly evidenceCompleteness: EvidenceCompleteness
  readonly reviewRequirements: readonly ReviewRequirementSource[]

  readonly confidence: number
  readonly correlationId: string
  readonly evaluatedAt: string
  readonly temporalContext: TemporalContext

  readonly ontologyVersion: string
  readonly ruleSetVersion: string
  readonly schemaVersion: string
}
