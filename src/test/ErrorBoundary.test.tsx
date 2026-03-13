import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";

// ── Inline ErrorFallback (mirrors App.tsx) ────────────────────────────────────

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <Box sx={{ p: 4, maxWidth: 600, mx: "auto", mt: 6 }}>
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={resetErrorBoundary}>
            Try again
          </Button>
        }
      >
        <AlertTitle>Something went wrong</AlertTitle>
        {error instanceof Error ? error.message : String(error)}
      </Alert>
    </Box>
  );
}

// ── Test components ───────────────────────────────────────────────────────────

// A component that unconditionally throws during render
function BrokenComponent(): never {
  throw new Error("Simulated render crash");
}

// A component that renders fine
function HealthyComponent() {
  return <p>All good</p>;
}

// ── Suppress React's console.error output for expected boundary errors ─────────
// React always logs caught errors to the console; we silence them in tests
// so the output stays clean while still asserting on the UI.
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ErrorBoundary (react-error-boundary)", () => {
  it("renders children normally when no error is thrown", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <HealthyComponent />
        </ErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByText("All good")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("renders the fallback UI when a child throws", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <BrokenComponent />
        </ErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Simulated render crash")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("does not render children when the boundary has caught an error", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <BrokenComponent />
        </ErrorBoundary>
      </MemoryRouter>,
    );

    // The broken component's output should never appear — only the fallback
    expect(screen.queryByText("All good")).not.toBeInTheDocument();
  });

  it("resets and re-renders children after clicking Try again", async () => {
    const user = userEvent.setup();

    // Render a boundary whose child will throw on first render, then recover
    let shouldThrow = true;

    function MaybeThrow() {
      if (shouldThrow) throw new Error("First render error");
      return <p>Recovered</p>;
    }

    render(
      <MemoryRouter>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <MaybeThrow />
        </ErrorBoundary>
      </MemoryRouter>,
    );

    // Fallback is shown
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Fix the condition before the reset re-renders the child
    shouldThrow = false;

    await user.click(screen.getByRole("button", { name: /try again/i }));

    // The boundary reset: child should now render successfully
    expect(screen.getByText("Recovered")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("displays the specific error message in the fallback", () => {
    function SpecificError(): never {
      throw new Error("FHIR resource not found");
    }

    render(
      <MemoryRouter>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <SpecificError />
        </ErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByText("FHIR resource not found")).toBeInTheDocument();
  });
});
