/**
 * Runtime validation for the proposed Organizational Context Services contracts.
 *
 * Hand-written validators rather than a schema library, so the package keeps zero
 * runtime dependencies and stays portable. Contract tests use these to prove that
 * every response is temporal, organization-scoped, versioned, evidence-backed and
 * read-only, which are the five properties the contract promises.
 */

import type { ContextResponseEnvelope, ContextRequestBase } from './contracts.js'

export interface ValidationIssue {
  readonly path: string
  readonly message: string
}

export interface ValidationResult {
  readonly valid: boolean
  readonly issues: readonly ValidationIssue[]
}

function ok(): ValidationResult {
  return { valid: true, issues: [] }
}

function fail(issues: ValidationIssue[]): ValidationResult {
  return { valid: issues.length === 0, issues }
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/** Validate a context request. Organization scope is mandatory on every request. */
export function validateContextRequest(request: ContextRequestBase): ValidationResult {
  const issues: ValidationIssue[] = []
  if (!isNonEmptyString(request.organizationId)) {
    issues.push({ path: 'organizationId', message: 'organizationId is required. Every context request is organization-scoped.' })
  }
  if (request.asOf !== undefined && !isIsoTimestamp(request.asOf)) {
    issues.push({ path: 'asOf', message: 'asOf must be an ISO 8601 timestamp when supplied.' })
  }
  return fail(issues)
}

/**
 * Validate a response envelope against the five promised properties.
 * A response that fails any of these is not a valid context answer.
 */
export function validateResponseEnvelope(envelope: ContextResponseEnvelope): ValidationResult {
  const issues: ValidationIssue[] = []

  if (!isIsoTimestamp(envelope.asOf)) {
    issues.push({ path: 'asOf', message: 'Every response must be temporal. asOf is required and must be ISO 8601.' })
  }
  if (!isNonEmptyString(envelope.organizationId)) {
    issues.push({ path: 'organizationId', message: 'Every response must be organization-scoped.' })
  }
  for (const field of ['ontologyVersion', 'ruleSetVersion', 'schemaVersion', 'contextContractVersion'] as const) {
    if (!isNonEmptyString(envelope[field])) {
      issues.push({ path: field, message: `Every response must be versioned. ${field} is required.` })
    }
  }
  if (typeof envelope.confidence !== 'number' || envelope.confidence < 0 || envelope.confidence > 1) {
    issues.push({ path: 'confidence', message: 'confidence must sit on the 0.0 to 1.0 scale.' })
  }
  if (!Array.isArray(envelope.evidenceRefs)) {
    issues.push({ path: 'evidenceRefs', message: 'Every response must be evidence-backed. evidenceRefs is required, and may be empty only when the answer rests on no evidence at all.' })
  }
  if (!Array.isArray(envelope.stalenessIndicators)) {
    issues.push({ path: 'stalenessIndicators', message: 'stalenessIndicators is required so a consumer can tell how fresh the answer is.' })
  }
  if (envelope.readOnly !== true) {
    issues.push({ path: 'readOnly', message: 'Organizational Context Services is read-only. readOnly must be exactly true.' })
  }

  return fail(issues)
}

/** Convenience for contract tests: assert an envelope or throw with the reasons. */
export function assertValidEnvelope(envelope: ContextResponseEnvelope): void {
  const result = validateResponseEnvelope(envelope)
  if (!result.valid) {
    const detail = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')
    throw new Error(`Invalid context response envelope. ${detail}`)
  }
}

export { ok as validationOk }
