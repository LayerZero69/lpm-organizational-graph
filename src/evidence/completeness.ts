/**
 * Evidence completeness.
 *
 * Reports which required information classes a decision event satisfied, and how
 * each unsatisfied one failed. The distinction matters: "the vendor risk
 * classification is absent" and "the vendor risk classification came from a
 * non-authoritative source" are different failures with different clearing
 * predicates, and collapsing them into one "incomplete evidence" flag would lose
 * the only information that tells someone what to do next.
 */

import type { InformationAssetNode, RequiredInformationClass } from '../domain/nodes/index.js'
import { dataClassificationOrdinal, type DataClassification } from '../domain/enums/index.js'

export type InformationGapKind =
  | 'ABSENT'
  | 'NOT_AUTHORITATIVE'
  | 'STALE'
  | 'CLASSIFICATION_NOT_PERMITTED'

export interface InformationGap {
  readonly classId: string
  readonly kind: InformationGapKind
  readonly detail: string
  readonly assetLogicalId: string | null
}

export interface EvidenceCompleteness {
  readonly requiredClassCount: number
  readonly satisfiedClassCount: number
  readonly gaps: readonly InformationGap[]
  /** Satisfied classes over required classes. 1 when nothing is required. */
  readonly completenessRatio: number
  readonly satisfyingAssetLogicalIds: readonly string[]
}

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000

function ageInDays(observedAt: string, evaluationInstant: string): number {
  return (Date.parse(evaluationInstant) - Date.parse(observedAt)) / MILLIS_PER_DAY
}

/**
 * Assess every required information class against the assets the decision used.
 *
 * `grantDataClassificationLimit` is the ceiling the matching authority grant
 * imposes, when it imposes one. The tighter of that and the required class limit
 * applies.
 */
export function assessEvidenceCompleteness(
  requiredClasses: readonly RequiredInformationClass[],
  usedAssets: readonly InformationAssetNode[],
  evaluationInstant: string,
  grantDataClassificationLimit: DataClassification | null,
): EvidenceCompleteness {
  const gaps: InformationGap[] = []
  const satisfying: string[] = []
  let satisfied = 0

  for (const required of requiredClasses) {
    const candidates = usedAssets.filter((asset) => asset.informationClassId === required.classId)

    if (candidates.length === 0) {
      gaps.push({
        classId: required.classId,
        kind: 'ABSENT',
        detail: `No information asset supplying ${required.classId} was linked to the decision.`,
        assetLogicalId: null,
      })
      continue
    }

    // Evaluate every candidate; a class is satisfied when at least one asset
    // clears every check. Report the failure of the best candidate otherwise.
    const failures: InformationGap[] = []
    let classSatisfied = false

    for (const asset of candidates) {
      const assetFailures: InformationGap[] = []

      if (required.mustBeAuthoritative && !asset.authoritativeFor.includes(required.classId)) {
        assetFailures.push({
          classId: required.classId,
          kind: 'NOT_AUTHORITATIVE',
          detail: `Asset ${asset.name} is not marked authoritative for ${required.classId}.`,
          assetLogicalId: asset.logicalId,
        })
      }

      const age = ageInDays(asset.observedAt, evaluationInstant)
      const freshnessLimit = tighterDayLimit(asset.staleAfterDays, required.maxAgeDays)
      if (freshnessLimit !== null && age > freshnessLimit) {
        assetFailures.push({
          classId: required.classId,
          kind: 'STALE',
          detail: `Asset ${asset.name} was observed ${Math.floor(age)} days ago, beyond the ${freshnessLimit} day freshness limit.`,
          assetLogicalId: asset.logicalId,
        })
      }

      const permittedCeiling = tighterClassification(required.maxDataClassification, grantDataClassificationLimit)
      if (dataClassificationOrdinal(asset.classification) > dataClassificationOrdinal(permittedCeiling)) {
        assetFailures.push({
          classId: required.classId,
          kind: 'CLASSIFICATION_NOT_PERMITTED',
          detail: `Asset ${asset.name} is classified ${asset.classification}, above the permitted ceiling of ${permittedCeiling}.`,
          assetLogicalId: asset.logicalId,
        })
      }

      if (assetFailures.length === 0) {
        classSatisfied = true
        satisfying.push(asset.logicalId)
        break
      }
      failures.push(...assetFailures)
    }

    if (classSatisfied) {
      satisfied += 1
    } else {
      gaps.push(...failures)
    }
  }

  const requiredCount = requiredClasses.length
  return {
    requiredClassCount: requiredCount,
    satisfiedClassCount: satisfied,
    gaps,
    completenessRatio: requiredCount === 0 ? 1 : satisfied / requiredCount,
    satisfyingAssetLogicalIds: satisfying,
  }
}

function tighterDayLimit(a: number | null, b: number | null): number | null {
  if (a === null) return b
  if (b === null) return a
  return Math.min(a, b)
}

function tighterClassification(
  a: DataClassification,
  b: DataClassification | null,
): DataClassification {
  if (b === null) return a
  return dataClassificationOrdinal(a) <= dataClassificationOrdinal(b) ? a : b
}
