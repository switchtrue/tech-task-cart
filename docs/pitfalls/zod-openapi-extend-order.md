# Pitfall: zod-to-openapi must extend Zod before schemas are constructed

## Problem
`@asteasolutions/zod-to-openapi` v8 (Zod 4) adds an `.openapi()` method that its
`OpenAPIRegistry.register()` relies on. The extension is applied by
`extendZodWithOpenApi(z)`. If schemas are constructed (module-evaluated) *before*
that call runs, registration fails with `zodSchema.openapi is not a function`.

Under ESM, a module's imports are fully evaluated before its own body runs — so
calling `extendZodWithOpenApi` in the same file that imports the schemas is too
late: the schema modules already ran.

## Rule in this codebase
- `packages/contracts/src/zod-openapi.ts` calls `extendZodWithOpenApi(z)` once and
  re-exports `z`.
- All schema modules (`domain.ts`, `errors.ts`) import `z` from
  `./zod-openapi.js`, never directly from `zod`. This guarantees the extension
  runs before any schema is built.
