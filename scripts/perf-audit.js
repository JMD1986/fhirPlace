#!/usr/bin/env node
/**
 * scripts/perf-audit.js
 *
 * Playwright-based Core Web Vitals audit against the production build served
 * by `vite preview`. Uses Playwright's bundled Chromium — no system Chrome
 * required, no browser version mismatches, CI-safe.
 *
 * Metrics audited : LCP, CLS, FCP, TTFB
 * (INP is skipped — it requires genuine user interaction and is not
 *  reliably measurable in a synthetic headless run.)
 *
 * Thresholds match Google's "good" / "needs improvement" CWV boundary values.
 * CI fails (exit 1) when any captured metric exceeds its threshold.
 *
 * Prerequisites : dist/ must exist → run `npm run build` first.
 * Direct usage  : node scripts/perf-audit.js
 * Via npm        : npm run perf:audit   (builds then audits in one step)
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PREVIEW_PORT = 4173;
// Audit the public /launch page — the root route requires SMART auth and
// immediately redirects unauthenticated visitors to an external OAuth server.
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}/launch`;
const REPORT_DIR = path.join(ROOT, "perf-reports");

// Path to the web-vitals IIFE build (already a project dependency).
const WEB_VITALS_IIFE = path.join(
  ROOT,
  "node_modules",
  "web-vitals",
  "dist",
  "web-vitals.iife.js",
);

// ── Score thresholds ──────────────────────────────────────────────────────────
// CI fails when any captured metric exceeds its threshold.
// Values are the "good" / "needs improvement" boundary from web.dev/vitals.
const THRESHOLDS = {
  LCP: { max: 2500, unit: "ms", label: "Largest Contentful Paint" },
  CLS: { max: 0.1, unit: "", label: "Cumulative Layout Shift" },
  FCP: { max: 1800, unit: "ms", label: "First Contentful Paint" },
  TTFB: { max: 800, unit: "ms", label: "Time to First Byte" },
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
    await new Promise((r) => setTimeout(r, interval));
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
let browser = null;

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  // 1 ── Start vite preview ───────────────────────────────────────────────────
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

  // 2 ── Launch Playwright Chromium ───────────────────────────────────────────
  console.log("▶  Launching Chromium…");
  browser = await chromium.launch({
    args: [
      "--no-sandbox", // required in containers / CI sandboxes
      "--disable-dev-shm-usage", // prevents OOM crashes in low-memory envs
    ],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 3 ── Inject web-vitals collectors before any page script runs ─────────────
  // Combine the web-vitals IIFE and the collector setup into a single init
  // script so execution order is guaranteed.
  const webVitalsSource = fs.readFileSync(WEB_VITALS_IIFE, "utf8");
  const collectorScript = `
    window.__webVitals = {};
    var wv = window.webVitals;
    wv.onCLS( function(m) { window.__webVitals.CLS  = m.value; }, { reportAllChanges: true });
    wv.onFCP( function(m) { window.__webVitals.FCP  = m.value; });
    wv.onLCP( function(m) { window.__webVitals.LCP  = m.value; }, { reportAllChanges: true });
    wv.onTTFB(function(m) { window.__webVitals.TTFB = m.value; });
  `;
  await page.addInitScript({
    content: webVitalsSource + "\n" + collectorScript,
  });

  // 4 ── Navigate and wait for the page to settle ─────────────────────────────
  console.log(`▶  Navigating to ${PREVIEW_URL}…`);
  await page.goto(PREVIEW_URL, { waitUntil: "networkidle" });

  // Allow 2 s for LCP candidates to stabilise after network idle.
  await page.waitForTimeout(2_000);

  // Simulate page-hide to flush the final CLS and LCP values.
  // web-vitals reports its final values when visibilityState → "hidden".
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      get: () => "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  // Short wait for callbacks to fire asynchronously.
  await page.waitForTimeout(500);

  // 5 ── Read captured metrics ────────────────────────────────────────────────
  const metrics = await page.evaluate(() => window.__webVitals ?? {});

  // 6 ── Save JSON report ─────────────────────────────────────────────────────
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(REPORT_DIR, `report-${stamp}.json`);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      { url: PREVIEW_URL, timestamp: new Date().toISOString(), metrics },
      null,
      2,
    ),
  );
  console.log(`📄  JSON report → ${path.relative(ROOT, jsonPath)}\n`);

  // 7 ── Check thresholds ─────────────────────────────────────────────────────
  console.log(`── Core Web Vitals for ${PREVIEW_URL} ──`);
  let anyFailed = false;

  for (const [name, { max, unit, label }] of Object.entries(THRESHOLDS)) {
    const value = metrics[name];
    if (value === undefined) {
      console.log(
        `  -  ${label.padEnd(28)} ${"N/A".padStart(8)}  (not captured)`,
      );
      continue;
    }
    const display = unit === "ms" ? `${Math.round(value)}ms` : value.toFixed(3);
    const pass = value <= max;
    const icon = pass ? "✔" : "✖";
    console.log(
      `  ${icon}  ${label.padEnd(28)} ${display.padStart(8)}  (max: ${max}${unit})`,
    );
    if (!pass) anyFailed = true;
  }

  console.log("──────────────────────────────────────────────────\n");

  if (anyFailed) {
    console.error(
      "✖  One or more metrics exceed threshold. See report above.\n",
    );
    return 1;
  }

  console.log("✔  All metrics within thresholds.\n");
  return 0;
}

// ── Cleanup (runs on success, failure, and uncaught error) ────────────────────

async function cleanup() {
  if (browser) {
    try {
      await browser.close();
    } catch {
      /* ignore */
    }
    browser = null;
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
    console.error("\nPerf audit error:", err.message ?? err);
    await cleanup();
    process.exit(1);
  });
