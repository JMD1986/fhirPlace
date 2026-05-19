/**
 * Production TLS / Communications Security checks.
 * Ensures all configured data-exchange URLs use HTTPS before the app loads.
 */

export interface ProductionTlsEnv {
  PROD: boolean;
  VITE_API_BASE?: string;
  VITE_SMART_ISS?: string;
  VITE_SMART_REDIRECT_URI?: string;
  VITE_VITALS_ENDPOINT?: string;
}

export interface ProductionLocation {
  protocol: string;
  hostname: string;
}

function assertHttpsUrl(
  name: string,
  value: string | undefined,
  required: boolean,
): void {
  if (!value || value.trim() === "") {
    if (required) {
      throw new Error(
        `[SECURITY] ${name} must be set in production. ` +
          `Transmitting PHI over non-HTTPS violates HIPAA technical safeguard requirements.`,
      );
    }
    return;
  }
  if (!value.startsWith("https://")) {
    throw new Error(
      `[SECURITY] ${name} must use HTTPS in production. ` +
        `Received: "${value}". ` +
        `Transmitting PHI over non-HTTPS violates HIPAA technical safeguard requirements.`,
    );
  }
}

/**
 * Validates production TLS configuration. No-op in development.
 * @param env - Build-time env (import.meta.env or test stub)
 * @param loc - Browser location; omit in non-browser contexts
 */
export function assertProductionTlsConfig(
  env: ProductionTlsEnv,
  loc?: ProductionLocation,
): void {
  if (!env.PROD) return;

  assertHttpsUrl("VITE_API_BASE", env.VITE_API_BASE, true);
  assertHttpsUrl("VITE_SMART_ISS", env.VITE_SMART_ISS, false);
  assertHttpsUrl("VITE_SMART_REDIRECT_URI", env.VITE_SMART_REDIRECT_URI, false);
  assertHttpsUrl("VITE_VITALS_ENDPOINT", env.VITE_VITALS_ENDPOINT, false);

  if (
    loc &&
    loc.protocol !== "https:" &&
    loc.hostname !== "localhost" &&
    loc.hostname !== "127.0.0.1"
  ) {
    throw new Error(
      "[SECURITY] Application must be served over HTTPS in production.",
    );
  }
}

/** Runs TLS checks using Vite import.meta.env and window.location. */
export function assertProductionTlsConfigFromImportMeta(): void {
  assertProductionTlsConfig(
    {
      PROD: import.meta.env.PROD,
      VITE_API_BASE: import.meta.env.VITE_API_BASE as string | undefined,
      VITE_SMART_ISS: import.meta.env.VITE_SMART_ISS as string | undefined,
      VITE_SMART_REDIRECT_URI: import.meta.env.VITE_SMART_REDIRECT_URI as
        | string
        | undefined,
      VITE_VITALS_ENDPOINT: import.meta.env.VITE_VITALS_ENDPOINT as
        | string
        | undefined,
    },
    typeof location !== "undefined"
      ? { protocol: location.protocol, hostname: location.hostname }
      : undefined,
  );
}
