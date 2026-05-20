import { useCallback, useEffect, useRef, useState } from "react";
import { monotonicNow } from "../lib/timekeeping";

/** Milliseconds of inactivity before the session times out. Default: 15 min. */
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
/** How long before timeout to show the warning. Default: 2 min. */
const WARNING_BEFORE_MS = 2 * 60 * 1000;

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
];

interface UseInactivityTimeoutOptions {
  /** Total inactivity time (ms) before auto-logout. */
  timeoutMs?: number;
  /** How early (ms) before timeout to surface a warning. */
  warningBeforeMs?: number;
  /** Called when the timeout expires. */
  onTimeout: () => void;
  /** If false the timer is paused (e.g. no user is logged in). */
  enabled: boolean;
}

export interface InactivityTimeoutState {
  /** True when the warning window has been entered but timeout has not yet fired. */
  showWarning: boolean;
  /** Seconds remaining until timeout (only meaningful when showWarning is true). */
  secondsLeft: number;
  /** Call to acknowledge the warning and reset the inactivity clock. */
  stayLoggedIn: () => void;
}

export function useInactivityTimeout({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  warningBeforeMs = WARNING_BEFORE_MS,
  onTimeout,
  enabled,
}: UseInactivityTimeoutOptions): InactivityTimeoutState {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const showWarningRef = useRef(false);

  // Mutable refs so the event handler closures always see the latest values.
  const lastActivity = useRef(monotonicNow());
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    warningTimer.current = null;
    timeoutTimer.current = null;
    countdownInterval.current = null;
  }, []);

  const resetTimers = useCallback(() => {
    clearAllTimers();
    showWarningRef.current = false;
    setShowWarning(false);
    lastActivity.current = monotonicNow();

    // Schedule the warning
    warningTimer.current = setTimeout(() => {
      showWarningRef.current = true;
      setShowWarning(true);
      setSecondsLeft(Math.round(warningBeforeMs / 1000));

      // Start a 1-second countdown for the UI
      countdownInterval.current = setInterval(() => {
        const elapsed = monotonicNow() - lastActivity.current;
        const remaining = Math.max(
          0,
          Math.round((timeoutMs - elapsed) / 1000),
        );
        setSecondsLeft(remaining);
      }, 1000);
    }, timeoutMs - warningBeforeMs);

    // Schedule the actual timeout
    timeoutTimer.current = setTimeout(() => {
      clearAllTimers();
      showWarningRef.current = false;
      setShowWarning(false);
      onTimeout();
    }, timeoutMs);
  }, [clearAllTimers, onTimeout, timeoutMs, warningBeforeMs]);

  // Activity listener — resets the clock on any user interaction.
  useEffect(() => {
    if (!enabled) {
      clearAllTimers();
      showWarningRef.current = false;
      return;
    }

    const handleActivity = () => {
      // If the warning is showing, don't reset on incidental activity —
      // the user must explicitly click "Stay logged in".
      if (!showWarningRef.current) {
        resetTimers();
      }
    };

    resetTimers();

    for (const evt of ACTIVITY_EVENTS) {
      document.addEventListener(evt, handleActivity, { passive: true });
    }

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        document.removeEventListener(evt, handleActivity);
      }
      clearAllTimers();
    };
  }, [enabled, resetTimers, clearAllTimers]);

  /** User acknowledged the warning — reset the full inactivity window. */
  const stayLoggedIn = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  return {
    showWarning: enabled ? showWarning : false,
    secondsLeft: enabled ? secondsLeft : 0,
    stayLoggedIn,
  };
}
