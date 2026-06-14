# ADR 0003: Contract-first REST over Hono RPC

## Status
Accepted

## Context
Hono offers an RPC client (`hono/client`) giving end-to-end type inference by
importing the server's `AppType`. That couples a consumer to (a) being TypeScript
and (b) importing backend types — an app→app dependency.

## Decision
Expose a plain REST API. Put the contract (Zod schemas, inferred DTOs, error
shape, route path map) in `@cart/contracts`, depended on by both apps. The web
client is a thin typed `fetch` wrapper that validates responses with the shared
schemas. `@cart/contracts` emits an OpenAPI document for non-TS clients.

## Consequences
- No `hono/client`, no app→app edge. Hono becomes a swappable backend detail.
- A future mobile app (Swift/Kotlin) is a first-class client: it consumes the
  same REST contract / generated OpenAPI, not TS types.
- **Trade-off:** we lose automatic compile-time checking that a called
  path/method exists on the server. Mitigated by the shared route map both sides
  import, and runtime Zod validation of responses.

## Client placement
The typed `fetch` client lives in `apps/web/src/lib/api-client.ts` — private to
the web app. `@cart/contracts` stays transport-agnostic (no `fetch`). If a second
TypeScript consumer appears (admin panel, React Native), extracting a
`@cart/client` package is a mechanical lift — move the file, add a manifest,
depend on `@cart/contracts`; the contract package never changes.
