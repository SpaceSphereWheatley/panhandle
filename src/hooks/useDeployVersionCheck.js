import { useEffect, useRef } from "react";
import { api } from "../lib/api.js";
import { APP_VERSION, isMajorVersionBump } from "../lib/version.js";
import { parseChangelog, hasUnseenChangelogEntry } from "../lib/changelogUtils.js";

const CHECK_MS = 60000;

// Two related but distinct checks, ported from public/app.html:
// - checkVersionUpdate: compares this browser's last-seen APP_VERSION against
//   the running one. First-ever load just records it silently; a later
//   mismatch (the Pages deploy moved on since this device last opened the
//   app) either auto-opens the changelog (MAJOR bump — a breaking change,
//   per isMajorVersionBump) or shows a quiet toast with a button into the
//   changelog (MINOR/PATCH bump — not worth interrupting for). Either way
//   it first confirms there's actually something to read — see
//   hasUnseenChangelogEntry: a version bump with no changelog entry is a
//   legitimate release shape (an internal or feature-gated change still
//   alters the built output, so CLAUDE.md's rule requires the bump, but
//   there's deliberately nothing to announce), and announcing one of those
//   would send the user to a changelog whose newest entry predates the
//   version the toast just named.
// - checkForNewDeploy: catches a deploy that happened *while this tab has
//   been open* — polls the live Worker version and prompts rather than
//   reloading silently, so an in-progress edit isn't lost.
export function useDeployVersionCheck({ toast, onOpenChangelog, t }) {
  const updateAvailableRef = useRef(false);
  // Read through a ref: the effect below is mount-only (its polling timer must
  // not be torn down and rebuilt on every render), but `t` changes identity on
  // a language switch — so a toast fired later still uses the current one.
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    const last = localStorage.getItem("ph_last_version");
    // Recorded immediately, before the async check below — a slow or failed
    // changelog fetch must not leave this unset and re-fire the same
    // announcement on the next load.
    localStorage.setItem("ph_last_version", APP_VERSION);
    if (last && last !== APP_VERSION) {
      (async () => {
        let entries = null;
        try {
          const res = await fetch(`/CHANGELOG.md?v=${encodeURIComponent(APP_VERSION)}`);
          if (res.ok) entries = parseChangelog(await res.text());
        } catch {
          /* fall through — see below */
        }
        // A failed fetch falls back to announcing anyway: not being able to
        // read the changelog isn't evidence there's nothing in it, and
        // ChangelogModal degrades to its own "couldn't load" state.
        if (entries && !hasUnseenChangelogEntry(entries, { lastSeen: last, current: APP_VERSION })) return;
        if (isMajorVersionBump(last, APP_VERSION)) {
          onOpenChangelog();
        } else {
          toast(tRef.current("deploy.updatedTo", { version: APP_VERSION }), {
            actionLabel: tRef.current("deploy.whatsNew"),
            actionFn: onOpenChangelog,
          });
        }
      })();
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
        toast(tRef.current("deploy.newVersion"), {
          actionLabel: tRef.current("deploy.reload"),
          actionFn: () => location.reload(),
        });
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
