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

  useEffect(() => {
    // Don't announce or move focus on first render (page load)
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setAnnouncement(document.title || "Navigated");

    // Move focus to first <h1> in <main> after navigation
    const main =
      document.getElementById("main-content") || document.querySelector("main");
    if (main) {
      const h1 = main.querySelector("h1");
      if (h1 && typeof h1.focus === "function") {
        h1.setAttribute("tabindex", "-1");
        h1.focus();
      }
    }
  }, [location]);

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
