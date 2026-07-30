/**
 * Version markers.
 *
 * Four versions move independently and every evaluation result carries three of
 * them, so a stored result can always be re-interpreted against the contract
 * that produced it.
 */

/** Package version. Matches package.json. */
export const PACKAGE_VERSION = '0.1.0'

/** Node types, edge types, and the relationship contract registry. */
export const ONTOLOGY_VERSION = '0.1.0'

/** The authority rules, reason codes, clearing predicates, and precedence ladder. */
export const RULE_SET_VERSION = '0.1.0'

/** The shape of the typed contracts this package exports. */
export const SCHEMA_VERSION = '0.1.0'

/** The Organizational Context Services request and response contracts. */
export const CONTEXT_CONTRACT_VERSION = '0.1.0'

export const VERSIONS = {
  package: PACKAGE_VERSION,
  ontology: ONTOLOGY_VERSION,
  ruleSet: RULE_SET_VERSION,
  schema: SCHEMA_VERSION,
  contextContract: CONTEXT_CONTRACT_VERSION,
} as const
