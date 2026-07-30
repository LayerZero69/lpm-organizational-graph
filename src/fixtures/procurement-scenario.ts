/**
 * The synthetic procurement scenario.
 *
 * Entirely fabricated. No real organization, person, vendor, system or amount
 * appears anywhere in this file.
 *
 * The scenario is built as a base dataset plus explicit named variants. Each
 * variant states exactly what it changes, so an acceptance test never has to
 * mutate a shared object and no test can silently depend on another test's edit.
 *
 * Nothing here encodes an expected result. The evaluator reaches its conclusions
 * from this data by traversal, temporal checks and the rules.
 */

import type { GraphNode } from '../domain/nodes/index.js'
import type { GraphEdge, EdgeType } from '../domain/edges/index.js'
import type { GraphDataset } from '../adapters/memory/in-memory-repository.js'
import type { NodeType, AutonomyLevelKey } from '../domain/enums/index.js'
import { fixtureVersionId } from '../domain/identity.js'
import type { AutonomyCeiling } from '../adapters/lapemo/contracts.js'
import { StaticAutonomyCeilingProvider } from '../adapters/lapemo/contracts.js'

// ── Fixed timeline. Deterministic, never derived from the clock. ─────────────
export const T = {
  organizationFounded: '2026-01-01T00:00:00.000Z',
  authorityIssued: '2026-02-01T00:00:00.000Z',
  agentActivated: '2026-02-01T00:00:00.000Z',
  vendorRecordObserved: '2026-03-01T00:00:00.000Z',
  decisionMade: '2026-03-15T14:30:00.000Z',
  limitRaised: '2026-06-01T00:00:00.000Z',
  laterEvaluation: '2026-07-15T00:00:00.000Z',
  agentReviewDue: '2027-01-01T00:00:00.000Z',
} as const

export const ORG = 'org-northwind-trading'

// ── Logical identifiers ─────────────────────────────────────────────────────
export const ID = {
  organization: 'org-northwind-trading',
  boardChair: 'person-alice-nakamura',
  cfo: 'person-marcus-reed',
  procurementDirector: 'person-dana-whitfield',
  roleBoardChair: 'role-board-chair',
  roleCfo: 'role-chief-financial-officer',
  roleProcurementDirector: 'role-procurement-director',
  agent: 'agent-procurement-approval',
  decisionType: 'decision-type-vendor-purchase-approval',
  grantRoot: 'grant-board-to-cfo',
  grantDirector: 'grant-cfo-to-director',
  grantAgent: 'grant-director-to-agent',
  autonomyState: 'autonomy-state-procurement-agent',
  erp: 'system-erp',
  erpPermission: 'permission-erp-approve-purchase-order',
  vendorMasterRecord: 'info-vendor-master-record',
  vendorRiskClassification: 'info-vendor-risk-classification',
  policy: 'policy-procurement-authority',
  control: 'control-procurement-spend-review',
  decisionEvent: 'decision-event-vendor-42000',
  actionEvent: 'action-event-erp-purchase-order',
  outcome: 'outcome-vendor-purchase',
  evidenceBoardResolution: 'evidence-board-resolution-2026',
  evidenceDelegationMatrix: 'evidence-delegation-of-authority-matrix',
  evidenceAgentMemo: 'evidence-agent-authorization-memo',
  evidenceGateClearance: 'evidence-gate-clearance-procurement',
} as const

/** The information class the decision type requires and the base scenario lacks. */
export const VENDOR_RISK_CLASS = 'vendor.risk_classification'
export const VENDOR_MASTER_CLASS = 'vendor.master_record'
export const ACTION_APPROVE_PURCHASE = 'APPROVE_PURCHASE'

// ── Builders ────────────────────────────────────────────────────────────────

interface BaseOptions {
  effectiveFrom?: string
  effectiveTo?: string | null
  versionNumber?: number
  supersedesVersionId?: string | null
  confidence?: number
}

function base(logicalId: string, nodeType: NodeType, options: BaseOptions = {}) {
  const versionNumber = options.versionNumber ?? 1
  return {
    logicalId,
    versionId: fixtureVersionId(logicalId, versionNumber),
    versionNumber,
    versionIdOrigin: 'GRAPH_NATIVE' as const,
    sourceRef: null,
    nodeType,
    organizationId: ORG,
    status: 'ACTIVE' as const,
    effectiveFrom: options.effectiveFrom ?? T.organizationFounded,
    effectiveTo: options.effectiveTo ?? null,
    recordedFrom: options.effectiveFrom ?? T.organizationFounded,
    recordedTo: null,
    supersedesVersionId: options.supersedesVersionId ?? null,
    confidence: options.confidence ?? 1,
    evidenceRefs: [],
  }
}

interface EdgeOptions {
  effectiveFrom?: string
  effectiveTo?: string | null
  evidence?: string | null
  confidence?: number
}

function edge(
  id: string,
  edgeType: EdgeType,
  from: [NodeType, string],
  to: [NodeType, string],
  isProjection: boolean,
  options: EdgeOptions = {},
): GraphEdge {
  return {
    id,
    organizationId: ORG,
    edgeType,
    fromNodeType: from[0],
    fromLogicalId: from[1],
    toNodeType: to[0],
    toLogicalId: to[1],
    status: 'ACTIVE',
    effectiveFrom: options.effectiveFrom ?? T.organizationFounded,
    effectiveTo: options.effectiveTo ?? null,
    recordedFrom: options.effectiveFrom ?? T.organizationFounded,
    recordedTo: null,
    supersedesVersionId: null,
    confidence: options.confidence ?? 1,
    sourceRef: null,
    evidenceObjectLogicalId: options.evidence ?? null,
    metadata: {},
    isProjection,
  }
}

// ── The base dataset ────────────────────────────────────────────────────────

function baseNodes(): GraphNode[] {
  return [
    { ...base(ID.organization, 'Organization'), nodeType: 'Organization', name: 'Northwind Trading' },

    { ...base(ID.boardChair, 'Person'), nodeType: 'Person', displayName: 'Alice Nakamura', title: 'Board Chair', isActive: true },
    { ...base(ID.cfo, 'Person'), nodeType: 'Person', displayName: 'Marcus Reed', title: 'Chief Financial Officer', isActive: true },
    { ...base(ID.procurementDirector, 'Person'), nodeType: 'Person', displayName: 'Dana Whitfield', title: 'Procurement Director', isActive: true },

    { ...base(ID.roleBoardChair, 'Role'), nodeType: 'Role', name: 'Board Chair' },
    { ...base(ID.roleCfo, 'Role'), nodeType: 'Role', name: 'Chief Financial Officer' },
    { ...base(ID.roleProcurementDirector, 'Role'), nodeType: 'Role', name: 'Procurement Director' },

    {
      ...base(ID.agent, 'Agent', { effectiveFrom: T.agentActivated }),
      nodeType: 'Agent',
      name: 'Procurement Approval Agent',
      businessPurpose: 'Review and approve routine vendor purchase requests within delegated financial authority.',
      agentKind: 'WORKFLOW_APPROVAL',
      riskLevel: 'HIGH',
      lifecycleState: 'ACTIVE',
      modelProvider: 'synthetic-provider',
      modelIdentifier: 'synthetic-approval-model',
      modelVersion: '2.1.0',
      activatedAt: T.agentActivated,
      lastReviewedAt: T.agentActivated,
      reviewDueAt: T.agentReviewDue,
      retiredAt: null,
    },

    {
      ...base(ID.decisionType, 'DecisionType'),
      nodeType: 'DecisionType',
      name: 'Vendor Purchase Approval',
      domain: 'Procurement',
      allowedActorClasses: ['Person', 'Agent'],
      actionVocabulary: [ACTION_APPROVE_PURCHASE, 'REJECT_PURCHASE', 'ESCALATE_PURCHASE'],
      riskLevel: 'MODERATE',
      humanReviewConditions: [
        {
          conditionId: 'new-vendor-requires-review',
          description: 'Purchases involving a vendor with no prior trading history require human review.',
          contextKey: 'newVendor',
          equals: true,
        },
      ],
      requiredInformationClasses: [
        {
          classId: VENDOR_RISK_CLASS,
          description: 'Current vendor risk classification from the authoritative vendor risk register.',
          mustBeAuthoritative: true,
          maxAgeDays: 365,
          maxDataClassification: 'CONFIDENTIAL',
        },
      ],
      permittedSystemLogicalIds: [ID.erp],
      escalationPersonLogicalId: ID.procurementDirector,
      governingPolicyLogicalIds: [ID.policy],
      governingControlLogicalIds: [ID.control],
    },

    // Authority chain: board resolution, to CFO, to director, to governed agent.
    {
      ...base(ID.grantRoot, 'AuthorityGrant', { effectiveFrom: T.authorityIssued }),
      nodeType: 'AuthorityGrant',
      grantType: 'ORGANIZATIONAL_SOURCE',
      grantor: { actorType: 'Person', logicalId: ID.boardChair },
      grantee: { actorType: 'Person', logicalId: ID.cfo },
      decisionTypeLogicalId: ID.decisionType,
      allowedActions: [ACTION_APPROVE_PURCHASE, 'REJECT_PURCHASE', 'ESCALATE_PURCHASE'],
      prohibitedActions: [],
      financialLimit: { amount: 5_000_000, currency: 'USD' },
      riskLimit: 'CRITICAL',
      dataClassificationLimit: 'RESTRICTED',
      systemScope: null,
      geographicScope: null,
      conditions: [],
      humanReviewRequired: false,
      revocation: null,
      governingPolicyLogicalId: ID.policy,
      derivedFromGrantLogicalId: null,
      organizationalSource: 'BOARD_RESOLUTION',
    },
    {
      ...base(ID.grantDirector, 'AuthorityGrant', { effectiveFrom: T.authorityIssued }),
      nodeType: 'AuthorityGrant',
      grantType: 'DELEGATED',
      grantor: { actorType: 'Person', logicalId: ID.cfo },
      grantee: { actorType: 'Person', logicalId: ID.procurementDirector },
      decisionTypeLogicalId: ID.decisionType,
      allowedActions: [ACTION_APPROVE_PURCHASE, 'REJECT_PURCHASE', 'ESCALATE_PURCHASE'],
      prohibitedActions: [],
      financialLimit: { amount: 250_000, currency: 'USD' },
      riskLimit: 'HIGH',
      dataClassificationLimit: 'CONFIDENTIAL',
      systemScope: null,
      geographicScope: null,
      conditions: [],
      humanReviewRequired: false,
      revocation: null,
      governingPolicyLogicalId: ID.policy,
      derivedFromGrantLogicalId: ID.grantRoot,
      organizationalSource: null,
    },
    {
      ...base(ID.grantAgent, 'AuthorityGrant', { effectiveFrom: T.authorityIssued }),
      nodeType: 'AuthorityGrant',
      grantType: 'DELEGATED',
      grantor: { actorType: 'Person', logicalId: ID.procurementDirector },
      grantee: { actorType: 'Agent', logicalId: ID.agent },
      decisionTypeLogicalId: ID.decisionType,
      allowedActions: [ACTION_APPROVE_PURCHASE],
      prohibitedActions: [],
      // The governed agent may approve purchases up to twenty five thousand.
      financialLimit: { amount: 25_000, currency: 'USD' },
      riskLimit: 'HIGH',
      dataClassificationLimit: 'CONFIDENTIAL',
      systemScope: [ID.erp],
      geographicScope: null,
      conditions: ['Escalate any purchase involving a vendor with no prior trading history.'],
      humanReviewRequired: false,
      revocation: null,
      governingPolicyLogicalId: ID.policy,
      derivedFromGrantLogicalId: ID.grantDirector,
      organizationalSource: null,
    },

    // Autonomy: the canonical baseline, granted by the business owner.
    {
      ...base(ID.autonomyState, 'AutonomyState', { effectiveFrom: T.agentActivated }),
      nodeType: 'AutonomyState',
      agentLogicalId: ID.agent,
      decisionTypeLogicalId: ID.decisionType,
      level: 'AGENT_ASSISTED',
      gateClearanceEvidenceRef: null,
      grantingBusinessOwnerPersonId: ID.procurementDirector,
    },

    { ...base(ID.erp, 'EnterpriseSystem'), nodeType: 'EnterpriseSystem', name: 'Enterprise Resource Planning', systemClass: 'ERP' },

    // The technical permission the ERP actually honors, which is far wider than
    // the organizational authority the governed agent holds.
    {
      ...base(ID.erpPermission, 'SystemPermission', { effectiveFrom: T.agentActivated }),
      nodeType: 'SystemPermission',
      principal: { actorType: 'Agent', logicalId: ID.agent },
      enterpriseSystemLogicalId: ID.erp,
      permissionIdentifier: 'erp.purchase_order.approve',
      permittedActions: [ACTION_APPROVE_PURCHASE],
      resourceScope: ['purchase_orders'],
      functionScope: ['approve'],
      dataScope: ['vendor', 'purchase_order'],
      financialLimit: { amount: 100_000, currency: 'USD' },
      volumeLimit: null,
      transactionLimit: null,
      technicalGrantor: 'erp-admin-group',
      sourceConnector: 'synthetic-erp-connector',
      revoked: false,
      lastSynchronizedAt: T.vendorRecordObserved,
      stalenessState: 'FRESH',
    },

    {
      ...base(ID.vendorMasterRecord, 'InformationAsset', { effectiveFrom: T.vendorRecordObserved }),
      nodeType: 'InformationAsset',
      name: 'Vendor master record',
      informationClassId: VENDOR_MASTER_CLASS,
      classification: 'INTERNAL',
      permittedUse: ['procurement'],
      authoritativeFor: [VENDOR_MASTER_CLASS],
      observedAt: T.vendorRecordObserved,
      staleAfterDays: 365,
      integrityState: 'VERIFIED',
      knowledgeObjectRef: null,
    },

    {
      ...base(ID.policy, 'Policy'),
      nodeType: 'Policy',
      name: 'Procurement Authority Policy',
      appliesToDecisionTypeLogicalIds: [ID.decisionType],
      requirements: {
        humanReviewRequired: true,
        maxFinancialAmount: { amount: 250_000, currency: 'USD' },
        prohibitedActions: [],
      },
      precedenceRank: 10,
    },

    {
      ...base(ID.control, 'Control'),
      nodeType: 'Control',
      name: 'Procurement Spend Review',
      riskLevel: 'HIGH',
      appliesToDecisionTypeLogicalIds: [ID.decisionType],
      ownerPersonLogicalId: ID.procurementDirector,
      nextReviewAt: T.agentReviewDue,
    },

    {
      ...base(ID.decisionEvent, 'DecisionEvent', { effectiveFrom: T.decisionMade }),
      nodeType: 'DecisionEvent',
      decisionTypeLogicalId: ID.decisionType,
      initiatingActor: { actorType: 'Agent', logicalId: ID.agent },
      finalActor: { actorType: 'Agent', logicalId: ID.agent },
      accountablePersonLogicalId: ID.procurementDirector,
      businessContext: 'Purchase request from a vendor with no prior trading history.',
      requestedAction: ACTION_APPROVE_PURCHASE,
      // Forty two thousand, against a twenty five thousand authority limit.
      financialAmount: { amount: 42_000, currency: 'USD' },
      riskLevel: 'MODERATE',
      dataClassification: 'INTERNAL',
      geography: null,
      targetSystemLogicalIds: [ID.erp],
      context: { newVendor: true },
      humanReview: { performed: false, reviewerPersonLogicalId: null, reviewedAt: null },
      decidedAt: T.decisionMade,
      executedAt: null,
      expectedOutcome: 'Purchase order approved and issued to the vendor.',
      actualOutcomeLogicalId: null,
      correlationId: 'corr-procurement-42000',
      source: 'synthetic-fixture',
    },

    {
      ...base(ID.evidenceBoardResolution, 'EvidenceObject', { effectiveFrom: T.authorityIssued }),
      nodeType: 'EvidenceObject',
      evidenceType: 'BOARD_RESOLUTION',
      evidentiaryPurpose: 'Establishes the organizational source of financial approval authority.',
      issuedAt: T.authorityIssued,
      integrityState: 'VERIFIED',
      knowledgeObjectRef: null,
      retentionExpiresAt: null,
    },
    {
      ...base(ID.evidenceDelegationMatrix, 'EvidenceObject', { effectiveFrom: T.authorityIssued }),
      nodeType: 'EvidenceObject',
      evidenceType: 'DELEGATION_OF_AUTHORITY_MATRIX',
      evidentiaryPurpose: 'Records the approved delegation of purchase approval authority.',
      issuedAt: T.authorityIssued,
      integrityState: 'VERIFIED',
      knowledgeObjectRef: null,
      retentionExpiresAt: null,
    },
    {
      ...base(ID.evidenceAgentMemo, 'EvidenceObject', { effectiveFrom: T.authorityIssued }),
      nodeType: 'EvidenceObject',
      evidenceType: 'AUTHORIZATION_MEMO',
      evidentiaryPurpose: 'Records the delegation of bounded purchase authority to the governed agent.',
      issuedAt: T.authorityIssued,
      integrityState: 'VERIFIED',
      knowledgeObjectRef: null,
      retentionExpiresAt: null,
    },
  ]
}

function baseEdges(): GraphEdge[] {
  return [
    // Ownership and supervision are PROJECTIONS. Lapemo owns these relationships.
    edge('e-accountable-agent', 'ACCOUNTABLE_FOR', ['Person', ID.procurementDirector], ['Agent', ID.agent], true, { effectiveFrom: T.agentActivated }),
    edge('e-supervises-agent', 'SUPERVISES', ['Person', ID.procurementDirector], ['Agent', ID.agent], true, { effectiveFrom: T.agentActivated }),

    edge('e-occupies-director', 'OCCUPIES', ['Person', ID.procurementDirector], ['Role', ID.roleProcurementDirector], true),
    edge('e-occupies-cfo', 'OCCUPIES', ['Person', ID.cfo], ['Role', ID.roleCfo], true),
    edge('e-occupies-chair', 'OCCUPIES', ['Person', ID.boardChair], ['Role', ID.roleBoardChair], true),

    // The authority chain is canonical in this graph. Nothing else models it.
    edge('e-grants-root', 'GRANTS', ['Person', ID.boardChair], ['AuthorityGrant', ID.grantRoot], false, { effectiveFrom: T.authorityIssued, evidence: ID.evidenceBoardResolution }),
    edge('e-grants-director', 'GRANTS', ['Person', ID.cfo], ['AuthorityGrant', ID.grantDirector], false, { effectiveFrom: T.authorityIssued, evidence: ID.evidenceDelegationMatrix }),
    edge('e-grants-agent', 'GRANTS', ['Person', ID.procurementDirector], ['AuthorityGrant', ID.grantAgent], false, { effectiveFrom: T.authorityIssued, evidence: ID.evidenceAgentMemo }),

    edge('e-derived-director', 'DERIVED_FROM', ['AuthorityGrant', ID.grantDirector], ['AuthorityGrant', ID.grantRoot], false, { effectiveFrom: T.authorityIssued, evidence: ID.evidenceDelegationMatrix }),
    edge('e-derived-agent', 'DERIVED_FROM', ['AuthorityGrant', ID.grantAgent], ['AuthorityGrant', ID.grantDirector], false, { effectiveFrom: T.authorityIssued, evidence: ID.evidenceAgentMemo }),

    edge('e-authorizes-agent', 'AUTHORIZES', ['AuthorityGrant', ID.grantAgent], ['Agent', ID.agent], false, { effectiveFrom: T.authorityIssued }),
    edge('e-covers-decision-type', 'COVERS', ['AuthorityGrant', ID.grantAgent], ['DecisionType', ID.decisionType], false, { effectiveFrom: T.authorityIssued }),

    // Technical permission. Never authority.
    edge('e-has-permission', 'HAS_PERMISSION', ['Agent', ID.agent], ['SystemPermission', ID.erpPermission], true, { effectiveFrom: T.agentActivated }),
    edge('e-permits-in-erp', 'PERMITS_IN', ['SystemPermission', ID.erpPermission], ['EnterpriseSystem', ID.erp], true, { effectiveFrom: T.agentActivated }),

    // The decision.
    edge('e-makes-decision', 'MAKES', ['Agent', ID.agent], ['DecisionEvent', ID.decisionEvent], true, { effectiveFrom: T.decisionMade }),
    edge('e-instance-of', 'INSTANCE_OF', ['DecisionEvent', ID.decisionEvent], ['DecisionType', ID.decisionType], true, { effectiveFrom: T.decisionMade }),
    edge('e-invokes-erp', 'INVOKES', ['DecisionEvent', ID.decisionEvent], ['EnterpriseSystem', ID.erp], false, { effectiveFrom: T.decisionMade }),
    edge('e-governed-by-policy', 'GOVERNED_BY', ['DecisionEvent', ID.decisionEvent], ['Policy', ID.policy], false, { effectiveFrom: T.decisionMade }),
    // Lapemo owns a control covering a DECISION TYPE, but nothing models a
    // control checking a specific decision EVENT, so this edge is graph canonical.
    edge('e-checked-by-control', 'CHECKED_BY', ['DecisionEvent', ID.decisionEvent], ['Control', ID.control], false, { effectiveFrom: T.decisionMade }),
    edge('e-authorized-by-grant', 'AUTHORIZED_BY', ['DecisionEvent', ID.decisionEvent], ['AuthorityGrant', ID.grantAgent], false, { effectiveFrom: T.decisionMade }),

    // The vendor master record is present. The vendor RISK CLASSIFICATION is not.
    edge('e-uses-vendor-master', 'USES', ['DecisionEvent', ID.decisionEvent], ['InformationAsset', ID.vendorMasterRecord], false, { effectiveFrom: T.decisionMade }),
  ]
}

/** The base scenario exactly as specified: a forty two thousand purchase from a new vendor. */
export function procurementScenario(): GraphDataset {
  return { nodes: baseNodes(), edges: baseEdges() }
}

// ── Variant helpers ─────────────────────────────────────────────────────────

function withoutEdges(dataset: GraphDataset, ids: readonly string[]): GraphDataset {
  const drop = new Set(ids)
  return { nodes: dataset.nodes, edges: dataset.edges.filter((e) => !drop.has(e.id)) }
}

function replaceNode(dataset: GraphDataset, logicalId: string, mutate: (node: GraphNode) => GraphNode): GraphDataset {
  return {
    nodes: dataset.nodes.map((node) => (node.logicalId === logicalId ? mutate(node) : node)),
    edges: dataset.edges,
  }
}

function addNodes(dataset: GraphDataset, nodes: readonly GraphNode[]): GraphDataset {
  return { nodes: [...dataset.nodes, ...nodes], edges: dataset.edges }
}

function addEdges(dataset: GraphDataset, edges: readonly GraphEdge[]): GraphDataset {
  return { nodes: dataset.nodes, edges: [...dataset.edges, ...edges] }
}

/** The vendor risk classification asset, authoritative and current. */
function vendorRiskAsset(): GraphNode {
  return {
    ...base(ID.vendorRiskClassification, 'InformationAsset', { effectiveFrom: T.vendorRecordObserved }),
    nodeType: 'InformationAsset',
    name: 'Vendor risk classification',
    informationClassId: VENDOR_RISK_CLASS,
    classification: 'CONFIDENTIAL',
    permittedUse: ['procurement', 'risk'],
    authoritativeFor: [VENDOR_RISK_CLASS],
    observedAt: T.vendorRecordObserved,
    staleAfterDays: 365,
    integrityState: 'VERIFIED',
    knowledgeObjectRef: null,
  }
}

// ── Named variants ──────────────────────────────────────────────────────────

/**
 * Amount lowered to twenty thousand and the ERP permission scope corrected to
 * match the authority limit. What remains is the obtainable human review and the
 * missing vendor risk classification.
 */
export function withinFinancialLimit(): GraphDataset {
  let dataset = procurementScenario()
  dataset = replaceNode(dataset, ID.decisionEvent, (node) => {
    if (node.nodeType !== 'DecisionEvent') return node
    return { ...node, financialAmount: { amount: 20_000, currency: 'USD' } }
  })
  dataset = replaceNode(dataset, ID.erpPermission, (node) => {
    if (node.nodeType !== 'SystemPermission') return node
    return { ...node, financialLimit: { amount: 25_000, currency: 'USD' } }
  })
  return dataset
}

/** Everything above, plus human review performed and the vendor risk classification supplied. */
export function fullyCompliant(): GraphDataset {
  let dataset = withinFinancialLimit()
  dataset = replaceNode(dataset, ID.decisionEvent, (node) => {
    if (node.nodeType !== 'DecisionEvent') return node
    return {
      ...node,
      humanReview: {
        performed: true,
        reviewerPersonLogicalId: ID.procurementDirector,
        reviewedAt: T.decisionMade,
      },
    }
  })
  dataset = addNodes(dataset, [vendorRiskAsset()])
  dataset = addEdges(dataset, [
    edge('e-uses-vendor-risk', 'USES', ['DecisionEvent', ID.decisionEvent], ['InformationAsset', ID.vendorRiskClassification], false, { effectiveFrom: T.decisionMade }),
  ])
  return dataset
}

/** The governed agent authority grant expired before the decision was made. */
export function expiredAuthority(): GraphDataset {
  return replaceNode(fullyCompliant(), ID.grantAgent, (node) => {
    if (node.nodeType !== 'AuthorityGrant') return node
    return { ...node, effectiveTo: '2026-03-01T00:00:00.000Z' }
  })
}

/** The accountable owner relationship is absent. */
export function withoutAccountableOwner(): GraphDataset {
  return withoutEdges(fullyCompliant(), ['e-accountable-agent'])
}

/** The supervision relationship is absent. */
export function withoutSupervisor(): GraphDataset {
  return withoutEdges(fullyCompliant(), ['e-supervises-agent'])
}

/** The named supervisor and owner exists but has been deactivated. */
export function withDeactivatedSupervisor(): GraphDataset {
  return replaceNode(fullyCompliant(), ID.procurementDirector, (node) => {
    if (node.nodeType !== 'Person') return node
    return { ...node, isActive: false }
  })
}

/** Technical permission widened to an action no authority grant covers. */
export function withExpandedPermission(): GraphDataset {
  return replaceNode(fullyCompliant(), ID.erpPermission, (node) => {
    if (node.nodeType !== 'SystemPermission') return node
    return { ...node, permittedActions: [ACTION_APPROVE_PURCHASE, 'MODIFY_VENDOR_BANK_DETAILS'] }
  })
}

/** The delegation chain no longer reaches an organizational source. */
export function withBrokenDelegation(): GraphDataset {
  return replaceNode(fullyCompliant(), ID.grantDirector, (node) => {
    if (node.nodeType !== 'AuthorityGrant') return node
    return { ...node, derivedFromGrantLogicalId: null, organizationalSource: null }
  })
}

/** A grantor delegating more financial authority than they hold. */
export function withOverreachingDelegation(): GraphDataset {
  return replaceNode(fullyCompliant(), ID.grantAgent, (node) => {
    if (node.nodeType !== 'AuthorityGrant') return node
    return { ...node, financialLimit: { amount: 500_000, currency: 'USD' } }
  })
}

/** Autonomy raised above the canonical baseline with no gate-clearance evidence. */
export function withUnearnedAutonomy(level: AutonomyLevelKey = 'AGENT_SUPERVISED'): GraphDataset {
  return replaceNode(fullyCompliant(), ID.autonomyState, (node) => {
    if (node.nodeType !== 'AutonomyState') return node
    return { ...node, level, gateClearanceEvidenceRef: null }
  })
}

/** Autonomy raised above the baseline WITH resolvable gate-clearance evidence. */
export function withEarnedAutonomy(level: AutonomyLevelKey = 'AGENT_SUPERVISED'): GraphDataset {
  let dataset = fullyCompliant()
  dataset = addNodes(dataset, [
    {
      ...base(ID.evidenceGateClearance, 'EvidenceObject', { effectiveFrom: T.agentActivated }),
      nodeType: 'EvidenceObject',
      evidenceType: 'CONFIDENCE_GATE_CLEARANCE',
      evidentiaryPurpose: 'Records the measurable threshold the governed agent cleared to earn a higher autonomy state.',
      issuedAt: T.agentActivated,
      integrityState: 'VERIFIED',
      knowledgeObjectRef: null,
      retentionExpiresAt: null,
    },
  ])
  dataset = replaceNode(dataset, ID.autonomyState, (node) => {
    if (node.nodeType !== 'AutonomyState') return node
    return { ...node, level, gateClearanceEvidenceRef: ID.evidenceGateClearance }
  })
  return dataset
}

/**
 * Two policies that contradict each other on human review with no precedence to
 * resolve the contradiction.
 */
export function withConflictingPolicies(): GraphDataset {
  let dataset = fullyCompliant()
  dataset = replaceNode(dataset, ID.policy, (node) => {
    if (node.nodeType !== 'Policy') return node
    return { ...node, precedenceRank: null }
  })
  dataset = addNodes(dataset, [
    {
      ...base('policy-procurement-fast-track', 'Policy'),
      nodeType: 'Policy',
      name: 'Procurement Fast Track Policy',
      appliesToDecisionTypeLogicalIds: [ID.decisionType],
      requirements: {
        humanReviewRequired: false,
        maxFinancialAmount: null,
        prohibitedActions: [],
      },
      precedenceRank: null,
    },
  ])
  return dataset
}

/**
 * The financial limit was raised, effective from a later date, as a genuine
 * change in organizational reality rather than a correction of what was known.
 *
 * Both versions remain currently known, with adjacent valid-time periods. That
 * is what makes point-in-time reconstruction meaningful: evaluating at the
 * decision instant sees the old limit, and evaluating later sees the new one.
 */
export function withLimitRaisedLater(): GraphDataset {
  const dataset = fullyCompliant()
  const original = dataset.nodes.find((node) => node.logicalId === ID.grantAgent)
  if (original === undefined || original.nodeType !== 'AuthorityGrant') {
    throw new Error('Fixture defect: the governed agent authority grant is missing.')
  }

  const closedV1 = { ...original, effectiveTo: T.limitRaised }
  const v2 = {
    ...original,
    versionId: fixtureVersionId(ID.grantAgent, 2),
    versionNumber: 2,
    supersedesVersionId: original.versionId,
    effectiveFrom: T.limitRaised,
    effectiveTo: null,
    recordedFrom: T.limitRaised,
    financialLimit: { amount: 50_000, currency: 'USD' },
  }

  return {
    nodes: [...dataset.nodes.filter((node) => node.logicalId !== ID.grantAgent), closedV1, v2],
    edges: dataset.edges,
  }
}

/** Restores the base forty two thousand amount on top of the raised-limit dataset. */
export function withLimitRaisedLaterAtOriginalAmount(): GraphDataset {
  return replaceNode(withLimitRaisedLater(), ID.decisionEvent, (node) => {
    if (node.nodeType !== 'DecisionEvent') return node
    return { ...node, financialAmount: { amount: 42_000, currency: 'USD' } }
  })
}

// ── Ceiling provider ────────────────────────────────────────────────────────

/**
 * The ceiling the fixtures use.
 *
 * This DERIVES NOTHING. The ratified ceiling derivation is owned by the Lapemo
 * platform, which computes it from lineage. Here the value is simply declared so
 * the evaluator can be exercised without the platform present.
 */
export function fixtureCeilingProvider(
  ceiling: AutonomyCeiling = { kind: 'LEVEL', level: 'AGENT_SUPERVISED' },
): StaticAutonomyCeilingProvider {
  return new StaticAutonomyCeilingProvider({ [ID.decisionType]: ceiling }, ceiling)
}
