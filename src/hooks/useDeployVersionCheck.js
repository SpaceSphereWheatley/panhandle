import { useEffect, useRef } from "react";
import { api } from "../lib/api.js";
import { APP_VERSION, isFeatureVersionBump } from "../lib/version.js";

const CHECK_MS = 60000;

// Two related but distinct checks, ported from public/app.html:
// - checkVersionUpdate: compares this browser's last-seen APP_VERSION against
//   the running one. First-ever load just records it silently; a later
//   mismatch (the Pages deploy moved on since this device last opened the
//   app) either auto-opens the changelog (MAJOR/MINOR bump — a real new
//   capability, per isFeatureVersionBump) or shows a quiet toast with a
//   button into the changelog (PATCH-only bump — a fix/tweak not worth
//   interrupting for).
// - checkForNewDeploy: catches a deploy that happened *while this tab has
//   been open* — polls the live Worker version and prompts rather than
//   reloading silently, so an in-progress edit isn't lost.
export function useDeployVersionCheck({ toast, onOpenChangelog }) {
  const updateAvailableRef = useRef(false);

  useEffect(() => {
    const last = localStorage.getItem("ph_last_version");
    localStorage.setItem("ph_last_version", APP_VERSION);
    if (last && last !== APP_VERSION) {
      if (isFeatureVersionBump(last, APP_VERSION)) {
        onOpenChangelog();
      } else {
        toast(`Oppdatert til v${APP_VERSION}`, { actionLabel: "Hva er nytt?", actionFn: onOpenChangelog });
      }
    }

    async function checkForNewDeploy() {
      if (updateAvailableRef.current) return;
      let apiVersion = null;
      try {
        apiVersion = (await api("/version")).version;
      } catch {
        return;
      }
      if (apiVersion && apiVersion !== APP_VERSION) {
        updateAvailableRef.current = true;
        toast("En ny versjon er tilgjengelig", { actionLabel: "Oppdater", actionFn: () => location.reload() });
      }
    }

    const timer = setInterval(() => {
      if (!document.hidden) checkForNewDeploy();
    }, CHECK_MS);
    function onVisible() {
      if (!document.hidden) checkForNewDeploy();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
