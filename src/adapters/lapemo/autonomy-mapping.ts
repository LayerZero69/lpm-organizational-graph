/**
 * Explicit autonomy mapping across the canon and platform boundary.
 *
 * `lpm-canon` is authoritative. Its five-point spectrum is:
 *
 *   1 Human Only, 2 Human Approved, 3 Agent Assisted,
 *   4 Agent Supervised, 5 Agent Autonomous
 *
 * The Lapemo platform still persists a legacy enum whose last two labels are
 * SHIFTED BY ONE POSITION relative to canon:
 *
 *   HUMAN_ONLY, HUMAN_APPROVED, AGENT_ASSISTED, AGENT_AUTONOMOUS, AGENT_AUTONOMOUS_PLUS
 *
 * So platform AGENT_AUTONOMOUS occupies canon position 4 and MEANS
 * "Agent Supervised", while platform AGENT_AUTONOMOUS_PLUS occupies position 5
 * and MEANS "Agent Autonomous". Reading the platform value by its name rather
 * than its position silently promotes a supervised agent to autonomous.
 *
 * This module is the ONLY place that boundary is crossed. Agent Autonomous Plus
 * never enters the domain package.
 *
 * The platform migration is tracked as ecosystem deferred item D1 and as
 * integration blocker IB-001. When it lands, LEGACY_TO_CANON collapses to an
 * identity mapping and this module is deleted rather than edited.
 */

import type { AutonomyLevelKey } from '../../domain/enums/index.js'

export const LEGACY_PLATFORM_AUTONOMY_VALUES = [
  'HUMAN_ONLY',
  'HUMAN_APPROVED',
  'AGENT_ASSISTED',
  'AGENT_AUTONOMOUS',
  'AGENT_AUTONOMOUS_PLUS',
] as const

export type LegacyPlatformAutonomyValue = (typeof LEGACY_PLATFORM_AUTONOMY_VALUES)[number]

/**
 * Position-preserving map from the legacy platform enum to canon.
 *
 * Note the two entries that are NOT identity mappings. They are the whole reason
 * this file exists.
 */
const LEGACY_TO_CANON: Record<LegacyPlatformAutonomyValue, AutonomyLevelKey> = {
  HUMAN_ONLY: 'HUMAN_ONLY',
  HUMAN_APPROVED: 'HUMAN_APPROVED',
  AGENT_ASSISTED: 'AGENT_ASSISTED',
  // Position 4. The platform name says autonomous; canon says supervised.
  AGENT_AUTONOMOUS: 'AGENT_SUPERVISED',
  // Position 5. The legacy "plus" value is canon's Agent Autonomous.
  AGENT_AUTONOMOUS_PLUS: 'AGENT_AUTONOMOUS',
}

export class AutonomyMappingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AutonomyMappingError'
  }
}

/** Map a legacy platform autonomy value onto the canonical spectrum. */
export function mapLegacyAutonomyValue(value: string): AutonomyLevelKey {
  const mapped = LEGACY_TO_CANON[value as LegacyPlatformAutonomyValue]
  if (mapped === undefined) {
    throw new AutonomyMappingError(
      `Unknown platform autonomy value: ${value}. Expected one of ${LEGACY_PLATFORM_AUTONOMY_VALUES.join(', ')}.`,
    )
  }
  return mapped
}

/**
 * Map the platform's numeric agent autonomy column, which is an integer 1 to 5
 * carrying canon positions directly rather than the shifted enum names.
 */
export function mapPlatformAutonomyOrdinal(ordinal: number): AutonomyLevelKey {
  const byOrdinal: Record<number, AutonomyLevelKey> = {
    1: 'HUMAN_ONLY',
    2: 'HUMAN_APPROVED',
    3: 'AGENT_ASSISTED',
    4: 'AGENT_SUPERVISED',
    5: 'AGENT_AUTONOMOUS',
  }
  const mapped = byOrdinal[ordinal]
  if (mapped === undefined) {
    throw new AutonomyMappingError(`Autonomy ordinal ${ordinal} is outside the canonical spectrum of 1 to 5.`)
  }
  return mapped
}

/** True when the legacy value's own name misdescribes its canonical meaning. */
export function isShiftedValue(value: LegacyPlatformAutonomyValue): boolean {
  return value === 'AGENT_AUTONOMOUS' || value === 'AGENT_AUTONOMOUS_PLUS'
}

/** Documentation surface for the integration guide. */
export function autonomyMappingTable(): Array<{
  platformValue: LegacyPlatformAutonomyValue
  canonPosition: number
  canonLevel: AutonomyLevelKey
  nameIsMisleading: boolean
}> {
  return LEGACY_PLATFORM_AUTONOMY_VALUES.map((platformValue, index) => ({
    platformValue,
    canonPosition: index + 1,
    canonLevel: LEGACY_TO_CANON[platformValue],
    nameIsMisleading: isShiftedValue(platformValue),
  }))
}
