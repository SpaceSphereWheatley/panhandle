import { useState } from "react";
import { motion } from "framer-motion";
import { useInstallPrompt, isStandalone, isIos } from "../../context/InstallPromptContext.jsx";
import { useMotionConfig } from "../../hooks/useMotionConfig.js";
import { InstallHelpModal } from "./InstallHelpModal.jsx";

// Island 1 PWA highlight — not a row inside ProfileIsland's card, but its own
// massive, high-contrast CTA: a solid --accent-primary fill (the app's vivid
// terracotta/orange primary tone) with an organic blob shape via
// --radius-card, and the entire block acting as the tap target rather than a
// button nested in a paragraph.
export function PwaInstallCTA() {
  const { canInstall, promptInstall, installed } = useInstallPrompt();
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [press, setPress] = useState(false);
  const { shouldAnimate, transition } = useMotionConfig();

  if (isStandalone() || installed) return null;

  function activate() {
    if (isIos()) return;
    if (canInstall) promptInstall();
    else setShowInstallHelp(true);
  }

  const Wrapper = shouldAnimate ? motion.div : "div";
  const motionProps = shouldAnimate
    ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition }
    : {};

  return (
    <>
      <Wrapper
        {...motionProps}
        role="button"
        tabIndex={0}
        onClick={activate}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } }}
        onPointerDown={() => setPress(true)}
        onPointerUp={() => setPress(false)}
        onPointerLeave={() => setPress(false)}
        onPointerCancel={() => setPress(false)}
        style={{
          marginBottom: 16,
          padding: "28px 24px",
          borderRadius: "var(--radius-card)",
          background: "var(--accent-primary)",
          color: "var(--text-on-accent)",
          boxShadow: "var(--elevation-shadow-3)",
          textAlign: "center",
          cursor: isIos() ? "default" : "pointer",
          userSelect: "none",
          transform: press ? "scale(var(--press-scale))" : "scale(1)",
          transition: "transform var(--spring-duration-soft) var(--ease-spring-soft)",
        }}
      >
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
      {showInstallHelp && <InstallHelpModal onClose={() => setShowInstallHelp(false)} />}
    </>
  );
}
