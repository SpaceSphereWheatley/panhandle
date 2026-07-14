import { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY } from "../lib/turnstile.js";

// Loads Cloudflare's Turnstile script once and renders the widget into this
// component's div. No npm dependency, matching the rest of this app's
// (and the Worker's) zero-external-deps style.
export function Turnstile({ onToken }) {
  const ref = useRef(null);

  useEffect(() => {
    function render() {
      if (!ref.current || !window.turnstile) return;
      window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: onToken,
        "expired-callback": () => onToken(null),
      });
    }
    if (window.turnstile) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [onToken]);

  return <div ref={ref} style={{ margin: "8px 0" }} />;
}
