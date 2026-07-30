/**
 * Authority lineage demonstration.
 *
 * Loads the synthetic procurement scenario, evaluates it, prints a readable
 * summary and then the full JSON result.
 *
 * Exit codes:
 *   0  the evaluator ran successfully, whatever business answer it produced
 *   1  a software or validation failure
 *
 * A NOT_AUTHORIZED business result is a SUCCESSFUL run. The command exits zero
 * because the graph did its job. Only a defect exits non-zero.
 */

import { InMemoryGraphRepository } from '../adapters/memory/in-memory-repository.js'
import { AuthorityEvaluator } from '../authority/evaluator.js'
import { validateGraph } from '../domain/ontology/contracts.js'
import { autonomyName } from '../canon/index.js'
import {
  procurementScenario,
  fixtureCeilingProvider,
  ORG,
  ID,
} from '../fixtures/procurement-scenario.js'
import type { EvaluationResult } from '../authority/types.js'

const RULE = '='.repeat(78)
const THIN = '-'.repeat(78)

function line(text = ''): void {
  process.stdout.write(`${text}\n`)
}

function money(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-US')}`
}

function printSummary(result: EvaluationResult): void {
  line(RULE)
  line('LPM ORGANIZATIONAL GRAPH')
  line('Authority lineage demonstration, synthetic procurement scenario')
  line(RULE)
  line()

  line('SCENARIO')
  line(THIN)
  line('A governed agent receives a request to approve a purchase of USD 42,000')
  line('from a vendor with no prior trading history.')
  line()
  line(`  Governed agent        Procurement Approval Agent`)
  line(`  Authority limit       ${money(25_000, 'USD')}`)
  line(`  Requested amount      ${money(42_000, 'USD')}`)
  line(`  Technical permission  ${money(100_000, 'USD')} in the ERP`)
  line(`  Vendor risk data      not supplied`)
  line(`  Human review          not performed`)
  line()

  line('EVALUATION')
  line(THIN)
  line(`  Status                ${result.status}`)
  line(`  Evaluated at          ${result.evaluatedAt}`)
  line(`  Confidence            ${result.confidence.toFixed(2)}`)
  line(`  Correlation id        ${result.correlationId}`)
  line(`  Ontology version      ${result.ontologyVersion}`)
  line(`  Rule set version      ${result.ruleSetVersion}`)
  line()

  line('ACCOUNTABILITY')
  line(THIN)
  line(`  Accountable human     ${result.accountablePersonLogicalId ?? 'NONE'}`)
  line(`  Supervisor            ${result.supervisorPersonLogicalId ?? 'NONE'}`)
  line(`  Governed agent        ${result.evaluatedAgentLogicalId ?? 'NONE'}`)
  line()

  line('AUTHORITY LINEAGE')
  line(THIN)
  if (result.matchingGrantLogicalId === null) {
    line('  No matching authority grant.')
  } else {
    for (const link of result.delegationChain) {
      const indent = '  '.repeat(link.depth + 1)
      const source = link.organizationalSource === null ? '' : `  [source: ${link.organizationalSource}]`
      line(`${indent}${link.grantLogicalId}  granted by ${link.grantorLogicalId}${source}`)
    }
  }
  line()

  line('VIOLATIONS')
  line(THIN)
  if (result.violations.length === 0) {
    line('  None.')
  } else {
    for (const violation of result.violations) {
      line(`  ${violation.code}  (${violation.ruleId}, ${violation.statusImpact})`)
      line(`      What happened   ${violation.detail}`)
      line(`      Clears when     ${violation.clearingPredicate}`)
      if (violation.lapemoConditionKey !== null) {
        line(`      Condition key   ${violation.lapemoConditionKey}`)
      }
      line()
    }
  }

  if (result.warnings.length > 0) {
    line('WARNINGS')
    line(THIN)
    for (const warning of result.warnings) {
      line(`  ${warning.code}  ${warning.detail}`)
    }
    line()
  }

  line('REVIEW REQUIREMENTS')
  line(THIN)
  if (result.reviewRequirements.length === 0) {
    line('  Human review is not required for this decision.')
  } else {
    for (const requirement of result.reviewRequirements) {
      line(`  ${requirement.source}  ${requirement.detail}`)
    }
  }
  line()

  line('EVIDENCE COMPLETENESS')
  line(THIN)
  const evidence = result.evidenceCompleteness
  line(`  Required classes      ${evidence.requiredClassCount}`)
  line(`  Satisfied classes     ${evidence.satisfiedClassCount}`)
  line(`  Completeness          ${(evidence.completenessRatio * 100).toFixed(0)} percent`)
  for (const gap of evidence.gaps) {
    line(`  Gap                   ${gap.classId}: ${gap.kind}`)
  }
  line()

  line('SYSTEMS AND TECHNICAL PERMISSIONS')
  line(THIN)
  line(`  Systems invoked       ${result.invokedSystemLogicalIds.join(', ') || 'none'}`)
  line(`  Permissions held      ${result.systemPermissionLogicalIds.join(', ') || 'none'}`)
  line()

  line('REQUIRED RESPONSE')
  line(THIN)
  if (result.requiredActions.length === 0) {
    line('  No action required.')
  } else {
    for (const action of result.requiredActions) {
      line(`  To clear ${action.forCode}:`)
      line(`      ${action.description}`)
      line()
    }
  }
}

async function main(): Promise<void> {
  const dataset = procurementScenario()

  // Validate the fixture before evaluating it. A malformed fixture is a software
  // defect, and a defect must never be presented as a governance finding.
  const violations = validateGraph(dataset.nodes, dataset.edges)
  if (violations.length > 0) {
    process.stderr.write('Ontology validation failed for the demonstration fixture.\n')
    for (const violation of violations) {
      process.stderr.write(`  ${violation.code}  ${violation.subject}  ${violation.message}\n`)
    }
    process.exitCode = 1
    return
  }

  const repository = new InMemoryGraphRepository(dataset)
  const evaluator = new AuthorityEvaluator({
    repository,
    ceilingProvider: fixtureCeilingProvider(),
  })

  const result = await evaluator.evaluate({
    organizationId: ORG,
    decisionEventLogicalId: ID.decisionEvent,
  })

  printSummary(result)

  line('AUTONOMY')
  line(THIN)
  line(`  Canonical baseline    ${autonomyName('AGENT_ASSISTED')}`)
  line('  Autonomy is earned, never defaulted. The ceiling for a decision context')
  line('  is derived at evaluation time and is never stored.')
  line()

  line('FULL RESULT')
  line(RULE)
  line(JSON.stringify(result, null, 2))
  line(RULE)
  line()
  line(`Evaluator completed successfully. Business result: ${result.status}.`)
  line('A NOT_AUTHORIZED result is a successful evaluation, not a software error.')

  process.exitCode = 0
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Demonstration failed with a software error: ${message}\n`)
  if (error instanceof Error && error.stack !== undefined) {
    process.stderr.write(`${error.stack}\n`)
  }
  process.exitCode = 1
})
