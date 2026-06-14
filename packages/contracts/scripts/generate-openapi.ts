import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildOpenApiDocument } from "../src/openapi.js";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "openapi.json");
writeFileSync(outPath, JSON.stringify(buildOpenApiDocument(), null, 2) + "\n");
console.log(`Wrote ${outPath}`);
