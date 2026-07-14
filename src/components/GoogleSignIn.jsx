import { useEffect, useRef } from "react";
import { GOOGLE_CLIENT_ID } from "../lib/google.js";

// Loads Google's Identity Services script once and renders the standard
// "Sign in with Google" button. `onCredential` receives the ID-token JWT
// string, which the caller POSTs to /api/auth/google for server-side
// verification — no client secret is ever needed for this flow.
export function GoogleSignIn({ onCredential }) {
  const ref = useRef(null);

  useEffect(() => {
    function render() {
      if (!ref.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp) => onCredential(resp.credential),
      });
      window.google.accounts.id.renderButton(ref.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: 280,
      });
    }
    if (window.google?.accounts?.id) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [onCredential]);

  return <div ref={ref} />;
}
