import { useState } from "react";
import { motion } from "framer-motion";
import { useInstallPrompt, isStandalone, isIos } from "../../context/InstallPromptContext.jsx";
import { useMotionConfig } from "../../hooks/useMotionConfig.js";
import { IconButton } from "../../design-system/index.js";
import { InstallHelpModal } from "./InstallHelpModal.jsx";

const DISMISS_KEY = "ph_install_cta_dismissed";

function isDismissed() {
  return localStorage.getItem(DISMISS_KEY) === "1";
}

// Island 1 PWA highlight, in three states depending on what we know about
// the device: full-size hero CTA by default (its job is to actually drive
// installs, so it stays maximally prominent until we have a reason not to);
// a quieter filled pill once `installed` looks true (a persisted signal that
// can go stale after an uninstall, so it stays visible rather than
// vanishing); and a plain text row once the user has explicitly dismissed
// it (a stronger, user-stated signal, so it's quieter still).
export function PwaInstallCTA() {
  const { canInstall, promptInstall, installed } = useInstallPrompt();
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [press, setPress] = useState(false);
  const [dismissed, setDismissed] = useState(isDismissed);
  const { shouldAnimate, transition } = useMotionConfig();

  if (isStandalone()) return null;

  function activate() {
    if (isIos()) return;
    if (canInstall) promptInstall();
    else setShowInstallHelp(true);
  }

  function dismiss(e) {
    e.stopPropagation();
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  const Wrapper = shouldAnimate ? motion.div : "div";
  const motionProps = shouldAnimate
    ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition }
    : {};
  const sharedProps = {
    ...motionProps,
    role: "button",
    tabIndex: 0,
    onClick: activate,
    onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } },
    onPointerDown: () => setPress(true),
    onPointerUp: () => setPress(false),
    onPointerLeave: () => setPress(false),
    onPointerCancel: () => setPress(false),
  };
  const pressTransform = {
    transform: press ? "scale(var(--press-scale))" : "scale(1)",
    transition: "transform var(--spring-duration-soft) var(--ease-spring-soft)",
    cursor: isIos() ? "default" : "pointer",
    userSelect: "none",
  };

  let content;
  if (installed) {
    content = (
      <Wrapper
        {...sharedProps}
        style={{
          marginBottom: 16,
          padding: "10px 14px",
          borderRadius: "var(--radius-pill)",
          background: "var(--accent-primary)",
          color: "var(--text-on-accent)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-sm)",
          fontWeight: 700,
          ...pressTransform,
        }}
      >
        <i className="ph ph-device-mobile" style={{ fontSize: 18, flexShrink: 0 }} />
        <span>Installer Panhandle</span>
      </Wrapper>
    );
  } else if (dismissed) {
    content = (
      <Wrapper
        {...sharedProps}
        style={{
          marginBottom: 16,
          padding: "10px 4px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          color: "var(--text-secondary)",
          ...pressTransform,
        }}
      >
        <i className="ph ph-device-mobile" style={{ fontSize: 17, flexShrink: 0, color: "var(--accent-primary)" }} />
        <span>Installer Panhandle</span>
      </Wrapper>
    );
  } else {
    content = (
      <Wrapper
        {...sharedProps}
        style={{
          position: "relative",
          marginBottom: 16,
          padding: "28px 24px",
          borderRadius: "var(--radius-card)",
          background: "var(--accent-primary)",
          color: "var(--text-on-accent)",
          boxShadow: "var(--elevation-shadow-3)",
          textAlign: "center",
          ...pressTransform,
        }}
      >
        <IconButton
          icon="x"
          size="sm"
          variant="ghost"
          label="Ikke nå"
          onClick={dismiss}
          style={{ position: "absolute", top: 8, right: 8, background: "transparent", color: "var(--text-on-accent)" }}
        />
        <i className="ph ph-device-mobile" style={{ fontSize: 40 }} />
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--md-headline-emphasized-size)",
            lineHeight: "var(--md-headline-emphasized-line)",
            fontWeight: "var(--weight-display-max)",
            margin: "10px 0 6px",
          }}
        >
          Installer Panhandle
        </div>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, opacity: 0.9 }}>
          {isIos()
            ? 'Trykk del-ikonet ⎋ i Safari og velg «Legg til på Hjemskjerm».'
            : "Trykk for full skjerm og rask tilgang, uten nettleserlinjer."}
        </div>
      </Wrapper>
    );
  }

  return (
    <>
      {content}
      {showInstallHelp && <InstallHelpModal onClose={() => setShowInstallHelp(false)} />}
    </>
  );
}
