/**
 * Typed node contracts.
 *
 * Every material node carries identity (three identifiers), an organizational
 * boundary, temporal validity in both dimensions, lifecycle status, provenance,
 * confidence, and evidence references.
 *
 * A relationship that already has a single writable owner elsewhere is NOT a
 * field here. Accountable ownership and supervision, for example, are edges
 * projected from the platform records that own them, never duplicated as
 * `ownerId` / `supervisorId` columns on Agent. See ADR-002 and ADR-008.
 */

import type { NodeIdentity, ActorRef, MonetaryAmount } from '../identity.js'
import type { TemporalFields } from '../../graph/temporal.js'
import type {
  NodeType,
  RiskLevel,
  ActorType,
  AgentLifecycleState,
  AutonomyLevelKey,
  GrantType,
  OrganizationalAuthoritySource,
  StalenessState,
  IntegrityState,
  DataClassification,
} from '../enums/index.js'

/** Common shape of every governed node. */
export interface NodeBase extends NodeIdentity, TemporalFields {
  readonly nodeType: NodeType
  /**
   * Organizational boundary. Required and non-empty on every node.
   * All traversal is organization-scoped; there is no cross-organization path.
   * Inbound platform data may carry a null organization scope, and the adapter
   * must reject it rather than defaulting it.
   */
  readonly organizationId: string
  /** Asserted or derived confidence on the 0.0 to 1.0 scale. See ADR-005. */
  readonly confidence: number
  /** Logical ids of EvidenceObject nodes supporting this fact. */
  readonly evidenceRefs: readonly string[]
}

export interface OrganizationNode extends NodeBase {
  readonly nodeType: 'Organization'
  readonly name: string
}

export interface OrganizationalUnitNode extends NodeBase {
  readonly nodeType: 'OrganizationalUnit'
  readonly name: string
  readonly unitKind: 'BUSINESS_UNIT' | 'TEAM' | 'FUNCTION'
}

export interface PersonNode extends NodeBase {
  readonly nodeType: 'Person'
  readonly displayName: string
  readonly title: string | null
  /**
   * Whether the person is currently an active member of the organization.
   * A deactivated person cannot satisfy an accountability or supervision
   * predicate even while a stale relationship still points at them.
   */
  readonly isActive: boolean
}

export interface RoleNode extends NodeBase {
  readonly nodeType: 'Role'
  readonly name: string
}

export interface RoleAssignmentNode extends NodeBase {
  readonly nodeType: 'RoleAssignment'
  readonly personLogicalId: string
  readonly roleLogicalId: string
}

export interface AgentNode extends NodeBase {
  readonly nodeType: 'Agent'
  readonly name: string
  readonly businessPurpose: string
  readonly agentKind: string
  readonly riskLevel: RiskLevel
  readonly lifecycleState: AgentLifecycleState
  readonly modelProvider: string | null
  readonly modelIdentifier: string | null
  readonly modelVersion: string | null
  readonly activatedAt: string | null
  readonly lastReviewedAt: string | null
  readonly reviewDueAt: string | null
  readonly retiredAt: string | null
  // Accountable owner, supervisor, technical owner and sponsoring role are
  // EDGES, not fields. See docs/ONTOLOGY.md, edge direction conventions.
}

/**
 * Temporal, lineage-backed autonomy.
 *
 * Autonomy is never a freely mutable scalar on the agent. Each state is a
 * governed fact with an effective period, the business owner who granted it,
 * and, above the canonical baseline, the gate-clearance evidence that earned it.
 * The autonomy CEILING for a decision context is never stored here; it is
 * supplied at evaluation time by an AutonomyCeilingProvider.
 */
export interface AutonomyStateNode extends NodeBase {
  readonly nodeType: 'AutonomyState'
  readonly agentLogicalId: string
  /** Null means the state applies to every decision type for this agent. */
  readonly decisionTypeLogicalId: string | null
  readonly level: AutonomyLevelKey
  /** Required for any level above the canonical baseline. */
  readonly gateClearanceEvidenceRef: string | null
  /** The business owner who granted the state. Never engineering by default. */
  readonly grantingBusinessOwnerPersonId: string
}

/** A condition under which human review becomes mandatory for a decision type. */
export interface HumanReviewCondition {
  readonly conditionId: string
  readonly description: string
  /** Key on DecisionEvent.context that this condition inspects. */
  readonly contextKey: string
  /** The condition fires when the context value strictly equals this. */
  readonly equals: string | number | boolean
}

/** An information class a decision type requires before it can be decided. */
export interface RequiredInformationClass {
  readonly classId: string
  readonly description: string
  /** The asset must be marked authoritative for this class. */
  readonly mustBeAuthoritative: boolean
  /** Maximum permitted age of the observation, in days. Null means no limit. */
  readonly maxAgeDays: number | null
  /** Highest data classification permitted to satisfy this class. */
  readonly maxDataClassification: DataClassification
}

export interface DecisionTypeNode extends NodeBase {
  readonly nodeType: 'DecisionType'
  readonly name: string
  readonly domain: string
  readonly allowedActorClasses: readonly ActorType[]
  /** The closed vocabulary of actions a decision of this type may request. */
  readonly actionVocabulary: readonly string[]
  readonly riskLevel: RiskLevel
  readonly humanReviewConditions: readonly HumanReviewCondition[]
  readonly requiredInformationClasses: readonly RequiredInformationClass[]
  /** Logical ids of EnterpriseSystem nodes this decision type may invoke. */
  readonly permittedSystemLogicalIds: readonly string[]
  readonly escalationPersonLogicalId: string | null
  readonly governingPolicyLogicalIds: readonly string[]
  readonly governingControlLogicalIds: readonly string[]
}

/** Revocation state of an authority grant. */
export interface GrantRevocation {
  readonly revokedAt: string
  readonly reason: string
  readonly revokedByPersonLogicalId: string
}

export interface AuthorityGrantNode extends NodeBase {
  readonly nodeType: 'AuthorityGrant'
  readonly grantType: GrantType
  readonly grantor: ActorRef
  readonly grantee: ActorRef
  readonly decisionTypeLogicalId: string
  readonly allowedActions: readonly string[]
  readonly prohibitedActions: readonly string[]
  /** Null means no financial boundary is imposed by this grant. */
  readonly financialLimit: MonetaryAmount | null
  /** Highest risk level this grant covers. Null means unrestricted. */
  readonly riskLimit: RiskLevel | null
  /** Highest data classification this grant permits. Null means unrestricted. */
  readonly dataClassificationLimit: DataClassification | null
  /** Logical ids of permitted systems. Null means unrestricted. */
  readonly systemScope: readonly string[] | null
  /** Permitted geographies. Null means unrestricted. */
  readonly geographicScope: readonly string[] | null
  readonly conditions: readonly string[]
  readonly humanReviewRequired: boolean
  readonly revocation: GrantRevocation | null
  readonly governingPolicyLogicalId: string | null
  /**
   * The grant this one was delegated from. Null only when grantType is
   * ORGANIZATIONAL_SOURCE, in which case organizationalSource must be set.
   * AUTH-012 walks this chain.
   */
  readonly derivedFromGrantLogicalId: string | null
  readonly organizationalSource: OrganizationalAuthoritySource | null
}

/** Record of whether human review actually happened on a decision. */
export interface HumanReviewRecord {
  readonly performed: boolean
  readonly reviewerPersonLogicalId: string | null
  readonly reviewedAt: string | null
}

export interface DecisionEventNode extends NodeBase {
  readonly nodeType: 'DecisionEvent'
  readonly decisionTypeLogicalId: string
  readonly initiatingActor: ActorRef
  readonly finalActor: ActorRef
  /** The named human who remains accountable for the outcome. */
  readonly accountablePersonLogicalId: string | null
  readonly businessContext: string
  readonly requestedAction: string
  readonly financialAmount: MonetaryAmount | null
  readonly riskLevel: RiskLevel
  readonly dataClassification: DataClassification | null
  readonly geography: string | null
  /** Systems this decision intends to invoke. */
  readonly targetSystemLogicalIds: readonly string[]
  /** Free-form governed context flags that human-review conditions inspect. */
  readonly context: Readonly<Record<string, string | number | boolean>>
  readonly humanReview: HumanReviewRecord
  readonly decidedAt: string
  readonly executedAt: string | null
  readonly expectedOutcome: string | null
  readonly actualOutcomeLogicalId: string | null
  readonly correlationId: string
  readonly source: string
}

export interface ActionEventNode extends NodeBase {
  readonly nodeType: 'ActionEvent'
  readonly decisionEventLogicalId: string
  readonly actor: ActorRef
  readonly action: string
  readonly enterpriseSystemLogicalId: string | null
  readonly performedAt: string
  readonly succeeded: boolean
}

/**
 * A governed policy requirement.
 *
 * Requirements are modeled as explicit tri-state dimensions rather than free
 * text, so that AUTH-010 can detect a genuine contradiction between two
 * applicable policies instead of guessing from prose.
 */
export interface PolicyRequirements {
  /** true requires review, false explicitly waives it, null is silent. */
  readonly humanReviewRequired: boolean | null
  readonly maxFinancialAmount: MonetaryAmount | null
  readonly prohibitedActions: readonly string[]
}

export interface PolicyNode extends NodeBase {
  readonly nodeType: 'Policy'
  readonly name: string
  readonly appliesToDecisionTypeLogicalIds: readonly string[]
  readonly requirements: PolicyRequirements
  /**
   * Higher rank wins when two policies contradict. Null means the policy claims
   * no precedence, so a contradiction with another null-rank policy is
   * unresolved and AUTH-010 fires.
   */
  readonly precedenceRank: number | null
}

export interface ControlNode extends NodeBase {
  readonly nodeType: 'Control'
  readonly name: string
  readonly riskLevel: RiskLevel
  readonly appliesToDecisionTypeLogicalIds: readonly string[]
  readonly ownerPersonLogicalId: string | null
  readonly nextReviewAt: string | null
}

export interface EvidenceObjectNode extends NodeBase {
  readonly nodeType: 'EvidenceObject'
  readonly evidenceType: string
  readonly evidentiaryPurpose: string
  readonly issuedAt: string
  readonly integrityState: IntegrityState
  /** Governed Knowledge Object identifier, when the source is a Knowledge Object. */
  readonly knowledgeObjectRef: KnowledgeObjectRef | null
  readonly retentionExpiresAt: string | null
}

/**
 * A reference to a governed Knowledge Object.
 *
 * Knowledge Object definitions, schemas and content are owned by
 * `lpm-knowledge-objects`. This package references them by identity and version
 * only, and never copies their canonical content or schema.
 */
export interface KnowledgeObjectRef {
  /** Matches the governed pattern ko.<domain>.<slug>. Version is not part of the id. */
  readonly knowledgeObjectId: string
  readonly version: string
}

export interface InformationAssetNode extends NodeBase {
  readonly nodeType: 'InformationAsset'
  readonly name: string
  readonly informationClassId: string
  readonly classification: DataClassification
  readonly permittedUse: readonly string[]
  /** Information class ids this asset is the authoritative source for. */
  readonly authoritativeFor: readonly string[]
  readonly observedAt: string
  /** Freshness policy. Null means the asset never goes stale. */
  readonly staleAfterDays: number | null
  readonly integrityState: IntegrityState
  readonly knowledgeObjectRef: KnowledgeObjectRef | null
}

export interface EnterpriseSystemNode extends NodeBase {
  readonly nodeType: 'EnterpriseSystem'
  readonly name: string
  readonly systemClass: string
}

/**
 * A technical grant recorded in, or synchronized from, an enterprise system.
 *
 * A SystemPermission records what the technology permits. It never proves what
 * the organization authorizes. Permission is never called authority anywhere in
 * this package.
 */
export interface SystemPermissionNode extends NodeBase {
  readonly nodeType: 'SystemPermission'
  readonly principal: ActorRef
  readonly enterpriseSystemLogicalId: string
  readonly permissionIdentifier: string
  readonly permittedActions: readonly string[]
  readonly resourceScope: readonly string[]
  readonly functionScope: readonly string[]
  readonly dataScope: readonly string[]
  /** What the system itself will allow, which is often more than authority allows. */
  readonly financialLimit: MonetaryAmount | null
  readonly volumeLimit: number | null
  readonly transactionLimit: number | null
  readonly technicalGrantor: string | null
  readonly sourceConnector: string | null
  readonly revoked: boolean
  readonly lastSynchronizedAt: string | null
  readonly stalenessState: StalenessState
}

export interface OutcomeNode extends NodeBase {
  readonly nodeType: 'Outcome'
  readonly name: string
  /** A tool cannot own an outcome. This is always a Person. */
  readonly accountablePersonLogicalId: string
  readonly achievedAt: string | null
}

export interface ExceptionNode extends NodeBase {
  readonly nodeType: 'Exception'
  readonly description: string
  readonly appliesToDecisionTypeLogicalIds: readonly string[]
  readonly approvedByPersonLogicalId: string
  readonly requiresHumanReview: boolean
}

export type GraphNode =
  | OrganizationNode
  | OrganizationalUnitNode
  | PersonNode
  | RoleNode
  | RoleAssignmentNode
  | AgentNode
  | AutonomyStateNode
  | DecisionTypeNode
  | AuthorityGrantNode
  | DecisionEventNode
  | ActionEventNode
  | PolicyNode
  | ControlNode
  | EvidenceObjectNode
  | InformationAssetNode
  | EnterpriseSystemNode
  | SystemPermissionNode
  | OutcomeNode
  | ExceptionNode

/** Narrowing helper used throughout the query and evaluation layers. */
export function isNodeOfType<T extends GraphNode['nodeType']>(
  node: GraphNode,
  nodeType: T,
): node is Extract<GraphNode, { nodeType: T }> {
  return node.nodeType === nodeType
}
