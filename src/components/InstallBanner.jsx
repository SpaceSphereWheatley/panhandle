import { useState } from "react";
import { UiIcon } from "./UiIcon.jsx";
import { useInstallPrompt, isStandalone, isIos } from "../context/InstallPromptContext.jsx";

function installDismissed() {
  return localStorage.getItem("ph_install_dismissed") === "1";
}

export function InstallBanner() {
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
          <span className="txt">Installer Panhandle på hjemskjermen for raskere tilgang.</span>
          <button className="install" onClick={install}>Installer</button>
        </>
      ) : (
        <span className="txt">
          Legg til Panhandle på hjemskjermen: trykk del-ikonet <span style={{ fontWeight: 600 }}>⎋</span> og velg
          "Legg til på Hjemskjerm".
        </span>
      )}
      <button className="dismiss" onClick={dismiss} aria-label="Lukk">
        <UiIcon name="close" size={16} />
      </button>
    </div>
  );
}
