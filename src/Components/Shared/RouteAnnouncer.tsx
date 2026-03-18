import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Announces route changes to screen readers using an aria-live region.
 * On each location change, sets the announcement to document.title.
 */
export function RouteAnnouncer() {
  const location = useLocation();
  const [announcement, setAnnouncement] = useState("");
  const firstRender = useRef(true);

  // Separate effects to avoid cascading state changes and renders.
  useEffect(() => {
    // Don't announce on first render (page load)
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // Update the announcement text based on document title.
    setTimeout(() => setAnnouncement(document.title || "Navigated"), 0);
  }, [location]);

  // Move focus to the first <h1> in <main> after announcement updates.
  useEffect(() => {
    if (firstRender.current) return;
    const main =
      document.getElementById("main-content") || document.querySelector("main");
    if (main) {
      const h1 = main.querySelector("h1");
      if (h1 && typeof (h1 as HTMLElement).focus === "function") {
        h1.setAttribute("tabindex", "-1");
        (h1 as HTMLElement).focus();
      }
    }
  }, [announcement]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only route-announcer"
      tabIndex={-1}
    >
      {announcement}
    </div>
  );
}
