import { useState, useRef } from "react";
import { patientApi } from "../../api/fhirApi";
import type { Patient } from "../../types/fhir";
import type { PatientSearchParams } from "../../hooks/hookTypes";

export function usePatientSearch(
  initialParams: PatientSearchParams,
) {
  const [searchParams, setSearchParams] = useState<PatientSearchParams>(initialParams);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(0);
  const [serverOffset, setServerOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const FETCH_SIZE = 50;
  const DISPLAY_SIZE = 25;

  const prefetchedBatchRef = useRef<{
    offset: number;
    patients: Patient[];
    total: number;
  } | null>(null);

  const buildPatientParams = (offset: number) => {
    const params = new URLSearchParams();
    params.append("_count", String(FETCH_SIZE));
    params.append("_offset", String(offset));
    if (searchParams.name) params.append("name", searchParams.name);
    if (searchParams.familyName) params.append("family", searchParams.familyName);
    if (searchParams.givenName) params.append("given", searchParams.givenName);
    if (searchParams.gender) params.append("gender", searchParams.gender);
    if (searchParams.birthDate) params.append("birthdate", searchParams.birthDate);
    if (searchParams.phone) params.append("phone", searchParams.phone);
    if (searchParams.address) params.append("address", searchParams.address);
    return params;
  };

  const prefetchNextBatch = async (offset: number) => {
    try {
      const bundle = await patientApi.search(buildPatientParams(offset));
      const results: Patient[] = (bundle.entry ?? []).map(
        (e: { resource: Patient }) => e.resource,
      );
      prefetchedBatchRef.current = {
        offset,
        patients: results,
        total: bundle.total ?? results.length,
      };
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
