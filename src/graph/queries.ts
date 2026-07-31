/**
 * Typed graph query services.
 *
 * These are the graph query primitives that Organizational Context Services
 * wrap. They return structural facts. They never compute a platform formula, and
 * QRY-007 in particular returns raw counts and distributions only, because the
 * Supervisory Control Capacity formula is owned by the Lapemo platform and is
 * never reimplemented here.
 */

import type { GraphRepository } from './repository.js'
import type { TemporalContext } from './temporal.js'
import type { AutonomyCeilingProvider } from '../adapters/lapemo/contracts.js'
import type { SupervisoryStructuralFacts } from '../adapters/lapemo/contracts.js'
import { AuthorityEvaluator } from '../authority/evaluator.js'
import type { EvaluationResult } from '../authority/types.js'
import type {
  AgentNode,
  PersonNode,
  RoleNode,
  DecisionEventNode,
  AuthorityGrantNode,
  SystemPermissionNode,
  ActionEventNode,
  AutonomyStateNode,
} from '../domain/nodes/index.js'
import type { RiskLevel } from '../domain/enums/index.js'
import { RISK_LEVELS } from '../domain/enums/index.js'

export interface QueryScope {
  readonly organizationId: string
  readonly ctx: TemporalContext
}

// ── QRY-002 ─────────────────────────────────────────────────────────────────
export interface AccountabilityAnswer {
  readonly actionEventLogicalId: string
  readonly agentLogicalId: string | null
  readonly accountablePersonLogicalId: string | null
  readonly accountablePersonName: string | null
  readonly rolesOccupied: readonly string[]
  readonly supervisorPersonLogicalId: string | null
}

// ── QRY-004 ─────────────────────────────────────────────────────────────────
export interface PermissionExceedanceFinding {
  readonly principalLogicalId: string
  readonly systemPermissionLogicalId: string
  readonly permissionIdentifier: string
  readonly enterpriseSystemLogicalId: string
  readonly exceedanceKind: 'ACTION_NOT_AUTHORIZED' | 'FINANCIAL_LIMIT_ABOVE_AUTHORITY' | 'NO_AUTHORITY_AT_ALL'
  readonly detail: string
}

// ── QRY-005 ─────────────────────────────────────────────────────────────────
export interface LineageGap {
  readonly decisionEventLogicalId: string
  readonly missing: readonly string[]
}

// ── QRY-006 ─────────────────────────────────────────────────────────────────
export interface PostApprovalChange {
  readonly subjectLogicalId: string
  readonly subjectType: string
  readonly changedAt: string
  readonly fromVersionId: string
  readonly toVersionId: string
}

// ── QRY-008 ─────────────────────────────────────────────────────────────────
export interface DecisionTrace {
  readonly decisionEventLogicalId: string
  readonly organizationLogicalId: string
  readonly decisionTypeLogicalId: string
  readonly agentLogicalId: string | null
  readonly accountablePersonLogicalId: string | null
  readonly supervisorPersonLogicalId: string | null
  readonly authorityGrantLogicalId: string | null
  readonly delegationChainLogicalIds: readonly string[]
  readonly invokedSystemLogicalIds: readonly string[]
  readonly systemPermissionLogicalIds: readonly string[]
  readonly informationAssetLogicalIds: readonly string[]
  readonly actionEventLogicalIds: readonly string[]
  readonly outcomeLogicalId: string | null
  readonly humanReviewPerformed: boolean
  readonly evaluation: EvaluationResult
}

export class GraphQueryService {
  private readonly repo: GraphRepository
  private readonly evaluator: AuthorityEvaluator

  constructor(repository: GraphRepository, ceilingProvider: AutonomyCeilingProvider) {
    this.repo = repository
    this.evaluator = new AuthorityEvaluator({ repository, ceilingProvider })
  }

  /** QRY-001. Was this governed agent authorized to make this decision? */
  async wasAuthorized(decisionEventLogicalId: string, scope: QueryScope): Promise<EvaluationResult> {
    return this.evaluator.evaluate({
      organizationId: scope.organizationId,
      decisionEventLogicalId,
      temporalContext: scope.ctx,
    })
  }

  /**
   * QRY-002. Who is accountable?
   * Action Event, back along PERFORMS to the actor, back along ACCOUNTABLE_FOR
   * to the Person, then forward along OCCUPIES to the roles they hold.
   */
  async whoIsAccountable(actionEventLogicalId: string, scope: QueryScope): Promise<AccountabilityAnswer> {
    const { organizationId, ctx } = scope
    const actionEvent = (await this.repo.getNode(actionEventLogicalId, organizationId, ctx)) as ActionEventNode | null

    if (actionEvent === null) {
      return {
        actionEventLogicalId,
        agentLogicalId: null,
        accountablePersonLogicalId: null,
        accountablePersonName: null,
        rolesOccupied: [],
        supervisorPersonLogicalId: null,
      }
    }

    const performsEdges = await this.repo.findEdges({ organizationId, edgeType: 'PERFORMS', toLogicalId: actionEventLogicalId }, ctx)
    const actorLogicalId = performsEdges[0]?.fromLogicalId ?? actionEvent.actor.logicalId

    const ownerEdges = await this.repo.findEdges({ organizationId, edgeType: 'ACCOUNTABLE_FOR', toLogicalId: actorLogicalId }, ctx)
    const ownerLogicalId = ownerEdges[0]?.fromLogicalId ?? null
    const owner = ownerLogicalId === null ? null : ((await this.repo.getNode(ownerLogicalId, organizationId, ctx)) as PersonNode | null)

    const roles: string[] = []
    if (ownerLogicalId !== null) {
      const occupiesEdges = await this.repo.findEdges({ organizationId, edgeType: 'OCCUPIES', fromLogicalId: ownerLogicalId }, ctx)
      for (const edge of occupiesEdges) {
        const role = (await this.repo.getNode(edge.toLogicalId, organizationId, ctx)) as RoleNode | null
        if (role !== null) roles.push(role.name)
      }
    }

    const supervisorEdges = await this.repo.findEdges({ organizationId, edgeType: 'SUPERVISES', toLogicalId: actorLogicalId }, ctx)

    return {
      actionEventLogicalId,
      agentLogicalId: actorLogicalId,
      accountablePersonLogicalId: ownerLogicalId,
      accountablePersonName: owner?.displayName ?? null,
      rolesOccupied: roles,
      supervisorPersonLogicalId: supervisorEdges[0]?.fromLogicalId ?? null,
    }
  }

  /** QRY-003. What authority allowed the decision, and where did it come from? */
  async whatAuthorityAllowed(decisionEventLogicalId: string, scope: QueryScope): Promise<{
    grant: AuthorityGrantNode | null
    chain: readonly AuthorityGrantNode[]
  }> {
    const evaluation = await this.wasAuthorized(decisionEventLogicalId, scope)
    if (evaluation.matchingGrantLogicalId === null) return { grant: null, chain: [] }

    const chain: AuthorityGrantNode[] = []
    for (const link of evaluation.delegationChain) {
      const node = (await this.repo.getNode(link.grantLogicalId, scope.organizationId, scope.ctx)) as AuthorityGrantNode | null
      if (node !== null) chain.push(node)
    }
    return { grant: chain[0] ?? null, chain }
  }

  /** QRY-004. Where does technical permission exceed organizational authority? */
  async wherePermissionExceedsAuthority(scope: QueryScope): Promise<PermissionExceedanceFinding[]> {
    const { organizationId, ctx } = scope
    const permissions = (await this.repo.findNodes({ organizationId, nodeType: 'SystemPermission' }, ctx)) as SystemPermissionNode[]
    const grants = (await this.repo.findNodes({ organizationId, nodeType: 'AuthorityGrant' }, ctx)) as AuthorityGrantNode[]
    const findings: PermissionExceedanceFinding[] = []

    for (const permission of permissions) {
      if (permission.revoked) continue
      const actorGrants = grants.filter((grant) => grant.grantee.logicalId === permission.principal.logicalId)

      if (actorGrants.length === 0) {
        findings.push({
          principalLogicalId: permission.principal.logicalId,
          systemPermissionLogicalId: permission.logicalId,
          permissionIdentifier: permission.permissionIdentifier,
          enterpriseSystemLogicalId: permission.enterpriseSystemLogicalId,
          exceedanceKind: 'NO_AUTHORITY_AT_ALL',
          detail: 'The principal holds a technical permission with no organizational authority of any kind.',
        })
        continue
      }

      const allAllowedActions = new Set(actorGrants.flatMap((grant) => grant.allowedActions))
      const uncovered = permission.permittedActions.filter((action) => !allAllowedActions.has(action))
      if (uncovered.length > 0) {
        findings.push({
          principalLogicalId: permission.principal.logicalId,
          systemPermissionLogicalId: permission.logicalId,
          permissionIdentifier: permission.permissionIdentifier,
          enterpriseSystemLogicalId: permission.enterpriseSystemLogicalId,
          exceedanceKind: 'ACTION_NOT_AUTHORIZED',
          detail: `The technology permits actions no authority covers: ${uncovered.join(', ')}.`,
        })
      }

      if (permission.financialLimit !== null) {
        const permissionLimit = permission.financialLimit
        const comparable = actorGrants
          .map((grant) => grant.financialLimit)
          .filter((limit): limit is NonNullable<typeof limit> => limit !== null && limit.currency === permissionLimit.currency)
        if (comparable.length > 0) {
          const highestAuthority = Math.max(...comparable.map((limit) => limit.amount))
          if (permissionLimit.amount > highestAuthority) {
            findings.push({
              principalLogicalId: permission.principal.logicalId,
              systemPermissionLogicalId: permission.logicalId,
              permissionIdentifier: permission.permissionIdentifier,
              enterpriseSystemLogicalId: permission.enterpriseSystemLogicalId,
              exceedanceKind: 'FINANCIAL_LIMIT_ABOVE_AUTHORITY',
              detail: `The technology permits up to ${permissionLimit.currency} ${permissionLimit.amount} while the highest organizational authority stops at ${permissionLimit.currency} ${highestAuthority}.`,
            })
          }
        }
      }
    }

    return findings
  }

  /** QRY-005. Which decisions lack complete lineage? */
  async decisionsLackingLineage(scope: QueryScope): Promise<LineageGap[]> {
    const { organizationId, ctx } = scope
    const events = (await this.repo.findNodes({ organizationId, nodeType: 'DecisionEvent' }, ctx)) as DecisionEventNode[]
    const gaps: LineageGap[] = []

    for (const event of events) {
      const missing: string[] = []
      const evaluation = await this.wasAuthorized(event.logicalId, scope)

      if (evaluation.accountablePersonLogicalId === null) missing.push('accountable owner')
      if (evaluation.supervisorPersonLogicalId === null) missing.push('supervisor')
      if (evaluation.matchingGrantLogicalId === null) missing.push('authority grant')
      if (evaluation.applicablePolicyLogicalIds.length === 0) missing.push('governing policy')
      if (evaluation.informationAssetLogicalIds.length === 0) missing.push('information')
      // A decision can cite information and still lack the information its
      // decision type actually requires. Those are different gaps.
      if (evaluation.evidenceCompleteness.completenessRatio < 1) missing.push('required information')
      if (!event.humanReview.performed) missing.push('human review')
      if (event.actualOutcomeLogicalId === null) missing.push('outcome')

      const actions = await this.repo.findEdges({ organizationId, edgeType: 'RESULTS_IN', fromLogicalId: event.logicalId }, ctx)
      if (actions.length === 0) missing.push('action record')

      if (missing.length > 0) gaps.push({ decisionEventLogicalId: event.logicalId, missing })
    }

    return gaps
  }

  /**
   * QRY-006. What changed after approval?
   *
   * Reads supersede lineage: any subject whose version advanced after the
   * reference instant changed after the decision was approved.
   */
  async whatChangedAfter(
    referenceInstant: string,
    subjectLogicalIds: readonly string[],
    organizationId: string,
  ): Promise<PostApprovalChange[]> {
    const changes: PostApprovalChange[] = []

    for (const logicalId of subjectLogicalIds) {
      const history = await this.repo.getNodeHistory(logicalId, organizationId)
      for (const version of history) {
        if (version.supersedesVersionId === null) continue
        if (Date.parse(version.recordedFrom) <= Date.parse(referenceInstant)) continue
        changes.push({
          subjectLogicalId: logicalId,
          subjectType: version.nodeType,
          changedAt: version.recordedFrom,
          fromVersionId: version.supersedesVersionId,
          toVersionId: version.versionId,
        })
      }
    }

    return changes.sort((a, b) => Date.parse(a.changedAt) - Date.parse(b.changedAt))
  }

  /**
   * QRY-007. Supervisory Control Capacity concentration.
   *
   * Structural facts ONLY. This deliberately returns no capacity, no
   * utilization, and no score. Oversight is finite, and measuring how finite is
   * the platform formula layer's job, not this package's.
   */
  async supervisoryConcentration(
    supervisorPersonLogicalId: string,
    scope: QueryScope,
  ): Promise<SupervisoryStructuralFacts> {
    const { organizationId, ctx } = scope

    const supervisesEdges = await this.repo.findEdges({ organizationId, edgeType: 'SUPERVISES', fromLogicalId: supervisorPersonLogicalId }, ctx)
    const accountableEdges = await this.repo.findEdges({ organizationId, edgeType: 'ACCOUNTABLE_FOR', fromLogicalId: supervisorPersonLogicalId }, ctx)

    const agentsByRiskLevel = Object.fromEntries(RISK_LEVELS.map((level) => [level, 0])) as Record<RiskLevel, number>
    let activeAgentsSupervised = 0

    for (const edge of supervisesEdges) {
      const agent = (await this.repo.getNode(edge.toLogicalId, organizationId, ctx)) as AgentNode | null
      if (agent === null || agent.nodeType !== 'Agent') continue
      if (agent.lifecycleState !== 'ACTIVE') continue
      activeAgentsSupervised += 1
      agentsByRiskLevel[agent.riskLevel] += 1
    }

    const supervisedAgentIds = new Set(supervisesEdges.map((edge) => edge.toLogicalId))
    const events = (await this.repo.findNodes({ organizationId, nodeType: 'DecisionEvent' }, ctx)) as DecisionEventNode[]
    const decisionEventCount = events.filter((event) => supervisedAgentIds.has(event.finalActor.logicalId)).length
    const unreviewedOutcomeCount = events.filter(
      (event) => supervisedAgentIds.has(event.finalActor.logicalId) && !event.humanReview.performed,
    ).length

    const exceptions = await this.repo.findNodes({ organizationId, nodeType: 'Exception' }, ctx)

    return {
      supervisorPersonLogicalId,
      activeAgentsSupervised,
      activeAgentsAccountableFor: accountableEdges.length,
      agentsByRiskLevel,
      decisionEventCount,
      openExceptionCount: exceptions.length,
      unreviewedOutcomeCount,
    }
  }

  /** QRY-008. Trace a decision end to end. */
  async traceDecision(decisionEventLogicalId: string, scope: QueryScope): Promise<DecisionTrace | null> {
    const { organizationId, ctx } = scope
    const event = (await this.repo.getNode(decisionEventLogicalId, organizationId, ctx)) as DecisionEventNode | null
    if (event === null) return null

    const evaluation = await this.wasAuthorized(decisionEventLogicalId, scope)

    const actionEdges = await this.repo.findEdges({ organizationId, edgeType: 'RESULTS_IN', fromLogicalId: decisionEventLogicalId }, ctx)

    return {
      decisionEventLogicalId,
      organizationLogicalId: organizationId,
      decisionTypeLogicalId: event.decisionTypeLogicalId,
      agentLogicalId: evaluation.evaluatedAgentLogicalId,
      accountablePersonLogicalId: evaluation.accountablePersonLogicalId,
      supervisorPersonLogicalId: evaluation.supervisorPersonLogicalId,
      authorityGrantLogicalId: evaluation.matchingGrantLogicalId,
      delegationChainLogicalIds: evaluation.delegationChain.map((link) => link.grantLogicalId),
      invokedSystemLogicalIds: evaluation.invokedSystemLogicalIds,
      systemPermissionLogicalIds: evaluation.systemPermissionLogicalIds,
      informationAssetLogicalIds: evaluation.informationAssetLogicalIds,
      actionEventLogicalIds: actionEdges.map((edge) => edge.toLogicalId),
      outcomeLogicalId: event.actualOutcomeLogicalId,
      humanReviewPerformed: event.humanReview.performed,
      evaluation,
    }
  }

  /** Effective autonomy state for a governed agent, used by the context contracts. */
  async effectiveAutonomy(
    agentLogicalId: string,
    decisionTypeLogicalId: string | null,
    scope: QueryScope,
  ): Promise<AutonomyStateNode | null> {
    const states = (await this.repo.findNodes({ organizationId: scope.organizationId, nodeType: 'AutonomyState' }, scope.ctx)) as AutonomyStateNode[]
    return (
      states.find((state) => state.agentLogicalId === agentLogicalId && state.decisionTypeLogicalId === decisionTypeLogicalId) ??
      states.find((state) => state.agentLogicalId === agentLogicalId && state.decisionTypeLogicalId === null) ??
      null
    )
  }
}
