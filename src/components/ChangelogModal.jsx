import { useEffect, useState } from "react";
import { Modal } from "./Modal.jsx";
import { Button } from "../design-system/index.js";
import { parseChangelog } from "../lib/changelogUtils.js";

const FULL_CHANGELOG_URL = "/changelog.html";
// Spotlight the last few releases, not the entire history — the full log is
// still one tap away via the link below.
const RECENT_VERSIONS_COUNT = 3;

export function ChangelogModal({ onClose }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/CHANGELOG.md");
        if (!res.ok) throw new Error("fetch failed");
        setEntries(parseChangelog(await res.text()));
      } catch {
        setError("Kunne ikke laste endringslogg.");
      }
    })();
  }, []);

  return (
    <Modal onClose={onClose} title="Hva er nytt">
      <div className="changelog-box">
        {error && <p className="cred-note">{error}</p>}
        {!error && !entries && <p className="cred-note">Laster...</p>}
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
      <a
        className="cred-note changelog-full-link"
        href={FULL_CHANGELOG_URL}
        target="_blank"
        rel="noreferrer"
      >
        Se hele endringsloggen
      </a>
      <div className="actions">
        <Button variant="primary" onClick={onClose}>Lukk</Button>
      </div>
    </Modal>
  );
}
