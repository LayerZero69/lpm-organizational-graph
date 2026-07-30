/**
 * Explicit risk-scheme mapping.
 *
 * The graph refuses to give portable business meaning to a numbered tier,
 * because two live numbering schemes exist in the Lapemo platform and they run
 * in OPPOSITE directions:
 *
 *   RETENTION_TIER   the RiskTier database enum. TIER_1 is the MOST severe.
 *                    Evidence: writeAudit maps TIER_1 to seven-year retention,
 *                    TIER_2 to three years, TIER_3 to one year; and the
 *                    Supervisory Control Capacity input is documented as
 *                    "expected 1-3 (1=highest risk)".
 *
 *   CLASSIFICATION_TIER  the risk-tiering module. Tier 1 is the LEAST severe
 *                    ("Automated Pass") rising to tier 4 ("Human Only"), and it
 *                    has FOUR tiers rather than three.
 *
 * A bare numeric tier is therefore meaningless without its scheme. Every adapter
 * must name the scheme it received. There is deliberately no default.
 *
 * See docs/ADR/ADR-006-risk-semantics.md and integration blocker IB-002.
 */

import type { RiskLevel } from '../../domain/enums/index.js'

export const RISK_SCHEMES = ['RETENTION_TIER', 'CLASSIFICATION_TIER'] as const
export type RiskScheme = (typeof RISK_SCHEMES)[number]

/**
 * TIER_1 is the most severe in this scheme. Three tiers only.
 * There is no fourth value; a tier above 3 is a defect, not a CRITICAL.
 */
const RETENTION_TIER_TO_RISK: Record<number, RiskLevel> = {
  1: 'CRITICAL',
  2: 'HIGH',
  3: 'MODERATE',
}

/** Tier 1 is the least severe in this scheme. Four tiers. */
const CLASSIFICATION_TIER_TO_RISK: Record<number, RiskLevel> = {
  1: 'LOW',
  2: 'MODERATE',
  3: 'HIGH',
  4: 'CRITICAL',
}

export class RiskMappingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RiskMappingError'
  }
}

/**
 * Map a numbered tier into a semantic risk level.
 *
 * Throws rather than guessing. A tier that does not exist in the named scheme is
 * a data defect at the integration boundary, and silently coercing it would
 * reintroduce exactly the ambiguity this module exists to remove.
 */
export function mapNumberedTier(scheme: RiskScheme, tier: number): RiskLevel {
  // The type system stops a compile-time caller from passing an invalid scheme,
  // but this is the integration boundary: values can arrive from JSON, a
  // database row, or external config that TypeScript never checked. A ternary
  // over exactly two valid values silently treats "anything else" as the
  // second one, which is precisely the ambiguity this module exists to remove.
  // Validate explicitly rather than falling through.
  if (scheme !== 'RETENTION_TIER' && scheme !== 'CLASSIFICATION_TIER') {
    throw new RiskMappingError(
      `Unknown risk scheme: ${JSON.stringify(scheme)}. Valid schemes: ${RISK_SCHEMES.join(', ')}. ` +
        'There is no default scheme. Every caller must name the scheme it received.',
    )
  }
  const table = scheme === 'RETENTION_TIER' ? RETENTION_TIER_TO_RISK : CLASSIFICATION_TIER_TO_RISK
  const mapped = table[tier]
  if (mapped === undefined) {
    const valid = Object.keys(table).join(', ')
    throw new RiskMappingError(
      `Tier ${tier} does not exist in the ${scheme} scheme. Valid tiers: ${valid}. ` +
        'Never assume a tier number has a universal meaning.',
    )
  }
  return mapped
}

/** Map the RiskTier enum literal used by the platform database. */
export function mapRetentionTierLiteral(literal: 'TIER_1' | 'TIER_2' | 'TIER_3'): RiskLevel {
  const tier = Number.parseInt(literal.replace('TIER_', ''), 10)
  return mapNumberedTier('RETENTION_TIER', tier)
}

/**
 * Documentation surface for the integration guide. Rendering the two schemes
 * side by side is the point: it makes the conflict impossible to forget.
 */
export function riskSchemeMappingTable(): Array<{
  scheme: RiskScheme
  tier: number
  semanticRiskLevel: RiskLevel
  platformMeaning: string
}> {
  return [
    { scheme: 'RETENTION_TIER', tier: 1, semanticRiskLevel: 'CRITICAL', platformMeaning: 'Seven-year audit retention. Highest consequence.' },
    { scheme: 'RETENTION_TIER', tier: 2, semanticRiskLevel: 'HIGH', platformMeaning: 'Three-year audit retention.' },
    { scheme: 'RETENTION_TIER', tier: 3, semanticRiskLevel: 'MODERATE', platformMeaning: 'One-year audit retention. Lowest consequence in this scheme.' },
    { scheme: 'CLASSIFICATION_TIER', tier: 1, semanticRiskLevel: 'LOW', platformMeaning: 'Automated Pass. Low stakes, fully reversible, no human review.' },
    { scheme: 'CLASSIFICATION_TIER', tier: 2, semanticRiskLevel: 'MODERATE', platformMeaning: 'Human Sampling. Moderate stakes.' },
    { scheme: 'CLASSIFICATION_TIER', tier: 3, semanticRiskLevel: 'HIGH', platformMeaning: 'Mandatory pre-execution review. High stakes.' },
    { scheme: 'CLASSIFICATION_TIER', tier: 4, semanticRiskLevel: 'CRITICAL', platformMeaning: 'Human Only. No agent participation.' },
  ]
}
