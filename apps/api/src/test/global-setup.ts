import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

let dir: string;

export function setup() {
  dir = mkdtempSync(join(tmpdir(), "cart-test-"));
  const dbUrl = `file:${join(dir, "test.db")}`;
  process.env.DATABASE_URL = dbUrl;
  execFileSync(
    "pnpm",
    ["exec", "prisma", "db", "push", "--url", dbUrl, "--accept-data-loss"],
    { cwd: apiRoot, env: { ...process.env, DATABASE_URL: dbUrl }, stdio: "inherit" },
  );
}

export function teardown() {
  rmSync(dir, { recursive: true, force: true });
}
