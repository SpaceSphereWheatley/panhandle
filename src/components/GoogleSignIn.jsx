import { useEffect, useRef } from "react";
import { GOOGLE_CLIENT_ID } from "../lib/google.js";

// Loads Google's Identity Services script and renders the standard
// "Sign in with Google" button. `onCredential` receives the ID-token JWT
// string, which the caller POSTs to /api/auth/google for server-side
// verification — no client secret is ever needed for this flow.
export function GoogleSignIn({ onCredential }) {
  const ref = useRef(null);
  // Read through a ref so the load effect below doesn't need `onCredential`
  // in its dependency array — the parent (LoginScreen/SignupScreen) redefines
  // that callback on every render, which would otherwise reload the script
  // on every keystroke.
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    function render() {
      if (!ref.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp) => onCredentialRef.current(resp.credential),
      });
      window.google.accounts.id.renderButton(ref.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: 280,
      });
    }

    // Always fetch a fresh copy of the script instead of reusing an already-
    // loaded `window.google`. This screen remounts long after the page's
    // first load whenever a JWT session times out (the user is bounced back
    // here without a full page reload), and Google's client keeps internal
    // iframe/session state that goes stale over that kind of elapsed time —
    // renderButton then silently draws nothing. Re-executing the script
    // resets that state the same way a hard page reload would.
    document.querySelectorAll("script[data-gsi-client]").forEach((node) => node.remove());
    delete window.google;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.gsiClient = "true";
    script.onload = render;
    document.head.appendChild(script);
  }, []);

  return <div ref={ref} />;
}
