# ADR-004. Authority evaluation: status and reason separation with deterministic precedence

**Status:** Accepted, Phase 1A.

## Decision

An evaluation returns **exactly one primary status** and **zero or more reason codes**. A reason code is never a status and a status is never a reason.

Statuses: `AUTHORIZED`, `CONDITIONALLY_AUTHORIZED`, `NOT_AUTHORIZED`, `INDETERMINATE`.

Precedence, applied to the reason set as a whole:

1. Any `INDETERMINATE` reason wins.
2. Otherwise any `BLOCKING` reason produces `NOT_AUTHORIZED`.
3. Otherwise any `CONDITIONAL` reason produces `CONDITIONALLY_AUTHORIZED`.
4. Otherwise `AUTHORIZED`. Warnings never move the status.

## Why separation

The earlier model mixed the two, treating a code like an expired authority as both a status and a cause. That makes results impossible to aggregate, impossible to map onto condition families, and ambiguous to assert in tests. Separating them means a decision can be not authorized **for four distinct reasons**, each with its own clearing predicate, which is what someone reading the result actually needs.

## Why INDETERMINATE outranks BLOCKING

"The graph cannot answer" and "the answer is no" are different claims. Reporting an unevaluable graph as `NOT_AUTHORIZED` would manufacture a governance finding out of a data gap, and would let missing data look like enforcement working. The ladder puts `INDETERMINATE` first so that can never happen.

## Ratified: the pre-execution status for an obtainable review

**A decision within its financial limit, with human review required but obtainable, and a missing required information class, returns `CONDITIONALLY_AUTHORIZED`.**

This was open decision OD-5 in the Phase 0 assessment, recommended as `CONDITIONALLY_AUTHORIZED` and approved with the assessment. The reasoning: the authority grant is valid, the limits hold, and both gaps are actions someone can still take. That is precisely what "authorized subject to pending required actions" means.

The acceptance test asserts that single exact status. There is no `OR` assertion anywhere in the suite, because a test that accepts either of two statuses has not decided what the system should do.

## Why some information failures block and others do not

A **missing** required class is obtainable: fetch it and the condition clears. `CONDITIONAL`.

A **non-authoritative** source, **stale** data, or data used **beyond its permitted classification** is not a gap to be filled. It is a governance failure that already happened. `BLOCKING`.

## Determinism

Rules are pure functions over a fully resolved context. No rule performs I/O, reads a clock, or depends on the order the others ran in. The precedence mapping is total, pure and order independent, and a unit test asserts it over every permutation of impacts.

Rule declaration order affects only the sequence reasons are reported in, never the status.

## Rejected

**Severity scores summed to a threshold.** Opaque, and it lets several small findings silently equal one serious one.

**First-failure-wins short circuit.** Loses the other reasons, which are the useful part.

**Letting a warning move the status.** Then it is not a warning.
