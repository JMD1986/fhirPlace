import { useState, useEffect } from "react";

/**
 * Generic hook that fetches a single FHIR resource by ID.
 *
 * Eliminates the repeated useState(loading) + useState(error) + useEffect(fetch)
 * boilerplate found in every resource detail view.
 *
 * @param fetcher  An async function that accepts an ID string and returns the
 *                 resource. Use the typed helpers from src/api/fhirApi.ts, e.g.:
 *                   useFHIRResource(id, conditionApi.getById)
 * @param id       The resource ID (from useParams or a prop). Passing undefined
 *                 or an empty string keeps the hook idle.
 *
 * @example
 *   const { data: condition, loading, error } = useFHIRResource(id, conditionApi.getById);
 */
export function useFHIRResource<T>(
  id: string | undefined,
  fetcher: (id: string) => Promise<T>,
): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      // Reset all state when id is cleared so stale results don't linger
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Reset immediately so the previous resource's data/error doesn't flash
    // while the new fetch is in flight
    setData(null);
    setError(null);
    setLoading(true);

    let cancelled = false;

    const load = async () => {
      try {
        const result = await fetcher(id);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [id, fetcher]);

  return { data, loading, error };
}
