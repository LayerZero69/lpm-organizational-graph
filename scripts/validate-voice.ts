/**
 * Voice validation.
 *
 * The canon voice rules are load-bearing for this repository, so they are
 * enforced mechanically rather than left to review. Checks every source file,
 * script and document for:
 *
 *   1. Em dashes in any rendered string or document.
 *   2. The prohibited legacy phrase for governed machine actors.
 *   3. Layer or module shorthand codes on a user-facing surface.
 *   4. Any appearance of the retired Agent Autonomous Plus level outside the
 *      one adapter module whose job is to map it away.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const SCAN_DIRS = ['src', 'scripts', 'docs', 'tests']
const SCAN_FILES = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md']

/** The single module allowed to name the legacy autonomy value, in order to map it. */
const AUTONOMY_MAPPING_MODULE = join('src', 'adapters', 'lapemo', 'autonomy-mapping.ts')
const AUTONOMY_MAPPING_TEST = join('tests', 'unit', 'ontology-and-adapters.test.ts')
const INTEGRATION_BLOCKERS_DOC = join('docs', 'INTEGRATION_BLOCKERS.md')
const INTEGRATION_DOC = join('docs', 'INTEGRATION.md')

interface Finding {
  readonly file: string
  readonly line: number
  readonly rule: string
  readonly text: string
}

const findings: Finding[] = []

function walk(dir: string): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue
      out.push(...walk(full))
    } else if (/\.(ts|md|json|yml|yaml)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const files = [
  ...SCAN_DIRS.flatMap((dir) => walk(join(ROOT, dir))),
  ...SCAN_FILES.map((file) => join(ROOT, file)),
]

/**
 * This validator necessarily contains the exact patterns it detects, so it
 * excludes itself. Every other file, including the rest of the scripts
 * directory, is scanned.
 */
const SELF = join('scripts', 'validate-voice.ts')

for (const file of files) {
  let content: string
  try {
    content = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  const relativePath = relative(ROOT, file)
  if (relativePath === SELF) continue
  const lines = content.split(/\r?\n/)

  lines.forEach((text, index) => {
    const lineNumber = index + 1

    // 1. Em dashes.
    if (text.includes('—')) {
      findings.push({ file: relativePath, line: lineNumber, rule: 'no-em-dash', text: text.trim() })
    }

    // 2. Prohibited legacy phrase for governed machine actors. Quoting the rule
    //    itself is permitted, which is why the negated form is excluded.
    if (/\bAI agents?\b/i.test(text) && !/not\s+["']?AI agents?/i.test(text) && !/never\s+["']?AI agents?/i.test(text)) {
      findings.push({ file: relativePath, line: lineNumber, rule: 'governed-agents-language', text: text.trim() })
    }

    // 3. Layer and module shorthand codes on a user-facing surface.
    if (/\b(L[1-7]|M[1-8])\b/.test(text) && !relativePath.startsWith('docs' + sep + 'ADR')) {
      findings.push({ file: relativePath, line: lineNumber, rule: 'no-layer-or-module-codes', text: text.trim() })
    }

    // 4. The retired autonomy level, outside the modules that exist to map or
    //    document it away.
    const mappingAllowed =
      relativePath === AUTONOMY_MAPPING_MODULE ||
      relativePath === AUTONOMY_MAPPING_TEST ||
      relativePath === INTEGRATION_BLOCKERS_DOC ||
      relativePath === INTEGRATION_DOC ||
      relativePath === join('src', 'canon', 'index.ts') ||
      relativePath === join('scripts', 'validate-voice.ts') ||
      relativePath === join('scripts', 'validate-ontology.ts') ||
      relativePath.startsWith('docs' + sep + 'ADR')
    if (/AGENT_AUTONOMOUS_PLUS|Agent Autonomous Plus|Agent Autonomous\+/.test(text) && !mappingAllowed) {
      findings.push({ file: relativePath, line: lineNumber, rule: 'no-retired-autonomy-level', text: text.trim() })
    }
  })
}

process.stdout.write(`Voice validation across ${files.length} files\n`)
process.stdout.write(`${'-'.repeat(40)}\n`)

if (findings.length === 0) {
  process.stdout.write('  ok    No voice-rule violations.\n\n')
  process.stdout.write('Voice validation passed.\n')
  process.exitCode = 0
} else {
  const byRule = new Map<string, Finding[]>()
  for (const finding of findings) {
    const bucket = byRule.get(finding.rule)
    if (bucket) bucket.push(finding)
    else byRule.set(finding.rule, [finding])
  }
  for (const [rule, group] of byRule) {
    process.stdout.write(`\n  ${rule}: ${group.length} violations\n`)
    for (const finding of group.slice(0, 10)) {
      process.stdout.write(`    ${finding.file}:${finding.line}  ${finding.text.slice(0, 90)}\n`)
    }
  }
  process.stdout.write('\nVoice validation FAILED.\n')
  process.exitCode = 1
}
