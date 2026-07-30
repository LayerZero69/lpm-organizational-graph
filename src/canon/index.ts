/**
 * Pinned canon surface.
 *
 * `lpm-canon` is the authoritative source for the autonomy spectrum, the seven
 * framework layers, the laws, and the voice rules. This module is the ONLY place
 * in the package where a canonical string is written down, so that every other
 * module imports rather than retypes it.
 *
 * The values below are transcribed from the pinned canon release recorded in
 * CANON_PROVENANCE. `scripts/validate-ontology.ts` re-verifies them against a
 * sibling `../lpm-canon` checkout when one is present, and against the
 * LPM_CANON_VERSION environment variable in CI. The check is skipped, loudly,
 * when no sibling checkout exists, which mirrors the derivation convention
 * already used by `lpm-knowledge-objects`.
 *
 * Never edit a value here to make a test pass. Edit canon, publish, bump the
 * pin, and re-run the validator.
 */

export const CANON_PROVENANCE = {
  repository: 'lpm-canon',
  version: '0.5.0',
  commit: 'd4d36e2fe1d1b0cebf06bbcebfff5806299e21e2',
  tag: 'v0.5.0',
  sourceFile: 'canon.lexicon.json',
  pinnedOn: '2026-07-30',
} as const

/**
 * The canonical autonomy spectrum, in canonical order.
 *
 * Ordinal is the canon `n`. `isBaseline` marks the canonical default entry point
 * for every new governed agent and decision type. `isEarned` marks the levels
 * that canon requires be cleared through measurable gate evidence.
 *
 * Agent Autonomous Plus is NOT part of this spectrum. The Lapemo platform still
 * persists a legacy `AGENT_AUTONOMOUS_PLUS` enum value whose labels are shifted
 * by one position relative to canon. That is an integration blocker recorded in
 * docs/INTEGRATION_BLOCKERS.md (IB-001) and handled at the adapter boundary in
 * src/adapters/lapemo/autonomy-mapping.ts. It must never leak into this package.
 */
export const AUTONOMY_SPECTRUM = [
  { ordinal: 1, key: 'HUMAN_ONLY', name: 'Human Only', isBaseline: false, isEarned: false },
  { ordinal: 2, key: 'HUMAN_APPROVED', name: 'Human Approved', isBaseline: false, isEarned: false },
  { ordinal: 3, key: 'AGENT_ASSISTED', name: 'Agent Assisted', isBaseline: true, isEarned: false },
  { ordinal: 4, key: 'AGENT_SUPERVISED', name: 'Agent Supervised', isBaseline: false, isEarned: true },
  { ordinal: 5, key: 'AGENT_AUTONOMOUS', name: 'Agent Autonomous', isBaseline: false, isEarned: true },
] as const

export type AutonomyLevelKey = (typeof AUTONOMY_SPECTRUM)[number]['key']

const AUTONOMY_BY_KEY = new Map(AUTONOMY_SPECTRUM.map((level) => [level.key, level]))

export function autonomyOrdinal(key: AutonomyLevelKey): number {
  const level = AUTONOMY_BY_KEY.get(key)
  if (!level) throw new Error(`Unknown autonomy level: ${key}`)
  return level.ordinal
}

export function autonomyName(key: AutonomyLevelKey): string {
  const level = AUTONOMY_BY_KEY.get(key)
  if (!level) throw new Error(`Unknown autonomy level: ${key}`)
  return level.name
}

export function isAutonomyLevelKey(value: string): value is AutonomyLevelKey {
  return AUTONOMY_BY_KEY.has(value as AutonomyLevelKey)
}

/** The canonical baseline every governed agent enters at. Autonomy is earned, never defaulted. */
export const AUTONOMY_BASELINE: AutonomyLevelKey = 'AGENT_ASSISTED'

/** True when the level sits above the canonical baseline and therefore requires gate-clearance evidence. */
export function requiresEarnedEvidence(key: AutonomyLevelKey): boolean {
  return autonomyOrdinal(key) > autonomyOrdinal(AUTONOMY_BASELINE)
}

/**
 * The seven framework layers, plain names only.
 *
 * Canon carries short codes for these layers and a voice rule forbids surfacing
 * those codes on any user-facing surface, so the codes are deliberately absent
 * from this package. Render the plain name.
 */
export const FRAMEWORK_LAYERS = [
  'Identity & Incentives',
  'Decision Architecture',
  'Communication Architecture',
  'Information Ecology',
  'Platform Structure',
  'Governance Architecture',
  'AI Amplification',
] as const

export type FrameworkLayer = (typeof FRAMEWORK_LAYERS)[number]

/** Canonical rendering rules that apply to every string this package emits. */
export const VOICE_RULES = [
  "Say 'governed agents', not the legacy phrase.",
  'Never surface layer codes or module codes on user-facing surfaces.',
  'No em dashes in published content.',
  'Autonomy is earned, never defaulted.',
  'Single named human owner per outcome; never imply shared ownership.',
] as const

/** Governing axioms, enforced in this package as evaluation rules rather than stated as philosophy. */
export const AXIOMS = {
  sequencing: 'You cannot govern what you have not owned. You cannot automate what you have not governed.',
  accountability: 'A tool cannot own an outcome. A human always does.',
} as const

/**
 * Supervisory Control Capacity is named and defined by canon, and its numeric
 * formula is single-sourced in the Lapemo platform. This package returns the raw
 * structural facts that feed it and never computes a capacity or utilization.
 */
export const SUPERVISORY_CONTROL_CAPACITY = {
  name: 'Supervisory Control Capacity',
  formulaOwner: 'lapemo platform: src/lib/lpm/scc-calculator.ts',
  thisPackageProvides: 'structural facts only, never a formula',
} as const
