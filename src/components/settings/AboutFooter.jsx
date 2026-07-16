import { useState } from "react";
import { ChangelogModal } from "../ChangelogModal.jsx";
import { FeedbackModal } from "../FeedbackModal.jsx";
import { APP_VERSION } from "../../lib/version.js";
import logoMark from "../../design-system/assets/logo/panhandle-mark.svg";

const linkStyle = { background: "none", border: "none", color: "var(--text-link)", font: "inherit", fontSize: "var(--text-xs)", cursor: "pointer", padding: 0 };

// Island 5 — "Om Appen": deliberately not a Card. Low-priority, flat
// utility text at the very bottom, no elevated backdrop.
export function AboutFooter() {
  const [showChangelog, setShowChangelog] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <div style={{ textAlign: "center", padding: "24px 0 8px", color: "var(--text-tertiary)" }}>
      <img src={logoMark} alt="" style={{ width: 28, height: 28, opacity: 0.6, marginBottom: 6 }} />
      <div style={{ fontSize: "var(--text-xs)" }}>Panhandle {APP_VERSION}</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 4 }}>
        <button onClick={() => setShowChangelog(true)} style={linkStyle}>Hva er nytt?</button>
        <button onClick={() => setShowFeedback(true)} style={linkStyle}>Send tilbakemelding</button>
      </div>
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </div>
  );
}
