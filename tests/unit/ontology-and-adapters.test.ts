import { describe, it, expect } from 'vitest'
import {
  RELATIONSHIP_CONTRACTS,
  relationshipContract,
  edgeTypesWithoutContract,
  lapemoOwnerFor,
} from '@/domain/ontology/registry.js'
import { validateGraph, validateNode, validateEdge, validateEdgeSet } from '@/domain/ontology/contracts.js'
import { EDGE_TYPES } from '@/domain/edges/index.js'
import type { GraphEdge } from '@/domain/edges/index.js'
import { REASON_CODES, reasonCode, lapemoConditionKeyMap } from '@/authority/reason-codes.js'
import { mapNumberedTier, mapRetentionTierLiteral, RiskMappingError } from '@/adapters/lapemo/risk-mapping.js'
import {
  mapLegacyAutonomyValue,
  mapPlatformAutonomyOrdinal,
  isShiftedValue,
  AutonomyMappingError,
} from '@/adapters/lapemo/autonomy-mapping.js'
import { AUTONOMY_SPECTRUM, AUTONOMY_BASELINE, autonomyOrdinal, requiresEarnedEvidence } from '@/canon/index.js'
import { propagateConfidence, applySourcePenalty, compareProvenance } from '@/evidence/provenance.js'
import { assessEvidenceCompleteness } from '@/evidence/completeness.js'
import { validateResponseEnvelope, validateContextRequest } from '@/context/schemas.js'
import { procurementScenario, fullyCompliant } from '@/fixtures/procurement-scenario.js'
import type { InformationAssetNode, RequiredInformationClass } from '@/domain/nodes/index.js'

describe('Ontology registry', () => {
  it('registers a contract for every declared edge type', () => {
    expect(edgeTypesWithoutContract()).toEqual([])
  })

  it('declares no contract for an unregistered edge type', () => {
    expect(RELATIONSHIP_CONTRACTS.length).toBe(EDGE_TYPES.length)
  })

  it('gives every edge type exactly one canonical direction statement', () => {
    for (const contract of RELATIONSHIP_CONTRACTS) {
      expect(contract.direction.length).toBeGreaterThan(0)
      expect(contract.allowedSourceTypes.length).toBeGreaterThan(0)
      expect(contract.allowedTargetTypes.length).toBeGreaterThan(0)
    }
  })

  it('declares no reversed alias for any relationship', () => {
    const reversedAliases = ['OWNED_BY', 'PARENT_OF', 'SUPERVISED_BY', 'GRANTED_BY']
    for (const alias of reversedAliases) {
      expect(EDGE_TYPES as readonly string[]).not.toContain(alias)
    }
  })

  it('resolves ownership per source type, not per edge type', () => {
    // COVERS is the case that proves this matters: graph canonical from an
    // authority grant, a Lapemo projection from a control.
    expect(lapemoOwnerFor('COVERS', 'AuthorityGrant')).toBeNull()
    expect(lapemoOwnerFor('COVERS', 'Control')).not.toBeNull()
  })

  it('throws for an unregistered edge type rather than returning a default', () => {
    expect(() => relationshipContract('NOT_A_REAL_EDGE' as never)).toThrow()
  })
})

function edge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: 'e-1',
    organizationId: 'org-1',
    edgeType: 'SUPERVISES',
    fromNodeType: 'Person',
    fromLogicalId: 'p-1',
    toNodeType: 'Agent',
    toLogicalId: 'a-1',
    status: 'ACTIVE',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    recordedFrom: '2026-01-01T00:00:00.000Z',
    recordedTo: null,
    supersedesVersionId: null,
    confidence: 1,
    sourceRef: null,
    evidenceObjectLogicalId: null,
    metadata: {},
    isProjection: true,
    ...overrides,
  }
}

describe('Ontology validation', () => {
  it('accepts the base procurement fixture', () => {
    const dataset = procurementScenario()
    expect(validateGraph(dataset.nodes, dataset.edges)).toEqual([])
  })

  it('accepts the fully compliant fixture', () => {
    const dataset = fullyCompliant()
    expect(validateGraph(dataset.nodes, dataset.edges)).toEqual([])
  })

  it('rejects an edge whose source type the contract forbids', () => {
    const violations = validateEdge(edge({ fromNodeType: 'Agent' }))
    expect(violations.map((v) => v.code)).toContain('EDGE_BAD_SOURCE_TYPE')
  })

  it('rejects an edge whose target type the contract forbids', () => {
    const violations = validateEdge(edge({ toNodeType: 'Policy' }))
    expect(violations.map((v) => v.code)).toContain('EDGE_BAD_TARGET_TYPE')
  })

  it('requires a Lapemo-owned relationship to be marked as a projection', () => {
    const violations = validateEdge(edge({ isProjection: false }))
    expect(violations.map((v) => v.code)).toContain('EDGE_SHOULD_BE_PROJECTION')
  })

  it('rejects a graph-canonical edge that falsely claims to be a projection', () => {
    const violations = validateEdge(
      edge({ edgeType: 'GRANTS', fromNodeType: 'Person', toNodeType: 'AuthorityGrant', isProjection: true, evidenceObjectLogicalId: 'ev-1' }),
    )
    expect(violations.map((v) => v.code)).toContain('EDGE_FALSE_PROJECTION')
  })

  it('requires evidence on an edge whose contract demands it', () => {
    const violations = validateEdge(
      edge({ edgeType: 'GRANTS', fromNodeType: 'Person', toNodeType: 'AuthorityGrant', isProjection: false }),
    )
    expect(violations.map((v) => v.code)).toContain('EDGE_MISSING_EVIDENCE')
  })

  it('rejects an unscoped edge', () => {
    expect(validateEdge(edge({ organizationId: '' })).map((v) => v.code)).toContain('EDGE_UNSCOPED')
  })

  it('rejects confidence outside the zero to one scale', () => {
    expect(validateEdge(edge({ confidence: 1.5 })).map((v) => v.code)).toContain('EDGE_CONFIDENCE_OUT_OF_RANGE')
  })

  it('detects a cardinality violation across overlapping periods', () => {
    const a = edge({ id: 'e-a' })
    const b = edge({ id: 'e-b', fromLogicalId: 'p-2' })
    const violations = validateEdgeSet([a, b])
    expect(violations.map((v) => v.code)).toContain('EDGE_CARDINALITY_VIOLATION')
  })

  it('permits successive non-overlapping edges under a single-inbound rule', () => {
    const a = edge({ id: 'e-a', effectiveTo: '2026-06-01T00:00:00.000Z' })
    const b = edge({ id: 'e-b', fromLogicalId: 'p-2', effectiveFrom: '2026-06-01T00:00:00.000Z' })
    expect(validateEdgeSet([a, b])).toEqual([])
  })

  it('rejects a first version that claims to supersede something', () => {
    const dataset = procurementScenario()
    const first = dataset.nodes[0]
    if (first === undefined) throw new Error('fixture is empty')
    const broken = { ...first, supersedesVersionId: 'phantom' }
    expect(validateNode(broken).map((v) => v.code)).toContain('NODE_FIRST_VERSION_SUPERSEDES')
  })

  it('rejects a later version with no supersede lineage', () => {
    const dataset = procurementScenario()
    const first = dataset.nodes[0]
    if (first === undefined) throw new Error('fixture is empty')
    const broken = { ...first, versionNumber: 2, supersedesVersionId: null }
    expect(validateNode(broken).map((v) => v.code)).toContain('NODE_MISSING_SUPERSEDE_LINEAGE')
  })

  it('rejects an authority grant that comes from nowhere', () => {
    const dataset = procurementScenario()
    const grant = dataset.nodes.find((n) => n.nodeType === 'AuthorityGrant')
    if (grant === undefined || grant.nodeType !== 'AuthorityGrant') throw new Error('fixture defect')
    const broken = { ...grant, derivedFromGrantLogicalId: null, organizationalSource: null }
    expect(validateNode(broken).map((v) => v.code)).toContain('GRANT_NO_AUTHORITY_SOURCE')
  })

  it('rejects an authority grant issued to a system', () => {
    const dataset = procurementScenario()
    const grant = dataset.nodes.find((n) => n.nodeType === 'AuthorityGrant')
    if (grant === undefined || grant.nodeType !== 'AuthorityGrant') throw new Error('fixture defect')
    const broken = { ...grant, grantee: { actorType: 'System' as const, logicalId: 'sys-1' } }
    expect(validateNode(broken).map((v) => v.code)).toContain('GRANT_TO_SYSTEM')
  })

  it('detects a dangling edge endpoint', () => {
    const dataset = procurementScenario()
    const withDangling = [...dataset.edges, edge({ id: 'e-dangle', organizationId: dataset.nodes[0]?.organizationId ?? 'org-1', fromLogicalId: 'ghost' })]
    const violations = validateGraph(dataset.nodes, withDangling)
    expect(violations.map((v) => v.code)).toContain('EDGE_DANGLING_SOURCE')
  })
})

describe('Reason-code registry', () => {
  it('gives every reason code a clearing predicate', () => {
    for (const definition of REASON_CODES) {
      expect(definition.clearingPredicateId.length).toBeGreaterThan(0)
      expect(definition.clearingPredicate.length).toBeGreaterThan(20)
    }
  })

  it('uses a unique code for every entry', () => {
    const codes = REASON_CODES.map((r) => r.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('uses a unique clearing-predicate identifier for every entry', () => {
    const ids = REASON_CODES.map((r) => r.clearingPredicateId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('registers FINANCIAL_LIMIT_EXCEEDED as a blocking authority condition', () => {
    const definition = reasonCode('FINANCIAL_LIMIT_EXCEEDED')
    expect(definition.ruleId).toBe('AUTH-003')
    expect(definition.statusImpact).toBe('BLOCKING')
    expect(definition.category).toBe('AUTHORITY')
    expect(definition.clearingPredicate).toContain('financialLimit')
  })

  it('throws for an unregistered code rather than inventing one', () => {
    expect(() => reasonCode('MADE_UP_CODE')).toThrow()
  })

  it('maps reasons onto Lapemo condition families where the platform owns one', () => {
    const map = lapemoConditionKeyMap()
    expect(map.UNOWNED_AGENT).toBe('ownership.entity_unowned')
    expect(map.UNSUPERVISED_AGENT).toBe('agent.lost_supervision')
    expect(map.AUTONOMY_EXCEEDS_DECISION_LIMIT).toBe('governance.autonomy_exceeds_ceiling')
  })

  it('leaves genuinely new conditions unmapped rather than forcing a family', () => {
    expect(reasonCode('FINANCIAL_LIMIT_EXCEEDED').lapemoConditionKey).toBeNull()
    expect(reasonCode('INVALID_DELEGATION_CHAIN').lapemoConditionKey).toBeNull()
  })
})

describe('Canon autonomy surface', () => {
  it('carries the five canonical levels in canonical order', () => {
    expect(AUTONOMY_SPECTRUM.map((l) => l.name)).toEqual([
      'Human Only',
      'Human Approved',
      'Agent Assisted',
      'Agent Supervised',
      'Agent Autonomous',
    ])
  })

  it('never contains Agent Autonomous Plus', () => {
    const keys = AUTONOMY_SPECTRUM.map((l) => l.key as string)
    expect(keys).not.toContain('AGENT_AUTONOMOUS_PLUS')
  })

  it('treats Agent Assisted as the canonical baseline', () => {
    expect(AUTONOMY_BASELINE).toBe('AGENT_ASSISTED')
    expect(autonomyOrdinal(AUTONOMY_BASELINE)).toBe(3)
  })

  it('requires earned evidence only above the baseline', () => {
    expect(requiresEarnedEvidence('HUMAN_ONLY')).toBe(false)
    expect(requiresEarnedEvidence('AGENT_ASSISTED')).toBe(false)
    expect(requiresEarnedEvidence('AGENT_SUPERVISED')).toBe(true)
    expect(requiresEarnedEvidence('AGENT_AUTONOMOUS')).toBe(true)
  })
})

describe('Autonomy boundary mapping', () => {
  it('maps the shifted platform value onto the correct canonical level', () => {
    // The platform name says autonomous. Canon position four says supervised.
    expect(mapLegacyAutonomyValue('AGENT_AUTONOMOUS')).toBe('AGENT_SUPERVISED')
    expect(mapLegacyAutonomyValue('AGENT_AUTONOMOUS_PLUS')).toBe('AGENT_AUTONOMOUS')
  })

  it('maps the unshifted platform values unchanged', () => {
    expect(mapLegacyAutonomyValue('HUMAN_ONLY')).toBe('HUMAN_ONLY')
    expect(mapLegacyAutonomyValue('HUMAN_APPROVED')).toBe('HUMAN_APPROVED')
    expect(mapLegacyAutonomyValue('AGENT_ASSISTED')).toBe('AGENT_ASSISTED')
  })

  it('flags exactly the two values whose names misdescribe them', () => {
    expect(isShiftedValue('AGENT_AUTONOMOUS')).toBe(true)
    expect(isShiftedValue('AGENT_AUTONOMOUS_PLUS')).toBe(true)
    expect(isShiftedValue('AGENT_ASSISTED')).toBe(false)
  })

  it('maps the numeric platform column by canonical position', () => {
    expect(mapPlatformAutonomyOrdinal(4)).toBe('AGENT_SUPERVISED')
    expect(mapPlatformAutonomyOrdinal(5)).toBe('AGENT_AUTONOMOUS')
  })

  it('throws on an unknown value rather than guessing', () => {
    expect(() => mapLegacyAutonomyValue('AGENT_SUPERVISED')).toThrow(AutonomyMappingError)
    expect(() => mapPlatformAutonomyOrdinal(6)).toThrow(AutonomyMappingError)
  })
})

describe('Risk scheme mapping', () => {
  it('maps the retention scheme where tier one is most severe', () => {
    expect(mapNumberedTier('RETENTION_TIER', 1)).toBe('CRITICAL')
    expect(mapNumberedTier('RETENTION_TIER', 3)).toBe('MODERATE')
  })

  it('maps the classification scheme where tier one is least severe', () => {
    expect(mapNumberedTier('CLASSIFICATION_TIER', 1)).toBe('LOW')
    expect(mapNumberedTier('CLASSIFICATION_TIER', 4)).toBe('CRITICAL')
  })

  it('gives tier one opposite meanings in the two schemes, which is the whole point', () => {
    expect(mapNumberedTier('RETENTION_TIER', 1)).not.toBe(mapNumberedTier('CLASSIFICATION_TIER', 1))
  })

  it('maps the platform enum literal', () => {
    expect(mapRetentionTierLiteral('TIER_1')).toBe('CRITICAL')
  })

  it('throws for a tier that does not exist in the named scheme', () => {
    expect(() => mapNumberedTier('RETENTION_TIER', 4)).toThrow(RiskMappingError)
    expect(() => mapNumberedTier('CLASSIFICATION_TIER', 5)).toThrow(RiskMappingError)
  })

  it('throws for an unnamed or invalid scheme rather than defaulting to one', () => {
    // The integration boundary receives values TypeScript never checked (JSON,
    // a database row, external config). A caller that fails to name a real
    // scheme must never silently fall through to CLASSIFICATION_TIER.
    expect(() => mapNumberedTier(undefined as unknown as never, 1)).toThrow(RiskMappingError)
    expect(() => mapNumberedTier('' as never, 1)).toThrow(RiskMappingError)
    expect(() => mapNumberedTier('BOGUS_SCHEME' as never, 1)).toThrow(RiskMappingError)
    expect(() => mapNumberedTier('retention_tier' as never, 1)).toThrow(RiskMappingError)
  })
})

describe('Confidence and provenance', () => {
  it('propagates the minimum along the path', () => {
    expect(propagateConfidence([0.9, 0.4, 0.8])).toBe(0.4)
  })

  it('returns full confidence for an empty path', () => {
    expect(propagateConfidence([])).toBe(1)
  })

  it('penalizes an unconfirmed source identity', () => {
    const penalized = applySourcePenalty(1, {
      sourceSystem: 'lapemo',
      sourceRecordId: 'x',
      sourceRecordedAt: null,
      resolutionStatus: 'PROPOSED',
    })
    expect(penalized).toBeLessThan(1)
  })

  it('leaves a confirmed source identity untouched', () => {
    const value = applySourcePenalty(0.9, {
      sourceSystem: 'lapemo',
      sourceRecordId: 'x',
      sourceRecordedAt: null,
      resolutionStatus: 'CONFIRMED',
    })
    expect(value).toBe(0.9)
  })

  it('zeroes confidence for a rejected identity mapping', () => {
    const value = applySourcePenalty(0.9, {
      sourceSystem: 'lapemo',
      sourceRecordId: 'x',
      sourceRecordedAt: null,
      resolutionStatus: 'REJECTED',
    })
    expect(value).toBe(0)
  })

  it('lets an artifact with lineage outrank a fresher copy without lineage', () => {
    const withLineage = { hasLineage: true, observedAt: '2026-01-01T00:00:00.000Z', confidence: 0.7 }
    const withoutLineage = { hasLineage: false, observedAt: '2026-06-01T00:00:00.000Z', confidence: 0.99 }
    expect(compareProvenance(withLineage, withoutLineage)).toBeLessThan(0)
  })
})

function asset(overrides: Partial<InformationAssetNode> = {}): InformationAssetNode {
  return {
    logicalId: 'ia-1',
    versionId: 'ia-1#v1',
    versionNumber: 1,
    versionIdOrigin: 'GRAPH_NATIVE',
    sourceRef: null,
    nodeType: 'InformationAsset',
    organizationId: 'org-1',
    status: 'ACTIVE',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    recordedFrom: '2026-01-01T00:00:00.000Z',
    recordedTo: null,
    supersedesVersionId: null,
    confidence: 1,
    evidenceRefs: [],
    name: 'asset',
    informationClassId: 'class-a',
    classification: 'INTERNAL',
    permittedUse: [],
    authoritativeFor: ['class-a'],
    observedAt: '2026-03-01T00:00:00.000Z',
    staleAfterDays: 30,
    integrityState: 'VERIFIED',
    knowledgeObjectRef: null,
    ...overrides,
  }
}

const required: RequiredInformationClass = {
  classId: 'class-a',
  description: 'test class',
  mustBeAuthoritative: true,
  maxAgeDays: 30,
  maxDataClassification: 'CONFIDENTIAL',
}

describe('Evidence completeness', () => {
  const at = '2026-03-15T00:00:00.000Z'

  it('reports full completeness when nothing is required', () => {
    const result = assessEvidenceCompleteness([], [], at, null)
    expect(result.completenessRatio).toBe(1)
    expect(result.gaps).toEqual([])
  })

  it('reports ABSENT when the class is not supplied at all', () => {
    const result = assessEvidenceCompleteness([required], [], at, null)
    expect(result.gaps[0]?.kind).toBe('ABSENT')
  })

  it('reports NOT_AUTHORITATIVE when the asset is not authoritative for the class', () => {
    const result = assessEvidenceCompleteness([required], [asset({ authoritativeFor: [] })], at, null)
    expect(result.gaps[0]?.kind).toBe('NOT_AUTHORITATIVE')
  })

  it('reports STALE beyond the freshness policy', () => {
    const result = assessEvidenceCompleteness([required], [asset({ observedAt: '2026-01-01T00:00:00.000Z' })], at, null)
    expect(result.gaps[0]?.kind).toBe('STALE')
  })

  it('reports CLASSIFICATION_NOT_PERMITTED above the grant ceiling', () => {
    const result = assessEvidenceCompleteness([required], [asset({ classification: 'RESTRICTED' })], at, 'INTERNAL')
    expect(result.gaps[0]?.kind).toBe('CLASSIFICATION_NOT_PERMITTED')
  })

  it('satisfies the class when one asset clears every check', () => {
    const result = assessEvidenceCompleteness([required], [asset()], at, null)
    expect(result.gaps).toEqual([])
    expect(result.satisfiedClassCount).toBe(1)
  })

  it('accepts a satisfying asset even when a failing candidate is also present', () => {
    const result = assessEvidenceCompleteness([required], [asset({ logicalId: 'bad', authoritativeFor: [] }), asset()], at, null)
    expect(result.gaps).toEqual([])
  })

  it('applies the tighter of the asset and required-class freshness limits', () => {
    const strict: RequiredInformationClass = { ...required, maxAgeDays: 5 }
    const result = assessEvidenceCompleteness([strict], [asset({ staleAfterDays: 365 })], at, null)
    expect(result.gaps[0]?.kind).toBe('STALE')
  })
})

describe('Organizational Context Services contracts', () => {
  const envelope = {
    asOf: '2026-03-15T00:00:00.000Z',
    organizationId: 'org-1',
    ontologyVersion: '0.1.0',
    ruleSetVersion: '0.1.0',
    schemaVersion: '0.1.0',
    contextContractVersion: '0.1.0',
    confidence: 0.9,
    stalenessIndicators: [],
    evidenceRefs: [],
    readOnly: true as const,
  }

  it('accepts a well-formed envelope', () => {
    expect(validateResponseEnvelope(envelope).valid).toBe(true)
  })

  it('requires every response to be temporal', () => {
    const result = validateResponseEnvelope({ ...envelope, asOf: 'not-a-date' })
    expect(result.issues.map((i) => i.path)).toContain('asOf')
  })

  it('requires every response to be organization-scoped', () => {
    const result = validateResponseEnvelope({ ...envelope, organizationId: '' })
    expect(result.issues.map((i) => i.path)).toContain('organizationId')
  })

  it('requires every response to be versioned', () => {
    const result = validateResponseEnvelope({ ...envelope, ontologyVersion: '' })
    expect(result.issues.map((i) => i.path)).toContain('ontologyVersion')
  })

  it('requires every response to be read-only', () => {
    const result = validateResponseEnvelope({ ...envelope, readOnly: false as unknown as true })
    expect(result.issues.map((i) => i.path)).toContain('readOnly')
  })

  it('requires organization scope on every request', () => {
    expect(validateContextRequest({ organizationId: '' }).valid).toBe(false)
    expect(validateContextRequest({ organizationId: 'org-1' }).valid).toBe(true)
  })
})
