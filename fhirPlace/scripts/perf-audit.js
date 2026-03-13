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
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PREVIEW_PORT = 4173;
// Audit the public /launch page — the root route requires SMART auth and
// immediately redirects unauthenticated visitors to an external OAuth server.
const PREVIEW_PATH = "/launch";
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

/** Find a free TCP port starting from `preferred`, incrementing on EADDRINUSE. */
function findFreePort(preferred = 4173) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(preferred, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        findFreePort(preferred + 1)
          .then(resolve)
          .catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

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

/**
 * Spawn vite preview on the given port.
 * Invokes the vite JS entry directly via the current Node binary, bypassing
 * the .cmd/.sh wrappers entirely — no shell:true needed, no DEP0190 warning.
 */
function spawnPreview(port) {
  const viteCli = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
  return spawn(
    process.execPath,
    [viteCli, "preview", "--port", String(port), "--strictPort"],
    { cwd: ROOT, stdio: "pipe" },
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

let previewProc = null;
let browser = null;

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  // 1 ── Start vite preview ───────────────────────────────────────────────────
  console.log("▶  Starting vite preview…");
  const port = await findFreePort(PREVIEW_PORT);
  const auditUrl = `http://localhost:${port}${PREVIEW_PATH}`;
  previewProc = spawnPreview(port);
  previewProc.stdout.on("data", (d) => process.stdout.write(d));
  previewProc.stderr.on("data", (d) => process.stderr.write(d));

  await waitForServer(auditUrl);
  console.log(`✔  Preview server ready at ${auditUrl}\n`);

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

  // 3 ── Navigate and wait for load ───────────────────────────────────────────
  console.log(`▶  Navigating to ${auditUrl}…`);
  await page.goto(auditUrl, { waitUntil: "load" });

  // 4 ── Inject web-vitals IIFE and set up collectors ─────────────────────────
  // Injecting AFTER navigation is correct: web-vitals uses buffered:true on
  // PerformanceObserver, so it reads back entries (FCP, TTFB, LCP) that were
  // already recorded before the script was injected.
  const webVitalsSource = fs.readFileSync(WEB_VITALS_IIFE, "utf8");
  await page.addScriptTag({ content: webVitalsSource });
  await page.evaluate(() => {
    window.__webVitals = {};
    const wv = window.webVitals;
    wv.onCLS(
      (m) => {
        window.__webVitals.CLS = m.value;
      },
      { reportAllChanges: true },
    );
    wv.onFCP((m) => {
      window.__webVitals.FCP = m.value;
    });
    wv.onLCP(
      (m) => {
        window.__webVitals.LCP = m.value;
      },
      { reportAllChanges: true },
    );
    wv.onTTFB((m) => {
      window.__webVitals.TTFB = m.value;
    });
  });

  // Allow 3 s for buffered callbacks to fire.
  await page.waitForTimeout(3_000);

  // Flush the final CLS / LCP values by simulating page-hide.
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(500);

  // 5 ── Read captured metrics ────────────────────────────────────────────────
  const metrics = await page.evaluate(() => window.__webVitals ?? {});

  // 6 ── Save JSON report ─────────────────────────────────────────────────────
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(REPORT_DIR, `report-${stamp}.json`);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      { url: auditUrl, timestamp: new Date().toISOString(), metrics },
      null,
      2,
    ),
  );
  console.log(`📄  JSON report → ${path.relative(ROOT, jsonPath)}\n`);

  // 7 ── Check thresholds ─────────────────────────────────────────────────────
  console.log(`── Core Web Vitals for ${auditUrl} ──`);
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
    try {
      previewProc.kill();
    } catch {
      /* ignore — process may have already exited */
    }
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
