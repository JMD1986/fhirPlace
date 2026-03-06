/**
 * reportWebVitals.ts
 *
 * Collects Core Web Vitals and forwards each metric to the provided handler.
 *
 * Expected payload shape sent to the analytics endpoint:
 * ```json
 * {
 *   "name":  "LCP",        // Metric name: CLS | FCP | INP | LCP | TTFB
 *   "value": 1234.56,      // Current metric value (ms for time-based, score for CLS)
 *   "id":    "v4-...",     // Unique ID for this page load / metric instance
 *   "delta": 1234.56       // Change in value since the last report for this metric
 * }
 * ```
 *
 * In production, the handler POSTs this payload to VITE_VITALS_ENDPOINT.
 * In development, the handler is console.log.
 */

import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

/** The subset of a Web Vitals metric that is sent to the analytics endpoint. */
export interface VitalsPayload {
  name: Metric['name'];
  value: number;
  id: string;
  delta: number;
}

export type ReportHandler = (payload: VitalsPayload) => void;

/**
 * Registers listeners for all supported Web Vitals and calls `onPerfEntry`
 * with a {@link VitalsPayload} whenever a metric is ready or updated.
 *
 * @param onPerfEntry - Callback invoked for each metric report.
 */
export function reportWebVitals(onPerfEntry: ReportHandler): void {
  const wrap = (metric: Metric): void =>
    onPerfEntry({ name: metric.name, value: metric.value, id: metric.id, delta: metric.delta });

  onCLS(wrap);
  onFCP(wrap);
  onINP(wrap);
  onLCP(wrap);
  onTTFB(wrap);
}
