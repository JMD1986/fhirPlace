#!/usr/bin/env node
/**
 * scripts/lighthouse.js
 *
 * Runs a Lighthouse audit against the production build served by `vite preview`.
 * Saves HTML + JSON reports to lighthouse-reports/ and exits non-zero if any
 * category score falls below its defined threshold (CI-safe).
 *
 * Prerequisites: dist/ must exist  →  run `npm run build` first.
 * Direct usage:  node scripts/lighthouse.js
 * Via npm:       npm run lighthouse   (builds then audits in one step)
 *
 * Requires Node ≥ 22 (Lighthouse 13 requirement).
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PREVIEW_PORT = 4173;
// Audit the public /launch page — the root route requires SMART auth and
// immediately redirects unauthenticated visitors to an external OAuth server,
// causing Lighthouse to return null scores for all categories.
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}/launch`;
const REPORT_DIR = path.join(ROOT, "lighthouse-reports");

// ── Score thresholds (0–1) ────────────────────────────────────────────────────
// CI fails when any score drops below its threshold.
// Performance is lenient: a React SPA with no SSR will score lower on cold-start
// LCP even with code-splitting in place.
// Accessibility is strict because this is a clinical tool (WCAG compliance).
const THRESHOLDS = {
  performance: 0.5,
  accessibility: 0.85,
  "best-practices": 0.8,
  seo: 0.7,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Poll until the server responds (any non-5xx) or the timeout expires. */
async function waitForServer(url, { timeout = 30_000, interval = 500 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // server not up yet — keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Server at ${url} did not respond within ${timeout}ms`);
}

/** Resolve the local vite binary (cross-platform). */
function viteBin() {
  const bin = process.platform === "win32" ? "vite.cmd" : "vite";
  return path.join(ROOT, "node_modules", ".bin", bin);
}

// ── Main ──────────────────────────────────────────────────────────────────────

let previewProc = null;
let chrome = null;

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  // 1 ── Start vite preview ────────────────────────────────────────────────────
  console.log("▶  Starting vite preview…");
  previewProc = spawn(viteBin(), ["preview", "--port", String(PREVIEW_PORT)], {
    cwd: ROOT,
    stdio: "pipe",
    shell: false,
  });
  previewProc.stdout.on("data", (d) => process.stdout.write(d));
  previewProc.stderr.on("data", (d) => process.stderr.write(d));

  await waitForServer(PREVIEW_URL);
  console.log(`✔  Preview server ready at ${PREVIEW_URL}\n`);

  // 2 ── Launch Chrome ────────────────────────────────────────────────────────
  console.log("▶  Launching Chrome…");
  chrome = await chromeLauncher.launch({
    chromeFlags: [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox", // required in containers / CI sandboxes
      "--disable-dev-shm-usage", // prevents OOM crashes in low-memory envs
    ],
  });

  // 3 ── Run Lighthouse ────────────────────────────────────────────────────────
  console.log("▶  Running Lighthouse audit…\n");
  const result = await lighthouse(PREVIEW_URL, {
    logLevel: "warn",
    output: ["html", "json"],
    onlyCategories: Object.keys(THRESHOLDS),
    port: chrome.port,
    formFactor: "desktop",
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
    throttlingMethod: "simulate",
  });

  // 4 ── Save reports ──────────────────────────────────────────────────────────
  const [htmlReport, jsonReport] = result.report;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const htmlPath = path.join(REPORT_DIR, `report-${stamp}.html`);
  const jsonPath = path.join(REPORT_DIR, `report-${stamp}.json`);
  fs.writeFileSync(htmlPath, htmlReport);
  fs.writeFileSync(jsonPath, jsonReport);
  console.log(`📄  HTML report → ${path.relative(ROOT, htmlPath)}`);
  console.log(`📄  JSON report → ${path.relative(ROOT, jsonPath)}\n`);

  // 5 ── Check thresholds ──────────────────────────────────────────────────────
  const categories = result.lhr.categories;
  const URL_DISPLAY = result.lhr.finalDisplayedUrl;

  console.log(`── Lighthouse results for ${URL_DISPLAY} ──`);
  let anyFailed = false;

  for (const [key, threshold] of Object.entries(THRESHOLDS)) {
    const cat = categories[key];
    if (!cat) continue;

    const score = cat.score;
    if (score === null) {
      console.log(`  -  ${cat.title.padEnd(20)} N/A   (not scored)`);
      continue;
    }
    const pct = Math.round(score * 100);
    const minPct = Math.round(threshold * 100);
    const pass = score >= threshold;
    const icon = pass ? "✔" : "✖";

    console.log(
      `  ${icon}  ${cat.title.padEnd(20)} ${String(pct).padStart(3)} / 100` +
        `  (min: ${minPct})`,
    );
    if (!pass) anyFailed = true;
  }

  console.log("──────────────────────────────────────────────────\n");

  if (anyFailed) {
    console.error(
      "✖  One or more scores are below threshold. See report above.\n",
    );
    return 1;
  }

  console.log("✔  All scores meet thresholds.\n");
  return 0;
}

// ── Cleanup (runs on success, failure, and uncaught error) ────────────────────

async function cleanup() {
  if (chrome) {
    try {
      await chrome.kill();
    } catch {
      /* ignore */
    }
    chrome = null;
  }
  if (previewProc) {
    previewProc.kill("SIGTERM");
    previewProc = null;
  }
}

main()
  .then(async (code) => {
    await cleanup();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error("\nLighthouse script error:", err.message ?? err);
    await cleanup();
    process.exit(1);
  });
