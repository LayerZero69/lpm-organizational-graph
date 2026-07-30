/**
 * The twelve authority rules, as pure deterministic functions.
 *
 * No rule performs I/O, reads a clock, or depends on the order the others ran
 * in. Each takes a fully resolved context and returns the reasons it fired.
 * That is what makes every rule independently testable and the whole evaluation
 * reproducible.
 */

import { reasonCode } from './reason-codes.js'
import type { FiredReason } from './status.js'
import type { AuthorityRule, ResolvedContext, ReviewRequirementSource } from './types.js'
import {
  autonomyOrdinal,
  requiresEarnedEvidence,
  riskOrdinal,
  dataClassificationOrdinal,
  AUTONOMY_BASELINE,
} from '../domain/enums/index.js'
import { autonomyName } from '../canon/index.js'

/** Build a fired reason from the registry definition plus this evaluation's detail. */
function fire(
  code: string,
  detail: string,
  subjects: readonly string[] = [],
  evidenceRefs: readonly string[] = [],
): FiredReason {
  const definition = reasonCode(code)
  return {
    code: definition.code,
    ruleId: definition.ruleId,
    category: definition.category,
    statusImpact: definition.statusImpact,
    clearingPredicateId: definition.clearingPredicateId,
    clearingPredicate: definition.clearingPredicate,
    lapemoConditionKey: definition.lapemoConditionKey,
    detail,
    subjects,
    evidenceRefs,
  }
}

/** Evaluation is impossible unless these resolve. Checked before every other rule. */
export const dataIntegrityRule: AuthorityRule = (ctx) => {
  const fired: FiredReason[] = []
  if (ctx.decisionEvent === null) {
    fired.push(fire('DECISION_EVENT_NOT_FOUND', 'No decision event effective at the evaluation instant resolves for the requested logical id.'))
    return fired
  }
  if (ctx.decisionType === null) {
    fired.push(fire('DECISION_TYPE_NOT_RESOLVABLE', `Decision type ${ctx.decisionEvent.decisionTypeLogicalId} does not resolve.`, [ctx.decisionEvent.decisionTypeLogicalId]))
  }
  if (ctx.agent === null && ctx.decidingPerson === null) {
    fired.push(fire('DECIDING_ACTOR_NOT_RESOLVABLE', `Final actor ${ctx.decisionEvent.finalActor.logicalId} does not resolve to an effective Agent or Person.`, [ctx.decisionEvent.finalActor.logicalId]))
  }
  if (ctx.decisionEvent.organizationId !== ctx.organizationId) {
    fired.push(fire('ORGANIZATION_SCOPE_MISSING', 'The decision event sits outside the requested organization scope. There is no cross-organization traversal.', [ctx.decisionEvent.logicalId]))
  }
  return fired
}

/** AUTH-001. Exactly one active accountable human owner, resolving to a Person. */
export const auth001AccountableOwner: AuthorityRule = (ctx) => {
  if (ctx.agent === null) return []
  const active = ctx.accountableOwners.filter((p) => p.isActive)
  if (active.length === 0) {
    return [fire('UNOWNED_AGENT', `Governed agent ${ctx.agent.name} has no active accountable owner effective at the evaluation instant.`, [ctx.agent.logicalId])]
  }
  if (active.length > 1) {
    return [fire('AMBIGUOUS_AGENT_OWNERSHIP', `Governed agent ${ctx.agent.name} has ${active.length} competing active accountable owners. Joint accountability is rejected.`, active.map((p) => p.logicalId))]
  }
  return []
}

/** AUTH-002. Exactly one active named human supervisor. */
export const auth002Supervisor: AuthorityRule = (ctx) => {
  if (ctx.agent === null) return []
  const active = ctx.supervisors.filter((p) => p.isActive)
  if (active.length !== 1) {
    const detail =
      active.length === 0
        ? `Governed agent ${ctx.agent.name} has no active named supervisor effective at the evaluation instant.`
        : `Governed agent ${ctx.agent.name} has ${active.length} active supervisors. Supervision terminates at exactly one Person.`
    return [fire('UNSUPERVISED_AGENT', detail, [ctx.agent.logicalId])]
  }
  return []
}

/** AUTH-003. A matching grant covering the exact decision type, action and limits. */
export const auth003MatchingAuthority: AuthorityRule = (ctx) => {
  const { decisionEvent, matchingGrant } = ctx
  if (decisionEvent === null) return []

  if (matchingGrant === null) {
    return [fire('NO_MATCHING_AUTHORITY', `No authority grant effective at the evaluation instant covers decision type ${decisionEvent.decisionTypeLogicalId} for this actor.`, [decisionEvent.logicalId])]
  }

  const fired: FiredReason[] = []
  const subjects = [matchingGrant.logicalId, decisionEvent.logicalId]

  const action = decisionEvent.requestedAction
  if (matchingGrant.prohibitedActions.includes(action) || !matchingGrant.allowedActions.includes(action)) {
    fired.push(fire('ACTION_OUTSIDE_AUTHORITY', `Action ${action} is not within the allowed actions of grant ${matchingGrant.logicalId}.`, subjects))
  }

  const limit = matchingGrant.financialLimit
  const amount = decisionEvent.financialAmount
  if (limit !== null && amount !== null) {
    if (limit.currency !== amount.currency) {
      fired.push(fire('FINANCIAL_LIMIT_EXCEEDED', `The decision is denominated in ${amount.currency} but the grant limit is in ${limit.currency}. A currency mismatch is reported rather than converted.`, subjects))
    } else if (amount.amount > limit.amount) {
      fired.push(fire('FINANCIAL_LIMIT_EXCEEDED', `The decision commits ${formatMoney(amount.amount, amount.currency)} against an authority limit of ${formatMoney(limit.amount, limit.currency)}.`, subjects))
    }
  }

  if (matchingGrant.riskLimit !== null && riskOrdinal(decisionEvent.riskLevel) > riskOrdinal(matchingGrant.riskLimit)) {
    fired.push(fire('RISK_LIMIT_EXCEEDED', `The decision carries risk level ${decisionEvent.riskLevel} against an authority risk limit of ${matchingGrant.riskLimit}.`, subjects))
  }

  if (
    matchingGrant.dataClassificationLimit !== null &&
    decisionEvent.dataClassification !== null &&
    dataClassificationOrdinal(decisionEvent.dataClassification) > dataClassificationOrdinal(matchingGrant.dataClassificationLimit)
  ) {
    fired.push(fire('DATA_CLASSIFICATION_LIMIT_EXCEEDED', `The decision handles ${decisionEvent.dataClassification} data against an authority limit of ${matchingGrant.dataClassificationLimit}.`, subjects))
  }

  if (matchingGrant.systemScope !== null) {
    const scope = matchingGrant.systemScope
    const outside = ctx.invokedSystemLogicalIds.filter((id) => !scope.includes(id))
    if (outside.length > 0) {
      fired.push(fire('SYSTEM_SCOPE_EXCEEDED', `The decision invokes systems outside the authority system scope: ${outside.join(', ')}.`, subjects))
    }
  }

  if (matchingGrant.geographicScope !== null && decisionEvent.geography !== null) {
    if (!matchingGrant.geographicScope.includes(decisionEvent.geography)) {
      fired.push(fire('GEOGRAPHIC_SCOPE_EXCEEDED', `The decision is scoped to ${decisionEvent.geography}, outside the authority geographic scope.`, subjects))
    }
  }

  return fired
}

/**
 * AUTH-004. The grant must be effective at both the decision and action instants.
 *
 * Evaluated against the candidate grants rather than the matching grant, because
 * an expired grant is a different and more useful finding than no grant at all.
 */
export const auth004EffectiveAuthority: AuthorityRule = (ctx) => {
  const { decisionEvent } = ctx
  if (decisionEvent === null) return []
  if (ctx.matchingGrant !== null) return []
  if (ctx.candidateGrants.length === 0) return []

  const fired: FiredReason[] = []
  const instants = [decisionEvent.decidedAt, decisionEvent.executedAt].filter((t): t is string => t !== null)

  for (const grant of ctx.candidateGrants) {
    const subjects = [grant.logicalId]
    if (grant.revocation !== null && Date.parse(grant.revocation.revokedAt) <= Date.parse(ctx.evaluationInstant)) {
      fired.push(fire('AUTHORITY_REVOKED', `Grant ${grant.logicalId} was revoked at ${grant.revocation.revokedAt}. Reason: ${grant.revocation.reason}.`, subjects))
      continue
    }
    if (instants.some((instant) => Date.parse(grant.effectiveFrom) > Date.parse(instant))) {
      fired.push(fire('AUTHORITY_NOT_YET_EFFECTIVE', `Grant ${grant.logicalId} becomes effective at ${grant.effectiveFrom}, after the decision.`, subjects))
      continue
    }
    if (grant.effectiveTo !== null && instants.some((instant) => Date.parse(grant.effectiveTo as string) <= Date.parse(instant))) {
      fired.push(fire('AUTHORITY_EXPIRED', `Grant ${grant.logicalId} expired at ${grant.effectiveTo}, at or before the decision.`, subjects))
    }
  }

  return fired
}

/**
 * AUTH-005. Technical permission must stay inside organizational authority.
 *
 * A permission that allows MORE than the organization authorized is the finding.
 * The permission itself is never treated as authority.
 */
export const auth005PermissionAlignment: AuthorityRule = (ctx) => {
  const { matchingGrant } = ctx
  const fired: FiredReason[] = []

  const relevant = ctx.systemPermissions.filter(
    (permission) => !permission.revoked && ctx.invokedSystemLogicalIds.includes(permission.enterpriseSystemLogicalId),
  )
  if (relevant.length === 0) return fired

  for (const permission of relevant) {
    const subjects = [permission.logicalId]

    if (matchingGrant === null) {
      fired.push(fire('PERMISSION_AUTHORITY_MISMATCH', `Technical permission ${permission.permissionIdentifier} exists on an invoked system while no organizational authority covers the decision at all.`, subjects))
      continue
    }

    const uncovered = permission.permittedActions.filter((action) => !matchingGrant.allowedActions.includes(action))
    if (uncovered.length > 0) {
      fired.push(fire('PERMISSION_AUTHORITY_MISMATCH', `Technical permission ${permission.permissionIdentifier} permits actions no authority grant covers: ${uncovered.join(', ')}.`, [...subjects, matchingGrant.logicalId]))
      continue
    }

    const permissionLimit = permission.financialLimit
    const authorityLimit = matchingGrant.financialLimit
    if (permissionLimit !== null && authorityLimit !== null) {
      if (permissionLimit.currency !== authorityLimit.currency) {
        fired.push(fire('PERMISSION_AUTHORITY_MISMATCH', `Technical permission ${permission.permissionIdentifier} is limited in ${permissionLimit.currency} while authority is limited in ${authorityLimit.currency}. The two cannot be compared safely.`, [...subjects, matchingGrant.logicalId]))
      } else if (permissionLimit.amount > authorityLimit.amount) {
        fired.push(fire('PERMISSION_AUTHORITY_MISMATCH', `Technical permission ${permission.permissionIdentifier} permits up to ${formatMoney(permissionLimit.amount, permissionLimit.currency)} while organizational authority stops at ${formatMoney(authorityLimit.amount, authorityLimit.currency)}. The technology allows more than the organization authorized.`, [...subjects, matchingGrant.logicalId]))
      }
    } else if (permissionLimit !== null && authorityLimit === null) {
      // Authority imposes no financial boundary, so a bounded permission cannot exceed it.
      continue
    }
  }

  return fired
}

/** Warning companion to AUTH-005: a stale permission may not reflect reality. */
export const permissionFreshnessWarning: AuthorityRule = (ctx) => {
  const stale = ctx.systemPermissions.filter(
    (p) => ctx.invokedSystemLogicalIds.includes(p.enterpriseSystemLogicalId) && p.stalenessState !== 'FRESH',
  )
  if (stale.length === 0) return []
  return [fire('STALE_SYSTEM_PERMISSION', `Technical permissions were last synchronized outside the freshness policy: ${stale.map((p) => p.permissionIdentifier).join(', ')}.`, stale.map((p) => p.logicalId))]
}

/** AUTH-006. Effective autonomy may not exceed the derived ceiling. */
export const auth006AutonomyCeiling: AuthorityRule = (ctx) => {
  if (ctx.agent === null) return []
  const ceiling = ctx.autonomyCeiling

  if (ceiling.kind === 'BLOCKED') {
    return [fire('AUTONOMY_CEILING_BLOCKED', `No autonomy level is permitted for this decision context. Unsatisfied prerequisite: ${ceiling.blockingPrerequisite}.`, [ctx.agent.logicalId])]
  }
  if (ctx.autonomyState === null) return []

  const current = ctx.autonomyState.level
  if (autonomyOrdinal(current) > autonomyOrdinal(ceiling.level)) {
    return [fire('AUTONOMY_EXCEEDS_DECISION_LIMIT', `The governed agent operates at ${autonomyName(current)} against a derived ceiling of ${autonomyName(ceiling.level)} for this decision type.`, [ctx.agent.logicalId, ctx.autonomyState.logicalId])]
  }
  return []
}

/** AUTH-007. Autonomy above the canonical baseline must be earned with evidence. */
export const auth007EarnedAutonomy: AuthorityRule = (ctx) => {
  const state = ctx.autonomyState
  if (state === null) return []
  if (!requiresEarnedEvidence(state.level)) return []

  if (state.gateClearanceEvidenceRef === null || !ctx.gateClearanceEvidencePresent) {
    return [fire('UNEARNED_AUTONOMY_LEVEL', `The governed agent holds ${autonomyName(state.level)}, above the canonical baseline of ${autonomyName(AUTONOMY_BASELINE)}, with no resolvable gate-clearance evidence. Autonomy is earned, never defaulted.`, [state.logicalId], state.gateClearanceEvidenceRef === null ? [] : [state.gateClearanceEvidenceRef])]
  }
  return []
}

/**
 * Determine every source that requires human review for this decision.
 * Exported so the result payload can explain WHY review was required.
 */
export function reviewRequirements(ctx: ResolvedContext): ReviewRequirementSource[] {
  const sources: ReviewRequirementSource[] = []
  const { decisionEvent, decisionType, matchingGrant } = ctx
  if (decisionEvent === null || decisionType === null) return sources

  for (const condition of decisionType.humanReviewConditions) {
    const value = decisionEvent.context[condition.contextKey]
    if (value !== undefined && value === condition.equals) {
      sources.push({
        source: 'DECISION_TYPE',
        reference: condition.conditionId,
        detail: condition.description,
      })
    }
  }

  if (matchingGrant !== null && matchingGrant.humanReviewRequired) {
    sources.push({
      source: 'AUTHORITY_GRANT',
      reference: matchingGrant.logicalId,
      detail: 'The authority grant requires human review for every decision it covers.',
    })
  }

  for (const policy of ctx.applicablePolicies) {
    if (policy.requirements.humanReviewRequired === true) {
      sources.push({
        source: 'POLICY',
        reference: policy.logicalId,
        detail: `Policy ${policy.name} requires human review.`,
      })
    }
  }

  for (const exception of ctx.applicableExceptions) {
    if (exception.requiresHumanReview) {
      sources.push({
        source: 'EXCEPTION',
        reference: exception.logicalId,
        detail: `Recorded exception requires human review: ${exception.description}.`,
      })
    }
  }

  return sources
}

/** AUTH-008. Mandatory human review must actually have happened. */
export const auth008HumanReview: AuthorityRule = (ctx) => {
  const { decisionEvent } = ctx
  if (decisionEvent === null) return []

  const required = reviewRequirements(ctx)
  if (required.length === 0) return []

  const review = decisionEvent.humanReview
  if (!review.performed) {
    const why = required.map((r) => r.detail).join(' ')
    return [fire('MISSING_HUMAN_REVIEW', `Human review is required and was not performed. ${why}`, [decisionEvent.logicalId])]
  }

  const fired: FiredReason[] = []
  if (ctx.reviewer === null || !ctx.reviewer.isActive) {
    fired.push(fire('REVIEWER_NOT_INDEPENDENT', 'The recorded reviewer does not resolve to an active Person.', [decisionEvent.logicalId]))
  } else if (ctx.reviewer.logicalId === decisionEvent.finalActor.logicalId) {
    fired.push(fire('REVIEWER_NOT_INDEPENDENT', 'The recorded reviewer is the deciding actor. Review must be independent of the decision.', [ctx.reviewer.logicalId]))
  }
  return fired
}

/** AUTH-009. Required information must be present, authoritative, current and permitted. */
export const auth009Information: AuthorityRule = (ctx) => {
  const completeness = ctx.evidenceCompleteness
  if (completeness.gaps.length === 0) return []

  const fired: FiredReason[] = []
  const seen = new Set<string>()

  for (const gap of completeness.gaps) {
    const code =
      gap.kind === 'ABSENT'
        ? 'MISSING_REQUIRED_INFORMATION'
        : gap.kind === 'NOT_AUTHORITATIVE'
          ? 'NON_AUTHORITATIVE_SOURCE'
          : gap.kind === 'STALE'
            ? 'STALE_INFORMATION'
            : 'UNAUTHORIZED_DATA_USE'
    const key = `${code}|${gap.classId}`
    if (seen.has(key)) continue
    seen.add(key)
    fired.push(fire(code, gap.detail, gap.assetLogicalId === null ? [] : [gap.assetLogicalId]))
  }

  return fired
}

/** AUTH-010. Applicable policies must not contradict each other unresolved. */
export const auth010PolicyConflict: AuthorityRule = (ctx) => {
  const policies = ctx.applicablePolicies
  if (policies.length < 2) return []

  const fired: FiredReason[] = []

  for (let i = 0; i < policies.length; i += 1) {
    for (let j = i + 1; j < policies.length; j += 1) {
      const a = policies[i]
      const b = policies[j]
      if (!a || !b) continue

      const aReview = a.requirements.humanReviewRequired
      const bReview = b.requirements.humanReviewRequired
      const contradicts = aReview !== null && bReview !== null && aReview !== bReview
      if (!contradicts) continue

      const resolvedByPrecedence =
        a.precedenceRank !== null && b.precedenceRank !== null && a.precedenceRank !== b.precedenceRank
      if (resolvedByPrecedence) continue

      fired.push(fire('UNRESOLVED_POLICY_CONFLICT', `Policies ${a.name} and ${b.name} assert opposing human-review requirements with no precedence to resolve them.`, [a.logicalId, b.logicalId]))
    }
  }

  return fired
}

/** AUTH-011. A named, active human must remain accountable for the outcome. */
export const auth011OutcomeAccountability: AuthorityRule = (ctx) => {
  const { decisionEvent } = ctx
  if (decisionEvent === null) return []

  if (decisionEvent.accountablePersonLogicalId === null) {
    return [fire('NO_HUMAN_OUTCOME_ACCOUNTABILITY', 'The decision names no accountable human. A tool cannot own an outcome.', [decisionEvent.logicalId])]
  }
  if (ctx.accountablePersonForOutcome === null || !ctx.accountablePersonForOutcome.isActive) {
    return [fire('NO_HUMAN_OUTCOME_ACCOUNTABILITY', `The named accountable human ${decisionEvent.accountablePersonLogicalId} does not resolve to an active Person.`, [decisionEvent.accountablePersonLogicalId])]
  }
  return []
}

/** AUTH-012. The delegation chain must resolve to a legitimate organizational source. */
export const auth012DelegationChain: AuthorityRule = (ctx) => {
  const { matchingGrant } = ctx
  if (matchingGrant === null) return []

  const fired: FiredReason[] = []

  if (ctx.delegationCycleDetected) {
    fired.push(fire('INVALID_DELEGATION_CHAIN', `The delegation chain from grant ${matchingGrant.logicalId} revisits a grant it already passed through. Authority cannot be self-conferring.`, [matchingGrant.logicalId]))
    return fired
  }

  if (!ctx.delegationTerminates) {
    fired.push(fire('INVALID_DELEGATION_CHAIN', `The delegation chain from grant ${matchingGrant.logicalId} does not resolve to a legitimate organizational source.`, [matchingGrant.logicalId]))
    return fired
  }

  // A grantor cannot delegate authority they do not possess.
  for (let i = 0; i < ctx.delegationChain.length - 1; i += 1) {
    const child = ctx.delegationChain[i]
    const parent = ctx.delegationChain[i + 1]
    if (!child || !parent) continue
    const c = child.grant
    const p = parent.grant
    const subjects = [c.logicalId, p.logicalId]

    if (c.financialLimit !== null && p.financialLimit !== null) {
      if (c.financialLimit.currency === p.financialLimit.currency && c.financialLimit.amount > p.financialLimit.amount) {
        fired.push(fire('DELEGATION_EXCEEDS_GRANTOR_AUTHORITY', `Grant ${c.logicalId} delegates a financial limit of ${formatMoney(c.financialLimit.amount, c.financialLimit.currency)} from a grantor holding only ${formatMoney(p.financialLimit.amount, p.financialLimit.currency)}.`, subjects))
      }
    } else if (c.financialLimit === null && p.financialLimit !== null) {
      fired.push(fire('DELEGATION_EXCEEDS_GRANTOR_AUTHORITY', `Grant ${c.logicalId} delegates an unlimited financial boundary from a grantor bounded at ${formatMoney(p.financialLimit.amount, p.financialLimit.currency)}.`, subjects))
    }

    if (c.riskLimit !== null && p.riskLimit !== null && riskOrdinal(c.riskLimit) > riskOrdinal(p.riskLimit)) {
      fired.push(fire('DELEGATION_EXCEEDS_GRANTOR_AUTHORITY', `Grant ${c.logicalId} delegates risk limit ${c.riskLimit} from a grantor limited to ${p.riskLimit}.`, subjects))
    }

    const beyond = c.allowedActions.filter((action) => !p.allowedActions.includes(action))
    if (beyond.length > 0) {
      fired.push(fire('DELEGATION_EXCEEDS_GRANTOR_AUTHORITY', `Grant ${c.logicalId} delegates actions the grantor does not hold: ${beyond.join(', ')}.`, subjects))
    }
  }

  return fired
}

/** Warning: the governed agent is overdue for review. */
export const agentReviewWarning: AuthorityRule = (ctx) => {
  const agent = ctx.agent
  if (agent === null || agent.reviewDueAt === null) return []
  if (Date.parse(agent.reviewDueAt) > Date.parse(ctx.evaluationInstant)) return []
  return [fire('AGENT_REVIEW_OVERDUE', `Governed agent ${agent.name} was due for review at ${agent.reviewDueAt}.`, [agent.logicalId])]
}

/** Warning: a contributing source identity is not confirmed. */
export const sourceIdentityWarning: AuthorityRule = (ctx) => {
  const unresolved: string[] = []
  const candidates = [ctx.agent, ctx.decisionEvent, ctx.decisionType, ctx.matchingGrant]
  for (const node of candidates) {
    if (node === null) continue
    if (node.sourceRef !== null && node.sourceRef.resolutionStatus !== 'CONFIRMED') {
      unresolved.push(node.logicalId)
    }
  }
  if (unresolved.length === 0) return []
  return [fire('UNRESOLVED_SOURCE_IDENTITY', `Contributing records carry an unconfirmed cross-system identity mapping: ${unresolved.join(', ')}.`, unresolved)]
}

/**
 * The complete rule set, in a fixed declaration order.
 *
 * Order affects only the sequence reasons are reported in. It never affects the
 * primary status, which is resolved by the precedence module from the reason set
 * as a whole.
 */
export const ALL_RULES: readonly AuthorityRule[] = [
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
  permissionFreshnessWarning,
  agentReviewWarning,
  sourceIdentityWarning,
]

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
