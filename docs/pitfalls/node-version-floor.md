# Pitfall: Toolchain Node version floor

## Problem
Vitest 4 (via its rolldown bundler) imports `styleText` from `node:util`, which
only exists in **Node 20.12+**. On Node 20.11 the test runner crashes at startup
with `does not provide an export named 'styleText'`. Next.js 16 also requires a
recent Node.

## Rule in this codebase
- The repo pins **Node 22** (`.nvmrc` = `22.18.0`, `engines.node` = `>=22`, CI on 22).
- Run `nvm use` in the repo root before working; the shell default may be older.
