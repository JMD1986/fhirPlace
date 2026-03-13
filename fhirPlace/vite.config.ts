import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Security headers applied to the Vite dev server.
// The same directives are enforced by helmet in server.js for production.
const securityHeaders = {
  'Content-Security-Policy':
    "default-src 'self'; " +
    // @vitejs/plugin-react injects an inline HMR preamble script in dev mode;
    // 'unsafe-inline' is required here. This header only applies to the Vite
    // dev server — production CSP is set by helmet in server.js and stays strict.
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " + // MUI/Emotion injects inline styles
    "img-src 'self' data:; " +
    "connect-src 'self' http://localhost:5001 https:; " +
    "font-src 'self' data:; " +
    "object-src 'none'; " +
    "frame-ancestors 'none';",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: securityHeaders,
  },
  build: {
    // Vendor UI chunk (React + MUI + Emotion) is intentionally large (~580 KB).
    // It is a stable long-cached chunk, so the size is acceptable.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Split large, stable vendor libraries into their own chunks.
        // These rarely change, so browsers can serve them from cache even
        // after app code is updated — reducing repeat-visit download size.
        // Function form assigns each module id to exactly one chunk,
        // avoiding circular-chunk warnings from the object form.
        manualChunks(id: string) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-recharts';
          }
          // React and MUI share internal imports so they go in one chunk to
          // avoid circular-chunk warnings. Both are stable and update together.
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/@mui') ||
            id.includes('node_modules/@emotion')
          ) {
            return 'vendor-ui';
          }
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.ts'],
  },
})
