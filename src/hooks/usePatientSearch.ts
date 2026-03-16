import { useState, useRef } from "react";
import { patientApi } from "../api/fhirApi";
import type { Patient } from "../types/fhir";

const DISPLAY_SIZE = 10;
const FETCH_SIZE = 20;

const initialParams = {
  name: "",
  identifier: "",
  birthdate: "",
};

export function usePatientSearch() {
  const [searchParams, setSearchParams] = useState(initialParams);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(0);
  const [serverOffset, setServerOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const prefetchedBatchRef = useRef<Patient[] | null>(null);

  const buildPatientParams = (offset: number) => {
    const params: Record<string, string | number> = {
      _count: FETCH_SIZE,
      _getpagesoffset: offset,
    };
    if (searchParams.name) params["name"] = searchParams.name;
    if (searchParams.identifier) params["identifier"] = searchParams.identifier;
    if (searchParams.birthdate) params["birthdate"] = searchParams.birthdate;
    return new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  };

  const prefetchNextBatch = async (offset: number) => {
    try {
      const bundle = await patientApi.search(buildPatientParams(offset));
      const results: Patient[] = (bundle.entry ?? []).map(
        (e: { resource: Patient }) => e.resource,
      );
      prefetchedBatchRef.current = results;
    } catch {
      // Silently ignore
    }
  };

  const fetchPatientPage = async (offset: number) => {
    setLoading(true);
    try {
      const bundle = await patientApi.search(buildPatientParams(offset));
      const results: Patient[] = (bundle.entry ?? []).map(
        (e: { resource: Patient }) => e.resource,
      );
      setFilteredPatients(results);
      setTotal(bundle.total ?? results.length);
      setError(null);
      const serverTotal = bundle.total ?? results.length;
      prefetchedBatchRef.current = null;
      if (serverTotal > offset + FETCH_SIZE) {
        prefetchNextBatch(offset + FETCH_SIZE);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to search patients");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSearchParams((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearched(true);
    setPage(0);
    setServerOffset(0);
    await fetchPatientPage(0);
  };

  const handleClear = () => {
    setSearchParams(initialParams);
    setFilteredPatients([]);
    setTotal(null);
    setSearched(false);
    setPage(0);
    setServerOffset(0);
  };

  return {
    searchParams,
    setSearchParams,
    filteredPatients,
    setFilteredPatients,
    loading,
    error,
    searched,
    setSearched,
    page,
    setPage,
    serverOffset,
    setServerOffset,
    total,
    setTotal,
    handleChange,
    handleSearch,
    handleClear,
    fetchPatientPage,
    prefetchNextBatch,
    DISPLAY_SIZE,
    FETCH_SIZE,
    prefetchedBatchRef,
  };
}
