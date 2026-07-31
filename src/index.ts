/**
 * @lapemo/organizational-graph
 *
 * The public package surface. Lapemo consumes domain logic from here rather than
 * copying it.
 */

// Versions
export {
  PACKAGE_VERSION,
  ONTOLOGY_VERSION,
  RULE_SET_VERSION,
  SCHEMA_VERSION,
  CONTEXT_CONTRACT_VERSION,
  VERSIONS,
} from './version.js'

// Canon surface
export {
  CANON_PROVENANCE,
  AUTONOMY_SPECTRUM,
  AUTONOMY_BASELINE,
  FRAMEWORK_LAYERS,
  VOICE_RULES,
  AXIOMS,
  SUPERVISORY_CONTROL_CAPACITY,
  autonomyOrdinal,
  autonomyName,
  isAutonomyLevelKey,
  requiresEarnedEvidence,
  type AutonomyLevelKey,
  type FrameworkLayer,
} from './canon/index.js'

// Domain types and enumerations
export * from './domain/enums/index.js'
export * from './domain/identity.js'
export * from './domain/nodes/index.js'
export * from './domain/edges/index.js'

// Ontology
export {
  RELATIONSHIP_CONTRACTS,
  relationshipContract,
  edgeTypesWithoutContract,
  projectedEdgeTypes,
  graphCanonicalEdgeTypes,
} from './domain/ontology/registry.js'
export {
  validateNode,
  validateEdge,
  validateEdgeSet,
  validateReferentialIntegrity,
  validateGraph,
  type OntologyViolation,
} from './domain/ontology/contracts.js'

// Temporal contracts
export {
  temporalContext,
  isValidAt,
  isKnownAt,
  isEffective,
  hasInvertedPeriod,
  periodsOverlap,
  closePredecessor,
  byMostRecentFirst,
  type TemporalContext,
  type TemporalFields,
} from './graph/temporal.js'

// Repository and query interfaces
export {
  asNodeType,
  type GraphRepository,
  type NodeQuery,
  type EdgeQuery,
} from './graph/repository.js'
export * from './graph/traversal.js'
export {
  GraphQueryService,
  type QueryScope,
  type AccountabilityAnswer,
  type PermissionExceedanceFinding,
  type LineageGap,
  type PostApprovalChange,
  type DecisionTrace,
} from './graph/queries.js'

// Authority evaluation
export {
  REASON_CODES,
  reasonCode,
  isRegisteredReasonCode,
  reasonCodesForRule,
  lapemoConditionKeyMap,
  type ReasonCodeDefinition,
  type ReasonCategory,
  type StatusImpact,
} from './authority/reason-codes.js'
export {
  PRIMARY_STATUSES,
  isBlocking,
  isConditional,
  isIndeterminate,
  isWarning,
  type PrimaryStatus,
  type FiredReason,
  type RequiredAction,
} from './authority/status.js'
export { STATUS_PRECEDENCE, resolvePrimaryStatus, decidingReason } from './authority/precedence.js'
export * from './authority/rules.js'
export { AuthorityEvaluator, type EvaluatorDependencies } from './authority/evaluator.js'
export type {
  EvaluationRequest,
  EvaluationResult,
  ResolvedContext,
  AuthorityRule,
  AuthorityLineage,
  DelegationLink,
  ReviewRequirementSource,
} from './authority/types.js'

// Evidence and confidence
export * from './evidence/completeness.js'
export * from './evidence/provenance.js'

// Adapters
export {
  InMemoryGraphRepository,
  type GraphDataset,
} from './adapters/memory/in-memory-repository.js'
export {
  StaticAutonomyCeilingProvider,
  type LapemoProjectionPort,
  type LapemoIntegrationPort,
  type AutonomyCeilingProvider,
  type AutonomyCeiling,
  type AutonomyCeilingInput,
  type SupervisoryLoadPort,
  type SupervisoryStructuralFacts,
  type ConditionFamilyPort,
  type IdentityResolutionPort,
} from './adapters/lapemo/contracts.js'
export {
  RISK_SCHEMES,
  mapNumberedTier,
  mapRetentionTierLiteral,
  riskSchemeMappingTable,
  RiskMappingError,
  type RiskScheme,
} from './adapters/lapemo/risk-mapping.js'
export {
  LEGACY_PLATFORM_AUTONOMY_VALUES,
  mapLegacyAutonomyValue,
  mapPlatformAutonomyOrdinal,
  isShiftedValue,
  autonomyMappingTable,
  AutonomyMappingError,
  type LegacyPlatformAutonomyValue,
} from './adapters/lapemo/autonomy-mapping.js'

// Organizational Context Services: versioned contract and deterministic assembly.
export * from './context/index.js'

// Synthetic fixtures
export * from './fixtures/procurement-scenario.js'
