import { describe, it, expect } from 'vitest'
import { InMemoryGraphRepository } from '@/adapters/memory/in-memory-repository.js'
import { GraphQueryService } from '@/graph/queries.js'
import { temporalContext } from '@/graph/temporal.js'
import {
  procurementScenario,
  fullyCompliant,
  withExpandedPermission,
  withLimitRaisedLaterAtOriginalAmount,
  fixtureCeilingProvider,
  ORG,
  ID,
  T,
} from '@/fixtures/procurement-scenario.js'
import type { GraphDataset } from '@/adapters/memory/in-memory-repository.js'

function service(dataset: GraphDataset): GraphQueryService {
  return new GraphQueryService(new InMemoryGraphRepository(dataset), fixtureCeilingProvider())
}

const scope = { organizationId: ORG, ctx: temporalContext(T.decisionMade) }

describe('QRY-001 was this governed agent authorized', () => {
  it('returns the status, reason codes, grant, accountable human and supervisor', async () => {
    const result = await service(procurementScenario()).wasAuthorized(ID.decisionEvent, scope)

    expect(result.status).toBe('NOT_AUTHORIZED')
    expect(result.violations.length).toBe(4)
    expect(result.matchingGrantLogicalId).toBe(ID.grantAgent)
    expect(result.accountablePersonLogicalId).toBe(ID.procurementDirector)
    expect(result.supervisorPersonLogicalId).toBe(ID.procurementDirector)
    expect(result.confidence).toBeGreaterThan(0)
  })
})

describe('QRY-002 who is accountable', () => {
  it('traces the action back to the accountable person and their roles', async () => {
    const dataset = fullyCompliant()
    // Add an action event and the PERFORMS edge the query traverses.
    const base = dataset.nodes.find((n) => n.logicalId === ID.decisionEvent)
    if (base === undefined) throw new Error('fixture defect')

    const withAction: GraphDataset = {
      nodes: [
        ...dataset.nodes,
        {
          ...base,
          logicalId: ID.actionEvent,
          versionId: `${ID.actionEvent}#v1`,
          nodeType: 'ActionEvent',
          decisionEventLogicalId: ID.decisionEvent,
          actor: { actorType: 'Agent', logicalId: ID.agent },
          action: 'APPROVE_PURCHASE',
          enterpriseSystemLogicalId: ID.erp,
          performedAt: T.decisionMade,
          succeeded: true,
        } as never,
      ],
      edges: [
        ...dataset.edges,
        {
          id: 'e-performs',
          organizationId: ORG,
          edgeType: 'PERFORMS',
          fromNodeType: 'Agent',
          fromLogicalId: ID.agent,
          toNodeType: 'ActionEvent',
          toLogicalId: ID.actionEvent,
          status: 'ACTIVE',
          effectiveFrom: T.decisionMade,
          effectiveTo: null,
          recordedFrom: T.decisionMade,
          recordedTo: null,
          supersedesVersionId: null,
          confidence: 1,
          sourceRef: null,
          evidenceObjectLogicalId: null,
          metadata: {},
          isProjection: false,
        },
      ],
    }

    const answer = await service(withAction).whoIsAccountable(ID.actionEvent, scope)

    expect(answer.agentLogicalId).toBe(ID.agent)
    expect(answer.accountablePersonLogicalId).toBe(ID.procurementDirector)
    expect(answer.accountablePersonName).toBe('Dana Whitfield')
    expect(answer.rolesOccupied).toContain('Procurement Director')
    expect(answer.supervisorPersonLogicalId).toBe(ID.procurementDirector)
  })

  it('returns an empty answer rather than throwing for an unknown action', async () => {
    const answer = await service(procurementScenario()).whoIsAccountable('nope', scope)
    expect(answer.accountablePersonLogicalId).toBeNull()
  })
})

describe('QRY-003 what authority allowed the decision', () => {
  it('returns the matching grant and the full chain to its organizational source', async () => {
    const { grant, chain } = await service(procurementScenario()).whatAuthorityAllowed(ID.decisionEvent, scope)

    expect(grant?.logicalId).toBe(ID.grantAgent)
    expect(chain.map((g) => g.logicalId)).toEqual([ID.grantAgent, ID.grantDirector, ID.grantRoot])
    expect(chain.at(-1)?.organizationalSource).toBe('BOARD_RESOLUTION')
  })
})

describe('QRY-004 where permission exceeds authority', () => {
  it('finds the financial exceedance in the base scenario', async () => {
    const findings = await service(procurementScenario()).wherePermissionExceedsAuthority(scope)

    expect(findings.length).toBeGreaterThan(0)
    expect(findings.map((f) => f.exceedanceKind)).toContain('FINANCIAL_LIMIT_ABOVE_AUTHORITY')
  })

  it('finds an action the technology permits and no authority covers', async () => {
    const findings = await service(withExpandedPermission()).wherePermissionExceedsAuthority(scope)
    expect(findings.map((f) => f.exceedanceKind)).toContain('ACTION_NOT_AUTHORIZED')
  })

  it('finds nothing once permission is inside authority', async () => {
    const findings = await service(fullyCompliant()).wherePermissionExceedsAuthority(scope)
    expect(findings).toEqual([])
  })
})

describe('QRY-005 which decisions lack complete lineage', () => {
  it('reports the missing links for the base scenario', async () => {
    const gaps = await service(procurementScenario()).decisionsLackingLineage(scope)
    const gap = gaps.find((g) => g.decisionEventLogicalId === ID.decisionEvent)

    expect(gap).toBeDefined()
    expect(gap?.missing).toContain('human review')
    expect(gap?.missing).toContain('outcome')
    // The vendor master record IS linked, so information is not wholly absent.
    // What is missing is the REQUIRED vendor risk classification, which is a
    // different and more precise gap.
    expect(gap?.missing).not.toContain('information')
    expect(gap?.missing).toContain('required information')
  })

  it('reports no information gap once the required class is satisfied', async () => {
    const gaps = await service(fullyCompliant()).decisionsLackingLineage(scope)
    const gap = gaps.find((g) => g.decisionEventLogicalId === ID.decisionEvent)
    expect(gap?.missing ?? []).not.toContain('required information')
  })
})

describe('QRY-006 what changed after approval', () => {
  it('reports a version that advanced after the reference instant', async () => {
    const dataset = withLimitRaisedLaterAtOriginalAmount()
    const changes = await service(dataset).whatChangedAfter(T.decisionMade, [ID.grantAgent], ORG)

    expect(changes.length).toBe(1)
    expect(changes[0]?.subjectLogicalId).toBe(ID.grantAgent)
    expect(changes[0]?.changedAt).toBe(T.limitRaised)
  })

  it('reports nothing when the reference instant is after every change', async () => {
    const dataset = withLimitRaisedLaterAtOriginalAmount()
    const changes = await service(dataset).whatChangedAfter(T.laterEvaluation, [ID.grantAgent], ORG)
    expect(changes).toEqual([])
  })
})

describe('QRY-007 supervisory concentration', () => {
  it('returns structural facts only', async () => {
    const facts = await service(procurementScenario()).supervisoryConcentration(ID.procurementDirector, scope)

    expect(facts.activeAgentsSupervised).toBe(1)
    expect(facts.activeAgentsAccountableFor).toBe(1)
    expect(facts.agentsByRiskLevel.HIGH).toBe(1)
    expect(facts.decisionEventCount).toBe(1)
    expect(facts.unreviewedOutcomeCount).toBe(1)
  })

  it('returns no capacity, utilization or score, because those are platform formulas', async () => {
    const facts = await service(procurementScenario()).supervisoryConcentration(ID.procurementDirector, scope)
    const keys = Object.keys(facts)

    expect(keys).not.toContain('capacity')
    expect(keys).not.toContain('sccCapacity')
    expect(keys).not.toContain('utilization')
    expect(keys).not.toContain('sccUtilization')
    expect(keys).not.toContain('overloaded')
    expect(keys).not.toContain('score')
  })
})

describe('QRY-008 trace a decision end to end', () => {
  it('returns the complete path from organization through to accountability', async () => {
    const trace = await service(procurementScenario()).traceDecision(ID.decisionEvent, scope)

    expect(trace).not.toBeNull()
    expect(trace?.organizationLogicalId).toBe(ORG)
    expect(trace?.decisionTypeLogicalId).toBe(ID.decisionType)
    expect(trace?.agentLogicalId).toBe(ID.agent)
    expect(trace?.accountablePersonLogicalId).toBe(ID.procurementDirector)
    expect(trace?.supervisorPersonLogicalId).toBe(ID.procurementDirector)
    expect(trace?.authorityGrantLogicalId).toBe(ID.grantAgent)
    expect(trace?.delegationChainLogicalIds.length).toBe(3)
    expect(trace?.invokedSystemLogicalIds).toContain(ID.erp)
    expect(trace?.systemPermissionLogicalIds).toContain(ID.erpPermission)
    expect(trace?.humanReviewPerformed).toBe(false)
    expect(trace?.evaluation.status).toBe('NOT_AUTHORIZED')
  })

  it('returns null for an unknown decision rather than a partial trace', async () => {
    const trace = await service(procurementScenario()).traceDecision('nope', scope)
    expect(trace).toBeNull()
  })
})

describe('Organization scoping', () => {
  it('returns nothing for a different organization', async () => {
    const otherScope = { organizationId: 'org-someone-else', ctx: temporalContext(T.decisionMade) }
    const trace = await service(procurementScenario()).traceDecision(ID.decisionEvent, otherScope)
    expect(trace).toBeNull()
  })

  it('reports INDETERMINATE rather than a business refusal when the scope does not resolve', async () => {
    const otherScope = { organizationId: 'org-someone-else', ctx: temporalContext(T.decisionMade) }
    const result = await service(procurementScenario()).wasAuthorized(ID.decisionEvent, otherScope)
    expect(result.status).toBe('INDETERMINATE')
  })
})

describe('Effective autonomy', () => {
  it('resolves the state scoped to the decision type', async () => {
    const state = await service(procurementScenario()).effectiveAutonomy(ID.agent, ID.decisionType, scope)
    expect(state?.level).toBe('AGENT_ASSISTED')
    expect(state?.grantingBusinessOwnerPersonId).toBe(ID.procurementDirector)
  })
})
