/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Security headers applied to the Vite dev server.
// The same directives are enforced by helmet in server.js for production.
const securityHeaders = {
  'Content-Security-Policy':
    "default-src 'self'; " +
    "script-src 'self'; " +
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
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.ts'],
  },
})
