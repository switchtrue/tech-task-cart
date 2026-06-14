# Pitfall: Currency and float precision

## Problem
Representing money as floating-point (`19.99`) accumulates rounding error
(`0.1 + 0.2 !== 0.3`). Multiplying price × quantity and summing lines compounds it.

## Rule in this codebase
- Store and compute all money as **integer minor units (cents)**: `priceCents`,
  `lineSubtotalCents`, `grandTotalCents`.
- Never do arithmetic on a decimal dollar value.
- Convert to a display string (e.g. `$19.99`) only at the UI edge, via a single
  formatting helper.

## Where this is enforced
- `@cart/contracts` schemas use `z.number().int()` for all `*Cents` fields.
- The DB column is an integer.
