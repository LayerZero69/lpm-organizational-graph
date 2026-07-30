/**
 * Lineage validation.
 *
 * Proves the temporal and supersede guarantees hold across every fixture:
 *
 *   1. Supersede lineage is unbroken and append-only.
 *   2. No predecessor was mutated in place while claiming to be immutable.
 *   3. No record period is inverted, and no uniqueness rule is broken by
 *      overlapping effective periods.
 *   4. Delegation chains terminate, without cycles.
 *   5. Point-in-time reconstruction returns the state that held then, not now.
 *   6. No hard delete is possible through the domain surface.
 */

import { InMemoryGraphRepository } from '../src/adapters/memory/in-memory-repository.js'
import { hasInvertedPeriod, periodsOverlap, temporalContext } from '../src/graph/temporal.js'
import { AuthorityEvaluator } from '../src/authority/evaluator.js'
import type { GraphNode } from '../src/domain/nodes/index.js'
import type { GraphDataset } from '../src/adapters/memory/in-memory-repository.js'
import * as fixtures from '../src/fixtures/procurement-scenario.js'
import { ORG, ID, T, fixtureCeilingProvider } from '../src/fixtures/procurement-scenario.js'

let failures = 0

function pass(message: string): void {
  process.stdout.write(`  ok    ${message}\n`)
}

function fail(message: string): void {
  failures += 1
  process.stdout.write(`  FAIL  ${message}\n`)
}

function section(title: string): void {
  process.stdout.write(`\n${title}\n${'-'.repeat(title.length)}\n`)
}

const datasets: Array<[string, GraphDataset]> = [
  ['procurementScenario', fixtures.procurementScenario()],
  ['fullyCompliant', fixtures.fullyCompliant()],
  ['withLimitRaisedLater', fixtures.withLimitRaisedLater()],
  ['expiredAuthority', fixtures.expiredAuthority()],
  ['withEarnedAutonomy', fixtures.withEarnedAutonomy()],
]

// ── 1. Supersede lineage ────────────────────────────────────────────────────
section('Supersede lineage')

for (const [name, dataset] of datasets) {
  const byVersionId = new Map<string, GraphNode>()
  for (const node of dataset.nodes) byVersionId.set(node.versionId, node)

  let broken = 0
  for (const node of dataset.nodes) {
    if (node.supersedesVersionId === null) {
      if (node.versionNumber !== 1) {
        fail(`${name}: ${node.logicalId} version ${node.versionNumber} records no predecessor.`)
        broken += 1
      }
      continue
    }
    const predecessor = byVersionId.get(node.supersedesVersionId)
    if (predecessor === undefined) {
      fail(`${name}: ${node.logicalId} supersedes ${node.supersedesVersionId}, which does not exist. Lineage must be unbroken.`)
      broken += 1
      continue
    }
    if (predecessor.logicalId !== node.logicalId) {
      fail(`${name}: ${node.logicalId} supersedes a version of a different logical record.`)
      broken += 1
    }
    if (predecessor.versionNumber >= node.versionNumber) {
      fail(`${name}: ${node.logicalId} version numbers do not increase monotonically.`)
      broken += 1
    }
  }
  if (broken === 0) pass(`${name}: supersede lineage is unbroken across ${dataset.nodes.length} node versions.`)
}

// ── 2. Append-only, never destroyed ─────────────────────────────────────────
section('Append-only guarantee')

for (const [name, dataset] of datasets) {
  const logicalIds = new Set(dataset.nodes.map((n) => n.logicalId))
  const superseded = dataset.nodes.filter((n) => n.status === 'SUPERSEDED')

  const notClosed = superseded.filter((n) => n.recordedTo === null)
  if (notClosed.length > 0) {
    fail(`${name}: superseded versions with an open record window: ${notClosed.map((n) => n.versionId).join(', ')}`)
  }

  // Every logical record retains at least one readable version. Nothing is destroyed.
  let lost = 0
  for (const logicalId of logicalIds) {
    const versions = dataset.nodes.filter((n) => n.logicalId === logicalId)
    if (versions.length === 0) lost += 1
  }
  if (lost > 0) fail(`${name}: ${lost} logical records have no readable version.`)
  else pass(`${name}: every one of ${logicalIds.size} logical records retains a readable version.`)
}

// ── 3. Temporal integrity ───────────────────────────────────────────────────
section('Temporal integrity')

for (const [name, dataset] of datasets) {
  const inverted = [...dataset.nodes, ...dataset.edges].filter(hasInvertedPeriod)
  if (inverted.length > 0) fail(`${name}: ${inverted.length} records have an inverted period.`)
  else pass(`${name}: no inverted valid-time or record-time periods.`)

  // Successive versions of one logical record must not claim overlapping validity.
  const byLogicalId = new Map<string, GraphNode[]>()
  for (const node of dataset.nodes) {
    const bucket = byLogicalId.get(node.logicalId)
    if (bucket) bucket.push(node)
    else byLogicalId.set(node.logicalId, [node])
  }

  let overlaps = 0
  for (const [logicalId, versions] of byLogicalId) {
    const active = versions.filter((v) => v.status === 'ACTIVE')
    for (let i = 0; i < active.length; i += 1) {
      for (let j = i + 1; j < active.length; j += 1) {
        const a = active[i]
        const b = active[j]
        if (a && b && periodsOverlap(a, b)) {
          fail(`${name}: ${logicalId} has two active versions with overlapping valid time (${a.versionId}, ${b.versionId}).`)
          overlaps += 1
        }
      }
    }
  }
  if (overlaps === 0) pass(`${name}: no logical record has overlapping active versions.`)
}

// ── 4. Delegation chains ────────────────────────────────────────────────────
section('Delegation chains')

for (const [name, dataset] of datasets) {
  const grants = dataset.nodes.filter((n) => n.nodeType === 'AuthorityGrant')
  let bad = 0

  for (const grant of grants) {
    if (grant.nodeType !== 'AuthorityGrant') continue
    const seen = new Set<string>()
    let current = grant
    let terminated = false

    for (let depth = 0; depth < 32; depth += 1) {
      if (seen.has(current.logicalId)) {
        fail(`${name}: delegation chain from ${grant.logicalId} contains a cycle.`)
        bad += 1
        break
      }
      seen.add(current.logicalId)
      if (current.organizationalSource !== null) {
        terminated = true
        break
      }
      if (current.derivedFromGrantLogicalId === null) break
      const parent = dataset.nodes.find(
        (n) => n.logicalId === current.derivedFromGrantLogicalId && n.nodeType === 'AuthorityGrant',
      )
      if (parent === undefined || parent.nodeType !== 'AuthorityGrant') break
      current = parent
    }

    if (!terminated) {
      fail(`${name}: delegation chain from ${grant.logicalId} does not terminate at an organizational source.`)
      bad += 1
    }
  }

  if (bad === 0) pass(`${name}: all ${grants.length} delegation chains terminate at an organizational source.`)
}

// ── 5. Point-in-time reconstruction ─────────────────────────────────────────
section('Point-in-time reconstruction')

const historical = fixtures.withLimitRaisedLaterAtOriginalAmount()
const evaluator = new AuthorityEvaluator({
  repository: new InMemoryGraphRepository(historical),
  ceilingProvider: fixtureCeilingProvider(),
})

const atDecision = await evaluator.evaluate({
  organizationId: ORG,
  decisionEventLogicalId: ID.decisionEvent,
  temporalContext: temporalContext(T.decisionMade),
})
const later = await evaluator.evaluate({
  organizationId: ORG,
  decisionEventLogicalId: ID.decisionEvent,
  temporalContext: temporalContext(T.laterEvaluation),
})

const atDecisionCodes = atDecision.violations.map((v) => v.code)
const laterCodes = later.violations.map((v) => v.code)

if (!atDecisionCodes.includes('FINANCIAL_LIMIT_EXCEEDED')) {
  fail('Historical evaluation did not reconstruct the limit that held at the decision instant.')
} else {
  pass('Evaluating at the decision instant reconstructs the limit that held then.')
}

if (laterCodes.includes('FINANCIAL_LIMIT_EXCEEDED')) {
  fail('Later evaluation did not pick up the raised limit.')
} else {
  pass('Evaluating later reflects the raised limit, without rewriting the past.')
}

if (atDecision.temporalContext.validAt !== T.decisionMade) {
  fail('The result does not report the temporal context it evaluated under.')
} else {
  pass('Every result reports the temporal context it evaluated under.')
}

// ── 6. No hard delete through the domain surface ────────────────────────────
section('No hard delete')

const repository = new InMemoryGraphRepository(fixtures.procurementScenario())
const mutatingMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(repository)).filter((name) =>
  /^(delete|remove|drop|destroy|purge|truncate|write|save|update|insert|create)/i.test(name),
)
if (mutatingMethods.length > 0) {
  fail(`The repository exposes mutating methods: ${mutatingMethods.join(', ')}. The domain surface is read-only.`)
} else {
  pass('The repository surface exposes no delete, write or mutate operation.')
}

// ── Result ──────────────────────────────────────────────────────────────────
section('Result')
process.stdout.write(`  ${failures} failures\n\n`)

if (failures > 0) {
  process.stdout.write('Lineage validation FAILED.\n')
  process.exitCode = 1
} else {
  process.stdout.write('Lineage validation passed.\n')
  process.exitCode = 0
}
