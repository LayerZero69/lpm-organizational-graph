/**
 * Read-oriented Lapemo adapter contracts.
 *
 * Phase 1A defines the ports. It ships no implementation of them, because an
 * implementation would need a database connection and Phase 1A has none by
 * design. Phase 1B implements these against Lapemo-owned persistence through an
 * approved migration.
 *
 * Every port here is READ-ONLY. Lapemo continues to own its application records,
 * runtime persistence, formula layer, audit implementation, condition-family
 * registry, and production workflows. This package must never become a second
 * writable source of truth for any of them.
 */

import type { GraphNode } from '../../domain/nodes/index.js'
import type { GraphEdge } from '../../domain/edges/index.js'
import type { AutonomyLevelKey, RiskLevel } from '../../domain/enums/index.js'
import type { TemporalContext } from '../../graph/temporal.js'
import type { SourceRef } from '../../domain/identity.js'

/**
 * Projects Lapemo-owned records into graph nodes and edges.
 *
 * Everything this port returns is a PROJECTION. The Lapemo record remains the
 * writable truth, so projected edges carry `isProjection: true` and are never
 * written back. See ADR-008.
 */
export interface LapemoProjectionPort {
  /** Project the accountable ownership relation. Source of truth: OwnershipRecord.driId. */
  projectAccountability(organizationId: string, ctx: TemporalContext): Promise<readonly GraphEdge[]>

  /** Project the supervision relation. Source of truth: Agent.supervisorId. */
  projectSupervision(organizationId: string, ctx: TemporalContext): Promise<readonly GraphEdge[]>

  /** Project people. Source of truth: Person. */
  projectPersons(organizationId: string, ctx: TemporalContext): Promise<readonly GraphNode[]>

  /** Project governed agents. Source of truth: Agent. */
  projectAgents(organizationId: string, ctx: TemporalContext): Promise<readonly GraphNode[]>

  /** Project decision types. Source of truth: DecisionType. */
  projectDecisionTypes(organizationId: string, ctx: TemporalContext): Promise<readonly GraphNode[]>

  /** Project decision events. Source of truth: DecisionRecord. */
  projectDecisionEvents(organizationId: string, ctx: TemporalContext): Promise<readonly GraphNode[]>

  /** Project controls. Source of truth: GovernanceControl. */
  projectControls(organizationId: string, ctx: TemporalContext): Promise<readonly GraphNode[]>

  /**
   * Project technical permissions. Source of truth: the connector capability and
   * data-access grants. These are connector-scoped in the platform today, which
   * is narrower than an agent-facing SystemPermission. See IB-003.
   */
  projectSystemPermissions(organizationId: string, ctx: TemporalContext): Promise<readonly GraphNode[]>
}

/**
 * Resolves the autonomy CEILING for a decision context.
 *
 * The ceiling derivation is ratified and owned by the Lapemo platform, which
 * computes it from lineage at read and write time and never stores it. This
 * package CONSUMES that result and must not reimplement the derivation, because
 * duplicating it would create a second answer that can disagree with the one the
 * platform enforces.
 */
export interface AutonomyCeilingProvider {
  resolveCeiling(input: AutonomyCeilingInput): Promise<AutonomyCeiling>
}

export interface AutonomyCeilingInput {
  readonly organizationId: string
  readonly agentLogicalId: string
  readonly decisionTypeLogicalId: string
  readonly ctx: TemporalContext
}

/**
 * BLOCKED means a prerequisite is unsatisfied, for example the decision domain
 * has no active owner. It is a distinct state, not level zero, and not a
 * violation on its own.
 */
export type AutonomyCeiling =
  | { readonly kind: 'BLOCKED'; readonly blockingPrerequisite: string }
  | { readonly kind: 'LEVEL'; readonly level: AutonomyLevelKey }

/**
 * Reports the structural facts behind Supervisory Control Capacity.
 *
 * Canon pins the numeric formula to the Lapemo platform and states it is never
 * reimplemented. This port therefore returns COUNTS AND DISTRIBUTIONS ONLY.
 * There is deliberately no capacity, utilization, or score in the return type.
 */
export interface SupervisoryLoadPort {
  supervisoryStructuralFacts(
    supervisorPersonLogicalId: string,
    organizationId: string,
    ctx: TemporalContext,
  ): Promise<SupervisoryStructuralFacts>
}

export interface SupervisoryStructuralFacts {
  readonly supervisorPersonLogicalId: string
  readonly activeAgentsSupervised: number
  readonly activeAgentsAccountableFor: number
  readonly agentsByRiskLevel: Readonly<Record<RiskLevel, number>>
  readonly decisionEventCount: number
  readonly openExceptionCount: number
  readonly unreviewedOutcomeCount: number
  // Deliberately absent: capacity, utilization, overload, any score.
  // Those are formula-layer concerns owned by the platform.
}

/**
 * Maps graph reason codes onto Lapemo condition families.
 *
 * The platform owns the Condition Family Registry, its evaluators, and its
 * resolution policy. This port lets Lapemo route a graph reason into an existing
 * family rather than have this package duplicate condition logic.
 */
export interface ConditionFamilyPort {
  conditionKeyFor(reasonCode: string): Promise<string | null>
}

/** Resolves an external identifier to a graph logical id. Read-only. */
export interface IdentityResolutionPort {
  resolve(sourceRef: SourceRef, organizationId: string): Promise<string | null>
}

/**
 * The complete Lapemo integration surface. A Phase 1B adapter implements this
 * one interface and the domain evaluator needs no change at all.
 */
export interface LapemoIntegrationPort
  extends LapemoProjectionPort,
    AutonomyCeilingProvider,
    SupervisoryLoadPort,
    ConditionFamilyPort,
    IdentityResolutionPort {}

/**
 * A ceiling provider backed by a fixed value.
 *
 * Used by fixtures and the demonstration so the evaluator can be exercised
 * without the platform present. It is NOT a reimplementation of the platform
 * derivation: it derives nothing, it returns what it was told.
 */
export class StaticAutonomyCeilingProvider implements AutonomyCeilingProvider {
  private readonly ceilings: Map<string, AutonomyCeiling>
  private readonly fallback: AutonomyCeiling

  constructor(ceilings: Record<string, AutonomyCeiling>, fallback: AutonomyCeiling) {
    this.ceilings = new Map(Object.entries(ceilings))
    this.fallback = fallback
  }

  async resolveCeiling(input: AutonomyCeilingInput): Promise<AutonomyCeiling> {
    const key = `${input.agentLogicalId}|${input.decisionTypeLogicalId}`
    return this.ceilings.get(key) ?? this.ceilings.get(input.decisionTypeLogicalId) ?? this.fallback
  }
}
