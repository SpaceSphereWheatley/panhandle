import { useEffect, useState } from "react";
import { Modal } from "./Modal.jsx";
import { Button } from "../design-system/index.js";
import { parseChangelog } from "../lib/changelogUtils.js";
import { APP_VERSION } from "../lib/version.js";
import { useTranslation } from "../context/LanguageContext.jsx";

const FULL_CHANGELOG_URL = "/changelog.html";
// Spotlight the last few releases, not the entire history — the full log is
// still one tap away via the link below.
const RECENT_VERSIONS_COUNT = 3;

export function ChangelogModal({ onClose }) {
  const t = useTranslation();
  const [entries, setEntries] = useState(null);
  // A flag, not a message — the wording is resolved at render so it follows
  // the current language.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Version-stamped URL so a device still running the previous deploy's
        // service worker (stale-while-revalidate on the old sw.js) can't hand
        // back last version's changelog — this modal auto-opens right after a
        // deploy, exactly when that cache is stale. The new sw.js serves
        // /CHANGELOG.md network-first, making this belt-and-suspenders there.
        const res = await fetch(`/CHANGELOG.md?v=${encodeURIComponent(APP_VERSION)}`);
        if (!res.ok) throw new Error("fetch failed");
        setEntries(parseChangelog(await res.text()));
      } catch {
        setFailed(true);
      }
    })();
  }, []);

  return (
    <Modal onClose={onClose} title={t("changelog.title")}>
      {(requestClose) => (
        <>
          {/* The rendered CHANGELOG.md content below is never translated — it's
              the release history, not app chrome. */}
          <div className="changelog-box">
            {failed && <p className="cred-note">{t("changelog.loadFailed")}</p>}
            {!failed && !entries && <p className="cred-note">{t("common.loading")}</p>}
            {entries?.slice(0, RECENT_VERSIONS_COUNT).map((entry) => (
              <section key={entry.version} className="changelog-entry">
                <h4>
                  {entry.version} <span className="meta">— {entry.date}</span>
                </h4>
                <ul>
                  {entry.titles.map((title, i) => (
                    <li key={i}>{title}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(FULL_CHANGELOG_URL, "_blank", "noopener,noreferrer")}
            >
              {t("changelog.seeFull")}
            </Button>
          </div>
          <div className="actions">
            <Button variant="primary" onClick={() => requestClose()}>{t("common.close")}</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
