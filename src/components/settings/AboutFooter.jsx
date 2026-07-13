import { useState } from "react";
import { ChangelogModal } from "../ChangelogModal.jsx";
import { APP_VERSION } from "../../lib/version.js";
import logoMark from "../../design-system/assets/logo/panhandle-mark.svg";

// Island 4 — "Om Appen": deliberately not a Card. Low-priority, flat
// utility text at the very bottom, no elevated backdrop.
export function AboutFooter() {
  const [showChangelog, setShowChangelog] = useState(false);

  return (
    <div style={{ textAlign: "center", padding: "24px 0 8px", color: "var(--text-tertiary)" }}>
      <img src={logoMark} alt="" style={{ width: 28, height: 28, opacity: 0.6, marginBottom: 6 }} />
      <div style={{ fontSize: "var(--text-xs)" }}>Panhandle {APP_VERSION}</div>
      <button
        onClick={() => setShowChangelog(true)}
        style={{ background: "none", border: "none", color: "var(--text-link)", font: "inherit", fontSize: "var(--text-xs)", cursor: "pointer", padding: 0, marginTop: 4 }}
      >
        Hva er nytt?
      </button>
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </div>
  );
}
