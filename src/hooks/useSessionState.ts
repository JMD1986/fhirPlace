/**
 * useSessionState
 *
 * A lightweight in-memory key/value store for ephemeral UI state that should:
 *   ✔  Survive in-app navigation (React unmount/remount of a component)
 *   ✔  Reset on page refresh or when the user leaves the app
 *   ✔  Reset when the caller explicitly calls clear()
 *
 * Contrast with:
 *   sessionStorage – survives page refreshes within the same tab (too persistent)
 *   useState       – resets whenever the component unmounts (not persistent enough)
 *
 * Implementation: a plain module-level Map.  Because ES modules are evaluated
 * once per page load, the Map is fresh on every hard navigation / refresh and
 * discarded when the tab closes.  It stays alive for the lifetime of the SPA
 * session, so navigating between routes doesn't lose the state.
 */

const _store = new Map<string, unknown>();

/**
 * useState-compatible hook backed by the module-level store.
 *
 * @param key    Unique string key (e.g. "patientSearch")
 * @param init   Initial value (used when nothing is cached yet)
 * @returns      [value, setter, clear]
 *               `setter` accepts a new value or an updater function, identical
 *               to the React useState setter.
 *               `clear` removes the key from the store (resets to init).
 *
 * @example
 *   const [params, setParams, clearParams] = useSessionState("patientSearch", defaultParams);
 */
import { useState, useCallback } from "react";

export function useSessionState<T>(
  key: string,
  init: T,
): [T, (valOrUpdater: T | ((prev: T) => T)) => void, () => void] {
  const [value, setReactState] = useState<T>(() => {
    return _store.has(key) ? (_store.get(key) as T) : init;
  });

  const setValue = useCallback(
    (valOrUpdater: T | ((prev: T) => T)) => {
      setReactState((prev) => {
        const next =
          typeof valOrUpdater === "function"
            ? (valOrUpdater as (prev: T) => T)(prev)
            : valOrUpdater;
        _store.set(key, next);
        return next;
      });
    },
    [key],
  );

  const clear = useCallback(() => {
    _store.delete(key);
    setReactState(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [value, setValue, clear];
}
