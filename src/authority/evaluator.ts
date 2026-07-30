/**
 * The authority evaluator.
 *
 * Resolution is asynchronous and touches the repository. Rules are synchronous
 * and pure. Keeping those halves apart is what makes the result deterministic:
 * given the same resolved facts, the same reasons fire and the same status comes
 * out, every time, in any order.
 *
 * Nothing here hardcodes an outcome. The demonstration scenario reaches
 * NOT_AUTHORIZED because seeded data, traversal, temporal checks and these rules
 * say so.
 */

import type { GraphRepository } from '../graph/repository.js'
import type { AutonomyCeilingProvider, AutonomyCeiling } from '../adapters/lapemo/contracts.js'
import type { TemporalContext } from '../graph/temporal.js'
import { temporalContext } from '../graph/temporal.js'
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
  EvidenceObjectNode,
} from '../domain/nodes/index.js'
import type { GraphEdge } from '../domain/edges/index.js'
import { assessEvidenceCompleteness } from '../evidence/completeness.js'
import { propagateConfidence, applySourcePenalty } from '../evidence/provenance.js'
import { ALL_RULES, dataIntegrityRule, reviewRequirements } from './rules.js'
import { resolvePrimaryStatus } from './precedence.js'
import { isWarning } from './status.js'
import type { FiredReason, RequiredAction } from './status.js'
import type {
  EvaluationRequest,
  EvaluationResult,
  ResolvedContext,
  DelegationLink,
  AuthorityLineage,
} from './types.js'
import { ONTOLOGY_VERSION, RULE_SET_VERSION, SCHEMA_VERSION } from '../version.js'

export interface EvaluatorDependencies {
  readonly repository: GraphRepository
  readonly ceilingProvider: AutonomyCeilingProvider
}

/** Maximum delegation depth walked before the chain is treated as pathological. */
const MAX_DELEGATION_DEPTH = 32

/** Fallback evaluation instant when nothing else supplies one. */
const EPOCH = '1970-01-01T00:00:00.000Z'

export class AuthorityEvaluator {
  private readonly repo: GraphRepository
  private readonly ceilingProvider: AutonomyCeilingProvider

  constructor(deps: EvaluatorDependencies) {
    this.repo = deps.repository
    this.ceilingProvider = deps.ceilingProvider
  }

  async evaluate(request: EvaluationRequest): Promise<EvaluationResult> {
    const ctx = await this.resolve(request)

    // Data integrity first. If evaluation is impossible we say so, and never
    // dress it up as a negative business result.
    const integrity = dataIntegrityRule(ctx)
    const reasons: FiredReason[] =
      integrity.some((r) => r.statusImpact === 'INDETERMINATE')
        ? integrity
        : [...integrity, ...ALL_RULES.flatMap((rule) => rule(ctx))]

    const violations = reasons.filter((r) => !isWarning(r))
    const warnings = reasons.filter(isWarning)
    const status = resolvePrimaryStatus(reasons)

    return {
      status,
      violations,
      warnings,
      requiredActions: buildRequiredActions(violations),

      evaluatedAgentLogicalId: ctx.agent?.logicalId ?? null,
      decisionEventLogicalId: request.decisionEventLogicalId,
      accountablePersonLogicalId: ctx.accountableOwners.find((p) => p.isActive)?.logicalId ?? null,
      supervisorPersonLogicalId: ctx.supervisors.find((p) => p.isActive)?.logicalId ?? null,
      matchingGrantLogicalId: ctx.matchingGrant?.logicalId ?? null,
      delegationChain: toLineage(ctx.delegationChain),

      applicablePolicyLogicalIds: ctx.applicablePolicies.map((p) => p.logicalId),
      applicableControlLogicalIds: ctx.applicableControls.map((c) => c.logicalId),
      informationAssetLogicalIds: ctx.informationAssetsUsed.map((a) => a.logicalId),
      invokedSystemLogicalIds: [...ctx.invokedSystemLogicalIds],
      systemPermissionLogicalIds: ctx.systemPermissions.map((p) => p.logicalId),

      evidenceCompleteness: ctx.evidenceCompleteness,
      reviewRequirements: reviewRequirements(ctx),

      confidence: propagateConfidence(ctx.confidenceInputs),
      correlationId: request.correlationId ?? ctx.decisionEvent?.correlationId ?? request.decisionEventLogicalId,
      evaluatedAt: ctx.evaluationInstant,
      temporalContext: ctx.temporal,

      ontologyVersion: ONTOLOGY_VERSION,
      ruleSetVersion: RULE_SET_VERSION,
      schemaVersion: SCHEMA_VERSION,
    }
  }

  /** Gather every fact the rules need. The only place I/O happens. */
  private async resolve(request: EvaluationRequest): Promise<ResolvedContext> {
    const org = request.organizationId

    // Bootstrap: read the event regardless of valid time so we can learn its own
    // decision instant, then evaluate at that instant unless the caller pinned one.
    const bootstrapEvent = await this.findDecisionEventAnyTime(request.decisionEventLogicalId, org)

    const temporal = request.temporalContext ?? temporalContext(bootstrapEvent?.decidedAt ?? EPOCH)
    const evaluationInstant = temporal.validAt

    const decisionEvent = await this.findDecisionEvent(request.decisionEventLogicalId, org, temporal)
    const confidenceInputs: number[] = []
    const traversedEdges: GraphEdge[] = []

    if (decisionEvent === null) {
      return emptyContext(org, temporal, evaluationInstant)
    }
    confidenceInputs.push(applySourcePenalty(decisionEvent.confidence, decisionEvent.sourceRef))

    const decisionType = (await this.repo.getNode(decisionEvent.decisionTypeLogicalId, org, temporal)) as DecisionTypeNode | null
    if (decisionType !== null) confidenceInputs.push(applySourcePenalty(decisionType.confidence, decisionType.sourceRef))

    // The deciding actor may be a governed agent or a person.
    const finalActorNode = await this.repo.getNode(decisionEvent.finalActor.logicalId, org, temporal)
    const agent = finalActorNode?.nodeType === 'Agent' ? (finalActorNode as AgentNode) : null
    const decidingPerson = finalActorNode?.nodeType === 'Person' ? (finalActorNode as PersonNode) : null
    if (agent !== null) confidenceInputs.push(applySourcePenalty(agent.confidence, agent.sourceRef))

    // Accountability and supervision arrive as edges, because the relationship
    // is owned elsewhere and projected here.
    const accountableOwners: PersonNode[] = []
    const supervisors: PersonNode[] = []
    if (agent !== null) {
      const ownerEdges = await this.repo.findEdges({ organizationId: org, edgeType: 'ACCOUNTABLE_FOR', toLogicalId: agent.logicalId }, temporal)
      traversedEdges.push(...ownerEdges)
      for (const edge of ownerEdges) {
        const person = await this.repo.getNode(edge.fromLogicalId, org, temporal)
        if (person?.nodeType === 'Person') {
          accountableOwners.push(person as PersonNode)
          confidenceInputs.push(edge.confidence)
        }
      }
      const supervisorEdges = await this.repo.findEdges({ organizationId: org, edgeType: 'SUPERVISES', toLogicalId: agent.logicalId }, temporal)
      traversedEdges.push(...supervisorEdges)
      for (const edge of supervisorEdges) {
        const person = await this.repo.getNode(edge.fromLogicalId, org, temporal)
        if (person?.nodeType === 'Person') {
          supervisors.push(person as PersonNode)
          confidenceInputs.push(edge.confidence)
        }
      }
    }

    const accountablePersonForOutcome =
      decisionEvent.accountablePersonLogicalId === null
        ? null
        : ((await this.repo.getNode(decisionEvent.accountablePersonLogicalId, org, temporal)) as PersonNode | null)

    // Authority grants: candidates are every grant naming this actor and this
    // decision type at ANY time, so that an expired grant is reported as expired
    // rather than as absent. The matching grant must be effective now.
    const actorLogicalId = decisionEvent.finalActor.logicalId
    const allGrants = (await this.repo.findAllVersions({ organizationId: org, nodeType: 'AuthorityGrant' })) as AuthorityGrantNode[]
    const candidateGrants = allGrants.filter(
      (grant) => grant.grantee.logicalId === actorLogicalId && grant.decisionTypeLogicalId === decisionEvent.decisionTypeLogicalId,
    )
    const effectiveGrants = (await this.repo.findNodes({ organizationId: org, nodeType: 'AuthorityGrant' }, temporal)) as AuthorityGrantNode[]
    const matchingGrant =
      effectiveGrants.find(
        (grant) =>
          grant.grantee.logicalId === actorLogicalId &&
          grant.decisionTypeLogicalId === decisionEvent.decisionTypeLogicalId &&
          !isRevokedBy(grant, evaluationInstant),
      ) ?? null
    if (matchingGrant !== null) confidenceInputs.push(applySourcePenalty(matchingGrant.confidence, matchingGrant.sourceRef))

    const { chain, terminates, cycleDetected } = await this.walkDelegation(matchingGrant, org, temporal)

    // Autonomy: the effective state, plus a ceiling supplied by the provider.
    // The ceiling is consumed, never derived here.
    const autonomyStates = (await this.repo.findNodes({ organizationId: org, nodeType: 'AutonomyState' }, temporal)) as AutonomyStateNode[]
    const autonomyState =
      agent === null
        ? null
        : (autonomyStates.find(
            (state) => state.agentLogicalId === agent.logicalId && state.decisionTypeLogicalId === decisionEvent.decisionTypeLogicalId,
          ) ??
          autonomyStates.find((state) => state.agentLogicalId === agent.logicalId && state.decisionTypeLogicalId === null) ??
          null)

    let gateClearanceEvidencePresent = false
    if (autonomyState?.gateClearanceEvidenceRef != null) {
      const evidence = (await this.repo.getNode(autonomyState.gateClearanceEvidenceRef, org, temporal)) as EvidenceObjectNode | null
      gateClearanceEvidencePresent = evidence !== null && evidence.integrityState !== 'FAILED'
    }

    const autonomyCeiling: AutonomyCeiling =
      agent === null
        ? { kind: 'LEVEL', level: 'HUMAN_ONLY' }
        : await this.ceilingProvider.resolveCeiling({
            organizationId: org,
            agentLogicalId: agent.logicalId,
            decisionTypeLogicalId: decisionEvent.decisionTypeLogicalId,
            ctx: temporal,
          })

    // Systems invoked and the technical permissions that touch them.
    const invokedSystemLogicalIds = decisionEvent.targetSystemLogicalIds
    const invokedSystems: EnterpriseSystemNode[] = []
    for (const systemId of invokedSystemLogicalIds) {
      const system = await this.repo.getNode(systemId, org, temporal)
      if (system?.nodeType === 'EnterpriseSystem') invokedSystems.push(system as EnterpriseSystemNode)
    }
    const allPermissions = (await this.repo.findNodes({ organizationId: org, nodeType: 'SystemPermission' }, temporal)) as SystemPermissionNode[]
    const systemPermissions = allPermissions.filter((permission) => permission.principal.logicalId === actorLogicalId)

    // Information assets the decision actually used.
    const usesEdges = await this.repo.findEdges({ organizationId: org, edgeType: 'USES', fromLogicalId: decisionEvent.logicalId }, temporal)
    traversedEdges.push(...usesEdges)
    const informationAssetsUsed: InformationAssetNode[] = []
    for (const edge of usesEdges) {
      const asset = await this.repo.getNode(edge.toLogicalId, org, temporal)
      if (asset?.nodeType === 'InformationAsset') {
        informationAssetsUsed.push(asset as InformationAssetNode)
        confidenceInputs.push(edge.confidence)
      }
    }

    const evidenceCompleteness = assessEvidenceCompleteness(
      decisionType?.requiredInformationClasses ?? [],
      informationAssetsUsed,
      evaluationInstant,
      matchingGrant?.dataClassificationLimit ?? null,
    )

    // Governance context.
    const allPolicies = (await this.repo.findNodes({ organizationId: org, nodeType: 'Policy' }, temporal)) as PolicyNode[]
    const applicablePolicies = allPolicies.filter((policy) =>
      policy.appliesToDecisionTypeLogicalIds.includes(decisionEvent.decisionTypeLogicalId),
    )
    const allControls = (await this.repo.findNodes({ organizationId: org, nodeType: 'Control' }, temporal)) as ControlNode[]
    const applicableControls = allControls.filter((control) =>
      control.appliesToDecisionTypeLogicalIds.includes(decisionEvent.decisionTypeLogicalId),
    )
    const allExceptions = (await this.repo.findNodes({ organizationId: org, nodeType: 'Exception' }, temporal)) as ExceptionNode[]
    const applicableExceptions = allExceptions.filter((exception) =>
      exception.appliesToDecisionTypeLogicalIds.includes(decisionEvent.decisionTypeLogicalId),
    )

    const reviewer =
      decisionEvent.humanReview.reviewerPersonLogicalId === null
        ? null
        : ((await this.repo.getNode(decisionEvent.humanReview.reviewerPersonLogicalId, org, temporal)) as PersonNode | null)

    const outcome =
      decisionEvent.actualOutcomeLogicalId === null
        ? null
        : ((await this.repo.getNode(decisionEvent.actualOutcomeLogicalId, org, temporal)) as OutcomeNode | null)

    return {
      organizationId: org,
      temporal,
      evaluationInstant,
      decisionEvent,
      decisionType,
      agent,
      decidingPerson,
      accountableOwners,
      supervisors,
      accountablePersonForOutcome,
      candidateGrants,
      matchingGrant,
      delegationChain: chain,
      delegationTerminates: terminates,
      delegationCycleDetected: cycleDetected,
      autonomyState,
      autonomyCeiling,
      gateClearanceEvidencePresent,
      systemPermissions,
      invokedSystems,
      invokedSystemLogicalIds,
      informationAssetsUsed,
      evidenceCompleteness,
      applicablePolicies,
      applicableControls,
      applicableExceptions,
      reviewer,
      outcome,
      confidenceInputs,
      traversedEdges,
    }
  }

  private async findDecisionEvent(
    logicalId: string,
    organizationId: string,
    ctx: TemporalContext,
  ): Promise<DecisionEventNode | null> {
    const node = await this.repo.getNode(logicalId, organizationId, ctx)
    if (node === null || node.nodeType !== 'DecisionEvent') return null
    return node as DecisionEventNode
  }

  /** Read the event ignoring valid time, so its own decision instant can bootstrap the context. */
  private async findDecisionEventAnyTime(
    logicalId: string,
    organizationId: string,
  ): Promise<DecisionEventNode | null> {
    const node = await this.repo.getLatestVersion(logicalId, organizationId)
    if (node === null || node.nodeType !== 'DecisionEvent') return null
    return node as DecisionEventNode
  }

  /**
   * Walk the delegation chain from a grant toward its organizational source.
   * Cycle-safe and depth-bounded, because a malformed chain must produce a
   * finding rather than an infinite loop.
   */
  private async walkDelegation(
    start: AuthorityGrantNode | null,
    organizationId: string,
    ctx: TemporalContext,
  ): Promise<{ chain: DelegationLink[]; terminates: boolean; cycleDetected: boolean }> {
    if (start === null) return { chain: [], terminates: false, cycleDetected: false }

    const chain: DelegationLink[] = []
    const seen = new Set<string>()
    let current: AuthorityGrantNode | null = start
    let depth = 0

    while (current !== null && depth < MAX_DELEGATION_DEPTH) {
      if (seen.has(current.logicalId)) {
        return { chain, terminates: false, cycleDetected: true }
      }
      seen.add(current.logicalId)
      chain.push({ grant: current, depth })

      if (current.organizationalSource !== null) {
        return { chain, terminates: true, cycleDetected: false }
      }
      if (current.derivedFromGrantLogicalId === null) {
        return { chain, terminates: false, cycleDetected: false }
      }

      const parent = await this.repo.getNode(current.derivedFromGrantLogicalId, organizationId, ctx)
      current = parent?.nodeType === 'AuthorityGrant' ? (parent as AuthorityGrantNode) : null
      depth += 1
    }

    return { chain, terminates: false, cycleDetected: depth >= MAX_DELEGATION_DEPTH }
  }
}

function isRevokedBy(grant: AuthorityGrantNode, instant: string): boolean {
  return grant.revocation !== null && Date.parse(grant.revocation.revokedAt) <= Date.parse(instant)
}

function toLineage(chain: readonly DelegationLink[]): AuthorityLineage[] {
  return chain.map((link) => ({
    grantLogicalId: link.grant.logicalId,
    grantType: link.grant.grantType,
    grantorActorType: link.grant.grantor.actorType,
    grantorLogicalId: link.grant.grantor.logicalId,
    depth: link.depth,
    organizationalSource: link.grant.organizationalSource,
  }))
}

function buildRequiredActions(violations: readonly FiredReason[]): RequiredAction[] {
  return violations.map((reason) => ({
    forCode: reason.code,
    description: reason.clearingPredicate,
    clearingPredicateId: reason.clearingPredicateId,
  }))
}

function emptyContext(organizationId: string, temporal: TemporalContext, evaluationInstant: string): ResolvedContext {
  return {
    organizationId,
    temporal,
    evaluationInstant,
    decisionEvent: null,
    decisionType: null,
    agent: null,
    decidingPerson: null,
    accountableOwners: [],
    supervisors: [],
    accountablePersonForOutcome: null,
    candidateGrants: [],
    matchingGrant: null,
    delegationChain: [],
    delegationTerminates: false,
    delegationCycleDetected: false,
    autonomyState: null,
    autonomyCeiling: { kind: 'LEVEL', level: 'HUMAN_ONLY' },
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
  }
}
