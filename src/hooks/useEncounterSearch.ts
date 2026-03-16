import { useState, useEffect } from "react";
import { encounterApi } from "../api/fhirApi";
import type { FhirEncounter } from "../Components/Encounter/encounterTypes";
import type { EncounterSearchParams } from "./hookTypes";

export function useEncounterSearch(initialParams: EncounterSearchParams) {
  const [searchParams, setSearchParams] = useState<EncounterSearchParams>(initialParams);
  const [encounters, setEncounters] = useState<FhirEncounter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [snomedReasons, setSnomedReasons] = useState<{ code: string; display: string }[]>([]);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const DISPLAY_SIZE = 25;
  const [serverOffset, setServerOffset] = useState(0);

  const buildParams = (offset: number) => {
    const params = new URLSearchParams();
    params.append("_count", String(PAGE_SIZE));
    params.append("_offset", String(offset));
    for (const [key, value] of Object.entries(searchParams)) {
      if (!value) continue;
      switch (key) {
        case "patient": params.append("patient", value); break;
        case "status": params.append("status", value); break;
        case "classCode": params.append("class", value); break;
        case "type": params.append("type", value); break;
        case "dateFrom": params.append("date", `ge${value}"); break;
        case "dateTo": params.append("date", `le${value}"); break;
        case "reason": params.append("reason", value); break;
      }
    }
    return params;
  };

  const fetchPage = async (offset: number) => {
    setLoading(true);
    try {
      const bundle = await encounterApi.search(buildParams(offset));
      const results: FhirEncounter[] = (bundle.entry ?? []).map(
        (e) => e.resource as FhirEncounter,
      );
      setEncounters(results);
      setTotal(bundle.total ?? results.length);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Search failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      encounterApi.getTypes(),
      encounterApi.getClasses(),
      fetch("/resources/snomed.json").then((r) => r.json()),
    ])
      .then(([types, classes, snomed]) => {
        setTypeOptions(types);
        setClassOptions(classes);
        setSnomedReasons(snomed);
      })
      .catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSearchParams((prev) => ({ ...prev, [name]: value }));
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearched(true);
    setPage(0);
    setServerOffset(0);
    await fetchPage(0);
  };

  const handlePageChange = async (_e: unknown, newPage: number) => {
    setPage(newPage);
    const nextServerOffset = serverOffset + PAGE_SIZE;
    const firstPageOfNextBatch = Math.floor(nextServerOffset / DISPLAY_SIZE);
    if (newPage === firstPageOfNextBatch) {
      setServerOffset(nextServerOffset);
      await fetchPage(nextServerOffset);
    }
  };

  const handleReset = () => {
    setSearchParams(initialParams);
    setSearched(false);
    setEncounters([]);
    setTotal(null);
    setPage(0);
    setServerOffset(0);
    setError(null);
  };

  return {
    searchParams,
    setSearchParams,
    encounters,
    setEncounters,
    loading,
    error,
    searched,
    setSearched,
    total,
    setTotal,
    typeOptions,
    classOptions,
    snomedReasons,
    page,
    setPage,
    PAGE_SIZE,
    DISPLAY_SIZE,
    serverOffset,
    setServerOffset,
    handleChange,
    handleSearch,
    handlePageChange,
    handleReset,
    fetchPage,
  };
}
