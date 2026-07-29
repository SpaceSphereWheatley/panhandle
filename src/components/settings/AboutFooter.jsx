import { useState } from "react";
import { ChangelogModal } from "../ChangelogModal.jsx";
import { FeedbackModal } from "../FeedbackModal.jsx";
import { OnboardingFlow } from "../onboarding/OnboardingFlow.jsx";
import { APP_VERSION } from "../../lib/version.js";
import { useTranslation } from "../../context/LanguageContext.jsx";
import logoMark from "../../design-system/assets/logo/panhandle-mark.svg";

const linkStyle = { background: "none", border: "none", color: "var(--text-link)", font: "inherit", fontSize: "var(--text-xs)", cursor: "pointer", padding: 0 };

// Island 5 — "Om Appen": deliberately not a Card. Low-priority, flat
// utility text at the very bottom, no elevated backdrop.
export function AboutFooter() {
  const t = useTranslation();
  const [showChangelog, setShowChangelog] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  return (
    <div style={{ textAlign: "center", padding: "24px 0 8px", color: "var(--text-tertiary)" }}>
      <img src={logoMark} alt="" style={{ width: 28, height: 28, opacity: 0.6, marginBottom: 6 }} />
      <div style={{ fontSize: "var(--text-xs)" }}>Panhandle {APP_VERSION}</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 4 }}>
        <button onClick={() => setShowChangelog(true)} style={linkStyle}>{t("settings.about.whatsNew")}</button>
        <button onClick={() => setShowFeedback(true)} style={linkStyle}>{t("settings.about.feedback")}</button>
        <button onClick={() => setShowOnboarding(true)} style={linkStyle}>{t("settings.about.replayOnboarding")}</button>
      </div>
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
      {showOnboarding && (
        // Not the Modal/Sheet component — the onboarding is a full-screen
        // takeover, same shape as its first-login appearance in App.jsx's
        // Root(), not a sheet/dialog. z-index above Header/TabBar (both 10)
        // and Sheet (100) so it fully covers the app underneath.
        <div style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
          <OnboardingFlow onDone={() => setShowOnboarding(false)} />
        </div>
      )}
    </div>
  );
}
