/**
 * The typed reason-code registry.
 *
 * Every failure code carries its CLEARING PREDICATE: the exact graph condition
 * that, when it becomes true, makes the failure false. The identity of a
 * condition is determined by what makes it false, never by its severity or its
 * label. That is the same rule the Lapemo Condition Family Registry enforces,
 * which is why each code also carries the `lapemoConditionKey` it maps onto.
 *
 * Where `lapemoConditionKey` is set, this package must map rather than
 * reimplement: the platform already owns that condition, its evaluator, and its
 * resolution policy. Where it is null, no platform condition exists and the
 * graph is the first system to compute it.
 */

export type ReasonCategory =
  | 'OWNERSHIP'
  | 'SUPERVISION'
  | 'AUTHORITY'
  | 'PERMISSION'
  | 'AUTONOMY'
  | 'REVIEW'
  | 'INFORMATION'
  | 'POLICY'
  | 'ACCOUNTABILITY'
  | 'DELEGATION'
  | 'DATA_INTEGRITY'

/**
 * How a fired reason affects the single primary status.
 *
 * BLOCKING       a hard violation. The decision was not authorized.
 * CONDITIONAL    authorized subject to a pending, obtainable action.
 * INDETERMINATE  the graph lacks the data to evaluate at all.
 * WARNING        recorded, but does not move the status on its own.
 */
export type StatusImpact = 'BLOCKING' | 'CONDITIONAL' | 'INDETERMINATE' | 'WARNING'

export interface ReasonCodeDefinition {
  readonly code: string
  readonly ruleId: string
  readonly category: ReasonCategory
  readonly statusImpact: StatusImpact
  /** Stable identifier for the clearing predicate itself. */
  readonly clearingPredicateId: string
  /** The exact graph condition that makes this reason false. */
  readonly clearingPredicate: string
  /** The Lapemo condition family this maps onto, when the platform owns one. */
  readonly lapemoConditionKey: string | null
}

export const REASON_CODES: readonly ReasonCodeDefinition[] = [
  // ── AUTH-001 Explicit accountable owner ───────────────────────────────────
  {
    code: 'UNOWNED_AGENT',
    ruleId: 'AUTH-001',
    category: 'OWNERSHIP',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'ownership.exactly_one_active_accountable_person',
    clearingPredicate:
      'Exactly one ACCOUNTABLE_FOR edge from a Person to the governed agent is effective at the evaluation instant, and that Person is active.',
    lapemoConditionKey: 'ownership.entity_unowned',
  },
  {
    code: 'AMBIGUOUS_AGENT_OWNERSHIP',
    ruleId: 'AUTH-001',
    category: 'OWNERSHIP',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'ownership.no_competing_active_accountable_person',
    clearingPredicate:
      'No more than one ACCOUNTABLE_FOR edge from a Person to the governed agent is effective at the evaluation instant. Joint accountability is rejected at the domain layer.',
    lapemoConditionKey: 'ownership.disputed',
  },

  // ── AUTH-002 Named supervisor ─────────────────────────────────────────────
  {
    code: 'UNSUPERVISED_AGENT',
    ruleId: 'AUTH-002',
    category: 'SUPERVISION',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'supervision.exactly_one_active_supervisor',
    clearingPredicate:
      'Exactly one SUPERVISES edge from a Person to the governed agent is effective at the evaluation instant, and that Person is active.',
    lapemoConditionKey: 'agent.lost_supervision',
  },

  // ── AUTH-003 Matching authority ───────────────────────────────────────────
  {
    code: 'NO_MATCHING_AUTHORITY',
    ruleId: 'AUTH-003',
    category: 'AUTHORITY',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'authority.grant_covers_decision_type',
    clearingPredicate:
      'An AuthorityGrant effective at the evaluation instant names the governed agent as grantee and the decision event decision type as its decision type.',
    lapemoConditionKey: null,
  },
  {
    code: 'ACTION_OUTSIDE_AUTHORITY',
    ruleId: 'AUTH-003',
    category: 'AUTHORITY',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'authority.action_within_allowed_actions',
    clearingPredicate:
      'The requested action appears in the matching grant allowedActions and does not appear in its prohibitedActions.',
    lapemoConditionKey: null,
  },
  {
    code: 'FINANCIAL_LIMIT_EXCEEDED',
    ruleId: 'AUTH-003',
    category: 'AUTHORITY',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'authority.financial_amount_within_grant_limit',
    clearingPredicate:
      'The matching grant has financialLimit of null, OR the decision event carries no financial amount, OR financialLimit.currency equals financialAmount.currency AND financialLimit.amount is greater than or equal to financialAmount.amount. A currency mismatch never clears this condition and is reported rather than converted.',
    lapemoConditionKey: null,
  },
  {
    code: 'RISK_LIMIT_EXCEEDED',
    ruleId: 'AUTH-003',
    category: 'AUTHORITY',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'authority.risk_within_grant_limit',
    clearingPredicate:
      'The matching grant has riskLimit of null, OR the ordinal of the decision event risk level is less than or equal to the ordinal of the grant riskLimit on the semantic scale LOW, MODERATE, HIGH, CRITICAL.',
    lapemoConditionKey: null,
  },
  {
    code: 'DATA_CLASSIFICATION_LIMIT_EXCEEDED',
    ruleId: 'AUTH-003',
    category: 'AUTHORITY',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'authority.data_classification_within_grant_limit',
    clearingPredicate:
      'The matching grant has dataClassificationLimit of null, OR the ordinal of the decision event data classification is less than or equal to the ordinal of the grant limit on the scale PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED.',
    lapemoConditionKey: null,
  },
  {
    code: 'SYSTEM_SCOPE_EXCEEDED',
    ruleId: 'AUTH-003',
    category: 'AUTHORITY',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'authority.invoked_systems_within_grant_scope',
    clearingPredicate:
      'The matching grant has systemScope of null, OR every system the decision event invokes appears in that systemScope.',
    lapemoConditionKey: null,
  },
  {
    code: 'GEOGRAPHIC_SCOPE_EXCEEDED',
    ruleId: 'AUTH-003',
    category: 'AUTHORITY',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'authority.geography_within_grant_scope',
    clearingPredicate:
      'The matching grant has geographicScope of null, OR the decision event geography appears in that geographicScope.',
    lapemoConditionKey: null,
  },

  // ── AUTH-004 Effective authority ──────────────────────────────────────────
  {
    code: 'AUTHORITY_NOT_YET_EFFECTIVE',
    ruleId: 'AUTH-004',
    category: 'AUTHORITY',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'authority.grant_effective_from_reached',
    clearingPredicate:
      'The matching grant effectiveFrom is less than or equal to both the decision timestamp and the action timestamp.',
    lapemoConditionKey: null,
  },
  {
    code: 'AUTHORITY_EXPIRED',
    ruleId: 'AUTH-004',
    category: 'AUTHORITY',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'authority.grant_effective_to_not_passed',
    clearingPredicate:
      'The matching grant effectiveTo is null, OR it is strictly later than both the decision timestamp and the action timestamp.',
    lapemoConditionKey: null,
  },
  {
    code: 'AUTHORITY_REVOKED',
    ruleId: 'AUTH-004',
    category: 'AUTHORITY',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'authority.grant_not_revoked',
    clearingPredicate:
      'The matching grant carries no revocation record whose revokedAt is less than or equal to the evaluation instant.',
    lapemoConditionKey: null,
  },

  // ── AUTH-005 Permission and authority alignment ───────────────────────────
  {
    code: 'PERMISSION_AUTHORITY_MISMATCH',
    ruleId: 'AUTH-005',
    category: 'PERMISSION',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'permission.technical_grant_within_organizational_authority',
    clearingPredicate:
      'For every effective SystemPermission held by the governed agent on a system the decision event invokes: every permittedAction is covered by the matching grant allowedActions, and the permission financialLimit is null or does not exceed the grant financialLimit. Technical permission never establishes authority; it only has to stay inside it.',
    lapemoConditionKey: null,
  },

  // ── AUTH-006 Autonomy ceiling ─────────────────────────────────────────────
  {
    code: 'AUTONOMY_EXCEEDS_DECISION_LIMIT',
    ruleId: 'AUTH-006',
    category: 'AUTONOMY',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'autonomy.effective_state_within_derived_ceiling',
    clearingPredicate:
      'The ordinal of the effective AutonomyState for this governed agent and decision type is less than or equal to the ordinal of the ceiling supplied by the autonomy ceiling provider for that decision context. The ceiling is derived at evaluation time and is never stored.',
    lapemoConditionKey: 'governance.autonomy_exceeds_ceiling',
  },
  {
    code: 'AUTONOMY_CEILING_BLOCKED',
    ruleId: 'AUTH-006',
    category: 'AUTONOMY',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'autonomy.ceiling_resolvable',
    clearingPredicate:
      'The autonomy ceiling provider returns a level rather than BLOCKED for this decision context. A BLOCKED ceiling means a prerequisite such as domain ownership is unsatisfied, so no level is permitted at all.',
    lapemoConditionKey: 'ownership.decision_domain_unowned',
  },

  // ── AUTH-007 Earned autonomy ──────────────────────────────────────────────
  {
    code: 'UNEARNED_AUTONOMY_LEVEL',
    ruleId: 'AUTH-007',
    category: 'AUTONOMY',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'autonomy.above_baseline_has_gate_clearance_evidence',
    clearingPredicate:
      'The effective AutonomyState is at or below the canonical baseline of Agent Assisted, OR it carries a gateClearanceEvidenceRef that resolves to an effective EvidenceObject and names a granting business owner Person. Autonomy is earned, never defaulted.',
    lapemoConditionKey: 'agent.confidence_gate_rollback',
  },

  // ── AUTH-008 Mandatory human review ───────────────────────────────────────
  {
    code: 'MISSING_HUMAN_REVIEW',
    ruleId: 'AUTH-008',
    category: 'REVIEW',
    statusImpact: 'CONDITIONAL',
    clearingPredicateId: 'review.required_review_performed_by_active_person',
    clearingPredicate:
      'No applicable human-review requirement fires for this decision event, OR the decision event humanReview.performed is true and its reviewer resolves to an active Person other than the deciding governed agent. Requirements may come from the decision type conditions, the matching grant, an applicable policy, or an applicable exception.',
    lapemoConditionKey: null,
  },
  {
    code: 'REVIEWER_NOT_INDEPENDENT',
    ruleId: 'AUTH-008',
    category: 'REVIEW',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'review.reviewer_is_independent_active_person',
    clearingPredicate:
      'The recorded reviewer resolves to an active Person who is not the accountable owner acting on their own decision and is not the deciding actor.',
    lapemoConditionKey: null,
  },

  // ── AUTH-009 Authoritative information ────────────────────────────────────
  {
    code: 'MISSING_REQUIRED_INFORMATION',
    ruleId: 'AUTH-009',
    category: 'INFORMATION',
    statusImpact: 'CONDITIONAL',
    clearingPredicateId: 'information.required_class_present',
    clearingPredicate:
      'For every requiredInformationClass on the decision type, at least one InformationAsset effective at the evaluation instant is linked to the decision event by a USES edge and declares that informationClassId.',
    lapemoConditionKey: null,
  },
  {
    code: 'NON_AUTHORITATIVE_SOURCE',
    ruleId: 'AUTH-009',
    category: 'INFORMATION',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'information.source_is_authoritative_for_class',
    clearingPredicate:
      'For every requiredInformationClass whose mustBeAuthoritative is true, the satisfying InformationAsset lists that classId in its authoritativeFor set.',
    lapemoConditionKey: 'knowledge.ai_retrieval_ungoverned',
  },
  {
    code: 'STALE_INFORMATION',
    ruleId: 'AUTH-009',
    category: 'INFORMATION',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'information.observation_within_freshness_policy',
    clearingPredicate:
      'For every satisfying InformationAsset, staleAfterDays is null, OR the elapsed time from observedAt to the evaluation instant is less than or equal to staleAfterDays, AND the age also satisfies any maxAgeDays the required class imposes.',
    lapemoConditionKey: 'knowledge.overdue_audit',
  },
  {
    code: 'UNAUTHORIZED_DATA_USE',
    ruleId: 'AUTH-009',
    category: 'INFORMATION',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'information.classification_within_permitted_bound',
    clearingPredicate:
      'Every satisfying InformationAsset classification ordinal is less than or equal to the required class maxDataClassification ordinal and to the matching grant dataClassificationLimit ordinal when that limit is set.',
    lapemoConditionKey: null,
  },

  // ── AUTH-010 Policy conflict ──────────────────────────────────────────────
  {
    code: 'UNRESOLVED_POLICY_CONFLICT',
    ruleId: 'AUTH-010',
    category: 'POLICY',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'policy.no_contradiction_without_precedence',
    clearingPredicate:
      'No two policies effective at the evaluation instant and applicable to this decision type assert opposing non-null values on the same requirement dimension while sharing an equal or absent precedenceRank. A contradiction resolved by a strictly higher precedenceRank clears this condition.',
    lapemoConditionKey: null,
  },

  // ── AUTH-011 Human outcome accountability ─────────────────────────────────
  {
    code: 'NO_HUMAN_OUTCOME_ACCOUNTABILITY',
    ruleId: 'AUTH-011',
    category: 'ACCOUNTABILITY',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'accountability.named_active_person_accountable',
    clearingPredicate:
      'The decision event names an accountable Person who resolves to an active Person node effective at the evaluation instant. A tool cannot own an outcome.',
    lapemoConditionKey: null,
  },

  // ── AUTH-012 Valid delegation chain ───────────────────────────────────────
  {
    code: 'INVALID_DELEGATION_CHAIN',
    ruleId: 'AUTH-012',
    category: 'DELEGATION',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'delegation.chain_resolves_to_organizational_source',
    clearingPredicate:
      'Following derivedFromGrantLogicalId from the matching grant reaches a grant naming an organizationalSource, without revisiting a grant, with every grant in the chain effective at the evaluation instant.',
    lapemoConditionKey: null,
  },
  {
    code: 'DELEGATION_EXCEEDS_GRANTOR_AUTHORITY',
    ruleId: 'AUTH-012',
    category: 'DELEGATION',
    statusImpact: 'BLOCKING',
    clearingPredicateId: 'delegation.child_limits_within_parent_limits',
    clearingPredicate:
      'For every parent and child pair in the delegation chain: the child financialLimit does not exceed the parent financialLimit, the child riskLimit does not exceed the parent riskLimit, the child dataClassificationLimit does not exceed the parent limit, and every child allowedAction appears in the parent allowedActions. A grantor cannot delegate authority they do not hold.',
    lapemoConditionKey: null,
  },

  // ── Data integrity, which produces INDETERMINATE rather than a business result ──
  {
    code: 'DECISION_EVENT_NOT_FOUND',
    ruleId: 'DATA-001',
    category: 'DATA_INTEGRITY',
    statusImpact: 'INDETERMINATE',
    clearingPredicateId: 'integrity.decision_event_resolvable',
    clearingPredicate:
      'A DecisionEvent with the requested logical id is effective at the evaluation instant within the requested organization.',
    lapemoConditionKey: null,
  },
  {
    code: 'DECIDING_ACTOR_NOT_RESOLVABLE',
    ruleId: 'DATA-002',
    category: 'DATA_INTEGRITY',
    statusImpact: 'INDETERMINATE',
    clearingPredicateId: 'integrity.final_actor_resolvable',
    clearingPredicate:
      'The decision event finalActor resolves to an Agent or Person node effective at the evaluation instant.',
    lapemoConditionKey: null,
  },
  {
    code: 'DECISION_TYPE_NOT_RESOLVABLE',
    ruleId: 'DATA-003',
    category: 'DATA_INTEGRITY',
    statusImpact: 'INDETERMINATE',
    clearingPredicateId: 'integrity.decision_type_resolvable',
    clearingPredicate:
      'The decision event decisionTypeLogicalId resolves to a DecisionType effective at the evaluation instant.',
    lapemoConditionKey: null,
  },
  {
    code: 'ORGANIZATION_SCOPE_MISSING',
    ruleId: 'DATA-004',
    category: 'DATA_INTEGRITY',
    statusImpact: 'INDETERMINATE',
    clearingPredicateId: 'integrity.organization_scope_present',
    clearingPredicate:
      'Every node reached during evaluation carries a non-empty organizationId equal to the requested organization scope.',
    lapemoConditionKey: null,
  },

  // ── Warnings, recorded but not status-moving on their own ─────────────────
  {
    code: 'AGENT_REVIEW_OVERDUE',
    ruleId: 'WARN-001',
    category: 'SUPERVISION',
    statusImpact: 'WARNING',
    clearingPredicateId: 'supervision.agent_review_within_due_date',
    clearingPredicate:
      'The governed agent reviewDueAt is null, OR it is strictly later than the evaluation instant.',
    lapemoConditionKey: null,
  },
  {
    code: 'UNRESOLVED_SOURCE_IDENTITY',
    ruleId: 'WARN-002',
    category: 'DATA_INTEGRITY',
    statusImpact: 'WARNING',
    clearingPredicateId: 'integrity.source_identity_confirmed',
    clearingPredicate:
      'Every node contributing to the result either carries no sourceRef or carries one whose resolutionStatus is CONFIRMED.',
    lapemoConditionKey: null,
  },
  {
    code: 'STALE_SYSTEM_PERMISSION',
    ruleId: 'WARN-003',
    category: 'PERMISSION',
    statusImpact: 'WARNING',
    clearingPredicateId: 'permission.synchronization_fresh',
    clearingPredicate:
      'Every SystemPermission considered has stalenessState of FRESH. A stale technical permission may not reflect what the system currently allows.',
    lapemoConditionKey: null,
  },
]

const BY_CODE = new Map<string, ReasonCodeDefinition>(REASON_CODES.map((r) => [r.code, r]))

export function reasonCode(code: string): ReasonCodeDefinition {
  const definition = BY_CODE.get(code)
  if (!definition) throw new Error(`Unregistered reason code: ${code}`)
  return definition
}

export function isRegisteredReasonCode(code: string): boolean {
  return BY_CODE.has(code)
}

export function reasonCodesForRule(ruleId: string): ReasonCodeDefinition[] {
  return REASON_CODES.filter((r) => r.ruleId === ruleId)
}

/** The mapping surface Lapemo consumes to route graph reasons into its condition families. */
export function lapemoConditionKeyMap(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const r of REASON_CODES) {
    if (r.lapemoConditionKey !== null) map[r.code] = r.lapemoConditionKey
  }
  return map
}
