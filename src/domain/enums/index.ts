/**
 * Portable domain enumerations.
 *
 * Every value here is either canon-derived (re-exported from src/canon) or
 * semantic and owned by this package. Nothing here is copied from a platform
 * database enum, because platform enums are persistence details that belong
 * behind an adapter.
 */

export {
  AUTONOMY_SPECTRUM,
  AUTONOMY_BASELINE,
  autonomyOrdinal,
  autonomyName,
  isAutonomyLevelKey,
  requiresEarnedEvidence,
  type AutonomyLevelKey,
} from '../../canon/index.js'

/**
 * Semantic risk levels.
 *
 * The graph deliberately refuses to give portable business meaning to a numbered
 * tier. Two live numbering schemes exist in the Lapemo platform and they run in
 * opposite directions, so a bare `riskTier` field would silently inherit
 * whichever one the reader assumed. Adapters must name their source scheme and
 * map explicitly into these values. See src/adapters/lapemo/risk-mapping.ts and
 * docs/ADR/ADR-006-risk-semantics.md.
 */
export const RISK_LEVELS = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

const RISK_ORDER: Record<RiskLevel, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
}

/** Ascending severity. LOW is least severe, CRITICAL is most severe. */
export function riskOrdinal(level: RiskLevel): number {
  return RISK_ORDER[level]
}

export function isRiskLevel(value: string): value is RiskLevel {
  return value in RISK_ORDER
}

/** Record lifecycle marker. Distinct from any domain status a node also carries. */
export const RECORD_STATUSES = ['ACTIVE', 'SUPERSEDED', 'VOIDED'] as const
export type RecordStatus = (typeof RECORD_STATUSES)[number]

/** Node types in the v0.1 ontology. */
export const NODE_TYPES = [
  'Organization',
  'OrganizationalUnit',
  'Person',
  'Role',
  'RoleAssignment',
  'Agent',
  'AutonomyState',
  'DecisionType',
  'AuthorityGrant',
  'DecisionEvent',
  'ActionEvent',
  'Policy',
  'Control',
  'EvidenceObject',
  'InformationAsset',
  'EnterpriseSystem',
  'SystemPermission',
  'Outcome',
  'Exception',
] as const
export type NodeType = (typeof NODE_TYPES)[number]

/** Actor classes permitted to initiate or finalize a decision. */
export const ACTOR_TYPES = ['Person', 'Agent', 'System'] as const
export type ActorType = (typeof ACTOR_TYPES)[number]

/** Governed agent lifecycle. */
export const AGENT_LIFECYCLE_STATES = [
  'PENDING_REGISTRATION',
  'REGISTERED',
  'ACTIVE',
  'SUSPENDED',
  'RETIRED',
] as const
export type AgentLifecycleState = (typeof AGENT_LIFECYCLE_STATES)[number]

/** How an authority grant came to exist. */
export const GRANT_TYPES = ['DELEGATED', 'ROLE_DERIVED', 'POLICY_DERIVED', 'ORGANIZATIONAL_SOURCE'] as const
export type GrantType = (typeof GRANT_TYPES)[number]

/**
 * Where a root authority grant ultimately resolves to. AUTH-012 requires every
 * delegation chain to terminate at one of these, never at another agent.
 */
export const ORGANIZATIONAL_AUTHORITY_SOURCES = [
  'BOARD_RESOLUTION',
  'EXECUTIVE_MANDATE',
  'CORPORATE_POLICY',
  'DELEGATION_OF_AUTHORITY_MATRIX',
] as const
export type OrganizationalAuthoritySource = (typeof ORGANIZATIONAL_AUTHORITY_SOURCES)[number]

/** Freshness state of a synchronized technical record. */
export const STALENESS_STATES = ['FRESH', 'STALE', 'UNKNOWN'] as const
export type StalenessState = (typeof STALENESS_STATES)[number]

/** Verification state of an evidence object or information asset. */
export const INTEGRITY_STATES = ['VERIFIED', 'UNVERIFIED', 'FAILED'] as const
export type IntegrityState = (typeof INTEGRITY_STATES)[number]

/**
 * Resolution state of a cross-system identity mapping. Mirrors the semantics of
 * the platform's external entity mapping so a mapping that is not CONFIRMED can
 * degrade evaluation confidence instead of silently resolving.
 */
export const SOURCE_RESOLUTION_STATUSES = [
  'UNRESOLVED',
  'PROPOSED',
  'CONFIRMED',
  'REJECTED',
  'AMBIGUOUS',
] as const
export type SourceResolutionStatus = (typeof SOURCE_RESOLUTION_STATUSES)[number]

/** Data classification ordering used for the data-classification limit check. */
export const DATA_CLASSIFICATIONS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const
export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number]

const DATA_CLASSIFICATION_ORDER: Record<DataClassification, number> = {
  PUBLIC: 1,
  INTERNAL: 2,
  CONFIDENTIAL: 3,
  RESTRICTED: 4,
}

export function dataClassificationOrdinal(value: DataClassification): number {
  return DATA_CLASSIFICATION_ORDER[value]
}

export function isDataClassification(value: string): value is DataClassification {
  return value in DATA_CLASSIFICATION_ORDER
}
