import { useState } from "react";
import { UiIcon } from "./UiIcon.jsx";
import { IconButton } from "../design-system/index.js";
import { useInstallPrompt, isStandalone, isIos } from "../context/InstallPromptContext.jsx";
import { useTranslation } from "../context/LanguageContext.jsx";

function installDismissed() {
  return localStorage.getItem("ph_install_dismissed") === "1";
}

export function InstallBanner() {
  const t = useTranslation();
  const { canInstall, promptInstall, installed } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(installDismissed);

  function dismiss() {
    localStorage.setItem("ph_install_dismissed", "1");
    setDismissed(true);
  }

  async function install() {
    await promptInstall();
  }

  if (isStandalone() || installed || dismissed) return null;
  if (!canInstall && !isIos()) return null;

  return (
    <div id="installBanner">
      <span className="ico"><UiIcon name="download" size={22} /></span>
      {canInstall ? (
        <>
          <span className="txt">{t("installBanner.text")}</span>
          <button className="install" onClick={install}>{t("installBanner.install")}</button>
        </>
      ) : (
        // Split around the bolded share glyph so the emphasis survives
        // translation — interpolate() substitutes strings, not React nodes.
        <span className="txt">
          {t("installBanner.iosBefore")}
          <span style={{ fontWeight: 600 }}>{t("installBanner.iosStrong")}</span>
          {t("installBanner.iosAfter")}
        </span>
      )}
      <IconButton icon="x" size="sm" variant="ghost" onClick={dismiss} label={t("common.close")} />
    </div>
  );
}
