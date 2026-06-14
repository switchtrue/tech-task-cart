# ADR 0001: Monorepo with Turborepo + pnpm

## Status
Accepted

## Context
Frontend and backend must be separate apps but share a domain contract. We want
one place for shared schemas/config and a single task runner for lint/test/build.

## Decision
Use a pnpm-workspace + Turborepo monorepo. Apps in `apps/*`, shared code in
`packages/*` (`@cart/contracts`, `@cart/ui`, `@cart/tsconfig`, `@cart/eslint-config`).

## Consequences
- One install, one task graph, cached builds.
- Shared contract enforced at compile time across apps.
- Slightly more upfront config than two separate repos — justified by the shared
  contract being the core of the design.
