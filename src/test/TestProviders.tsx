import React from "react";
import { AuthProvider } from "../context/AuthContext";
import { MemoryRouter } from "react-router-dom";

// Wraps children in AuthProvider and MemoryRouter for test environments
export function TestProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </AuthProvider>
  );
}
