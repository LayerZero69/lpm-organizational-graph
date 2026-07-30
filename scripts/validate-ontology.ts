/**
 * Ontology validation.
 *
 * Checks three things and exits non-zero on any failure:
 *
 *   1. The registry itself is complete and internally consistent.
 *   2. Every fixture graph satisfies the registry.
 *   3. The pinned canon values still match the canon repository, when a sibling
 *      checkout is available.
 *
 * The canon check is SKIPPED LOUDLY rather than silently when no sibling
 * checkout exists, which mirrors the derivation convention already used
 * elsewhere in the ecosystem. A skipped check is reported, never assumed to pass.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELATIONSHIP_CONTRACTS, edgeTypesWithoutContract } from '../src/domain/ontology/registry.js'
import { validateGraph } from '../src/domain/ontology/contracts.js'
import { EDGE_TYPES } from '../src/domain/edges/index.js'
import { NODE_TYPES } from '../src/domain/enums/index.js'
import { REASON_CODES } from '../src/authority/reason-codes.js'
import { AUTONOMY_SPECTRUM, CANON_PROVENANCE } from '../src/canon/index.js'
import * as fixtures from '../src/fixtures/procurement-scenario.js'
import type { GraphDataset } from '../src/adapters/memory/in-memory-repository.js'

let failures = 0
let skipped = 0

function pass(message: string): void {
  process.stdout.write(`  ok    ${message}\n`)
}

function fail(message: string): void {
  failures += 1
  process.stdout.write(`  FAIL  ${message}\n`)
}

function skip(message: string): void {
  skipped += 1
  process.stdout.write(`  SKIP  ${message}\n`)
}

function section(title: string): void {
  process.stdout.write(`\n${title}\n${'-'.repeat(title.length)}\n`)
}

// ── 1. Registry completeness ────────────────────────────────────────────────
section('Relationship contract registry')

const missing = edgeTypesWithoutContract()
if (missing.length > 0) fail(`Edge types without a contract: ${missing.join(', ')}`)
else pass(`All ${EDGE_TYPES.length} edge types have a relationship contract.`)

const duplicateTypes = RELATIONSHIP_CONTRACTS.map((c) => c.edgeType).filter(
  (type, index, all) => all.indexOf(type) !== index,
)
if (duplicateTypes.length > 0) fail(`Duplicate contracts for: ${duplicateTypes.join(', ')}`)
else pass('No edge type has more than one contract.')

const knownNodeTypes = new Set<string>(NODE_TYPES)
for (const contract of RELATIONSHIP_CONTRACTS) {
  const unknown = [...contract.allowedSourceTypes, ...contract.allowedTargetTypes].filter(
    (type) => !knownNodeTypes.has(type),
  )
  if (unknown.length > 0) fail(`${contract.edgeType} references unknown node types: ${unknown.join(', ')}`)

  const owners = contract.lapemoSourceOfTruth
  if (owners !== null) {
    const outside = Object.keys(owners).filter(
      (type) => !(contract.allowedSourceTypes as readonly string[]).includes(type),
    )
    if (outside.length > 0) {
      fail(`${contract.edgeType} declares a Lapemo owner for source types it does not allow: ${outside.join(', ')}`)
    }
  }
}
if (failures === 0) pass('Every contract references only declared node types.')

// Reversed aliases are prohibited: traversal handles direction.
const REVERSED = ['OWNED_BY', 'PARENT_OF', 'SUPERVISED_BY', 'GRANTED_BY', 'PERFORMED_BY', 'AUTHORIZES_BY']
const foundReversed = REVERSED.filter((alias) => (EDGE_TYPES as readonly string[]).includes(alias))
if (foundReversed.length > 0) fail(`Reversed aliases are prohibited: ${foundReversed.join(', ')}`)
else pass('No reversed edge aliases are declared.')

// ── 2. Reason-code registry ─────────────────────────────────────────────────
section('Reason-code registry')

const codes = REASON_CODES.map((r) => r.code)
if (new Set(codes).size !== codes.length) fail('Duplicate reason codes exist.')
else pass(`All ${codes.length} reason codes are unique.`)

const predicateIds = REASON_CODES.map((r) => r.clearingPredicateId)
if (new Set(predicateIds).size !== predicateIds.length) fail('Duplicate clearing-predicate identifiers exist.')
else pass('Every clearing-predicate identifier is unique.')

const withoutPredicate = REASON_CODES.filter((r) => r.clearingPredicate.trim().length === 0)
if (withoutPredicate.length > 0) fail(`Reason codes with no clearing predicate: ${withoutPredicate.map((r) => r.code).join(', ')}`)
else pass('Every reason code documents a clearing predicate.')

if (!codes.includes('FINANCIAL_LIMIT_EXCEEDED')) fail('FINANCIAL_LIMIT_EXCEEDED is required and is not registered.')
else pass('FINANCIAL_LIMIT_EXCEEDED is registered with a clearing predicate.')

// ── 3. Fixture graphs ───────────────────────────────────────────────────────
section('Fixture graphs')

const datasets: Array<[string, GraphDataset]> = [
  ['procurementScenario', fixtures.procurementScenario()],
  ['withinFinancialLimit', fixtures.withinFinancialLimit()],
  ['fullyCompliant', fixtures.fullyCompliant()],
  ['expiredAuthority', fixtures.expiredAuthority()],
  ['withoutAccountableOwner', fixtures.withoutAccountableOwner()],
  ['withoutSupervisor', fixtures.withoutSupervisor()],
  ['withDeactivatedSupervisor', fixtures.withDeactivatedSupervisor()],
  ['withExpandedPermission', fixtures.withExpandedPermission()],
  ['withOverreachingDelegation', fixtures.withOverreachingDelegation()],
  ['withUnearnedAutonomy', fixtures.withUnearnedAutonomy()],
  ['withEarnedAutonomy', fixtures.withEarnedAutonomy()],
  ['withConflictingPolicies', fixtures.withConflictingPolicies()],
  ['withLimitRaisedLater', fixtures.withLimitRaisedLater()],
]

for (const [name, dataset] of datasets) {
  const violations = validateGraph(dataset.nodes, dataset.edges)
  if (violations.length > 0) {
    fail(`${name}: ${violations.length} ontology violations`)
    for (const violation of violations.slice(0, 5)) {
      process.stdout.write(`          ${violation.code}  ${violation.subject}  ${violation.message}\n`)
    }
  } else {
    pass(`${name}: ${dataset.nodes.length} nodes, ${dataset.edges.length} edges, no violations`)
  }
}

// Note: withBrokenDelegation deliberately violates the node contract, because a
// grant with no authority source is exactly what that fixture exists to model.
// It is validated by the evaluator, not by the ontology validator.

// ── 4. Canon alignment ──────────────────────────────────────────────────────
section('Canon alignment')

const canonPath = resolve(process.cwd(), '..', 'lpm-canon', 'canon.lexicon.json')
if (!existsSync(canonPath)) {
  skip(`No sibling canon checkout at ${canonPath}. Pinned values were NOT verified against canon.`)
  skip(`Pinned canon version is ${CANON_PROVENANCE.version} at commit ${CANON_PROVENANCE.commit}.`)
} else {
  try {
    const lexicon = JSON.parse(readFileSync(canonPath, 'utf8')) as {
      meta: { version: string }
      autonomySpectrum: Array<{ n: number; name: string; default?: boolean }>
    }

    if (lexicon.meta.version !== CANON_PROVENANCE.version) {
      fail(`Canon version drifted. Pinned ${CANON_PROVENANCE.version}, sibling checkout is ${lexicon.meta.version}. Re-pin deliberately, do not edit values to match.`)
    } else {
      pass(`Canon version matches the pin: ${CANON_PROVENANCE.version}.`)
    }

    const canonNames = lexicon.autonomySpectrum.map((level) => level.name)
    const pinnedNames = AUTONOMY_SPECTRUM.map((level) => level.name)
    if (JSON.stringify(canonNames) !== JSON.stringify(pinnedNames)) {
      fail(`Autonomy spectrum drifted.\n          canon:  ${canonNames.join(', ')}\n          pinned: ${pinnedNames.join(', ')}`)
    } else {
      pass(`Autonomy spectrum matches canon: ${pinnedNames.join(', ')}.`)
    }

    const canonBaseline = lexicon.autonomySpectrum.find((level) => level.default === true)?.name
    const pinnedBaseline = AUTONOMY_SPECTRUM.find((level) => level.isBaseline)?.name
    if (canonBaseline !== pinnedBaseline) {
      fail(`Autonomy baseline drifted. Canon says ${canonBaseline}, pinned says ${pinnedBaseline}.`)
    } else {
      pass(`Autonomy baseline matches canon: ${pinnedBaseline}.`)
    }

    if (canonNames.includes('Agent Autonomous Plus') || canonNames.includes('Agent Autonomous+')) {
      fail('Canon unexpectedly contains an Agent Autonomous Plus level.')
    } else {
      pass('Canon contains no Agent Autonomous Plus level, as expected.')
    }
  } catch (error) {
    fail(`Could not read the sibling canon checkout: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// ── Result ──────────────────────────────────────────────────────────────────
section('Result')
process.stdout.write(`  ${failures} failures, ${skipped} skipped checks\n\n`)

if (failures > 0) {
  process.stdout.write('Ontology validation FAILED.\n')
  process.exitCode = 1
} else if (skipped > 0) {
  process.stdout.write('Ontology validation passed, with skipped checks reported above.\n')
  process.exitCode = 0
} else {
  process.stdout.write('Ontology validation passed.\n')
  process.exitCode = 0
}
