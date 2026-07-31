import {
  CONTEXT_STATUSES,
  DECISION_STATUSES,
  OPERATING_MODEL_STATE_SCOPES,
  ORGANIZATION_MODES,
  type ContextPackage,
  type ContextPackageRequest,
} from './contracts.js'

export interface ValidationIssue {
  readonly path: string
  readonly message: string
}

export interface ValidationResult {
  readonly valid: boolean
  readonly issues: readonly ValidationIssue[]
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function validateContextRequest(request: ContextPackageRequest): ValidationResult {
  const issues: ValidationIssue[] = []
  for (const [path, value] of [
    ['requestId', request.requestId],
    ['organizationId', request.organizationId],
    ['purpose', request.purpose],
    ['correlationId', request.correlationId],
    ['requestingActor.logicalId', request.requestingActor.logicalId],
    ['target.logicalId', request.target.logicalId],
    ['target.intendedAction', request.target.intendedAction],
  ] as const) {
    if (!isNonEmptyString(value)) issues.push({ path, message: `${path} is required.` })
  }
  if (request.effectiveAt !== undefined && !isIsoTimestamp(request.effectiveAt)) {
    issues.push({ path: 'effectiveAt', message: 'effectiveAt must be an ISO 8601 timestamp.' })
  }
  if (
    request.stateScope !== undefined &&
    !OPERATING_MODEL_STATE_SCOPES.includes(request.stateScope)
  ) {
    issues.push({ path: 'stateScope', message: 'stateScope is not recognized.' })
  }
  return { valid: issues.length === 0, issues }
}

export function validateContextPackage(contextPackage: ContextPackage): ValidationResult {
  const issues: ValidationIssue[] = []
  if (!ORGANIZATION_MODES.includes(contextPackage.organization.mode)) {
    issues.push({ path: 'organization.mode', message: 'Organization mode must be resolved server-side.' })
  }
  if (!CONTEXT_STATUSES.includes(contextPackage.contextStatus)) {
    issues.push({ path: 'contextStatus', message: 'Context status must use the OCS context axis.' })
  }
  if (!DECISION_STATUSES.includes(contextPackage.decisionStatus)) {
    issues.push({ path: 'decisionStatus', message: 'Decision status must use the OCS decision axis.' })
  }
  for (const field of ['evaluatedAt', 'effectiveAt', 'expiresAt'] as const) {
    if (!isIsoTimestamp(contextPackage[field])) {
      issues.push({ path: field, message: `${field} must be an ISO 8601 timestamp.` })
    }
  }
  for (const field of [
    'ontologyVersion',
    'schemaVersion',
    'ruleSetVersion',
    'contextContractVersion',
    'contextPackageHash',
    'policyDecisionId',
  ] as const) {
    if (!isNonEmptyString(contextPackage[field])) {
      issues.push({ path: field, message: `${field} is required.` })
    }
  }
  if (contextPackage.readOnly !== true) {
    issues.push({ path: 'readOnly', message: 'OCS packages are read-only.' })
  }
  if (
    contextPackage.contextConfidence.score < 0 ||
    contextPackage.contextConfidence.score > 1
  ) {
    issues.push({ path: 'contextConfidence.score', message: 'Context confidence uses the 0 to 1 scale.' })
  }
  if (
    contextPackage.decisionStatus === 'AUTHORIZED' &&
    contextPackage.contextStatus !== 'COMPLETE'
  ) {
    issues.push({
      path: 'decisionStatus',
      message: 'Incomplete, conflicted, or unavailable context can never authorize.',
    })
  }
  if (
    ['PROPOSED', 'SIMULATED', 'APPROVED'].includes(contextPackage.stateScope) &&
    contextPackage.decisionStatus !== 'NOT_APPLICABLE'
  ) {
    issues.push({
      path: 'decisionStatus',
      message: 'Future-state evaluations are advisory and must be NOT_APPLICABLE.',
    })
  }
  return { valid: issues.length === 0, issues }
}

export function assertValidContextPackage(contextPackage: ContextPackage): void {
  const result = validateContextPackage(contextPackage)
  if (!result.valid) {
    throw new Error(
      `Invalid Context Package. ${result.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join('; ')}`,
    )
  }
}
