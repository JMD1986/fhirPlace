#!/usr/bin/env node
/**
 * Fails if production source contains hardcoded http://localhost:5001 API URLs.
 * Excludes test files and commented lines.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "src");
const PATTERN = /http:\/\/localhost:5001/;

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

const violations = [];

for (const file of walk(SRC)) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  if (/\.(test|spec)\.(ts|tsx)$/.test(file)) continue;
  // Dev-only default lives here; production builds require https:// via productionSecurity.ts
  if (file.replace(/\\/g, "/").endsWith("src/api/fhirApi.ts")) continue;

  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
    if (PATTERN.test(line)) {
      violations.push(`${relative(ROOT, file)}:${i + 1}: ${trimmed}`);
    }
  });
}

if (violations.length > 0) {
  console.error(
    "TLS check failed: hardcoded http://localhost:5001 found in src/ (use API_BASE or apiUrl from fhirApi.ts):\n",
  );
  violations.forEach((v) => console.error(`  ${v}`));
  process.exit(1);
}

console.log("TLS check passed: no hardcoded http://localhost:5001 in production source.");
