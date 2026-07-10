import { createContext, useContext, useEffect, useState } from "react";

const InstallPromptContext = createContext(null);

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
export function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

// Captures the browser's `beforeinstallprompt` event (must be listened for
// unconditionally from page load, before we know if the user is logged in)
// so the deferred prompt is available whenever the app later wants to show
// an install banner or a manual "Installer" button.
export function InstallPromptProvider({ children }) {
  const [deferredEvent, setDeferredEvent] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredEvent(e);
    }
    function onAppInstalled() {
      setInstalled(true);
      setDeferredEvent(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferredEvent) return;
    deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
  }

  return (
    <InstallPromptContext.Provider value={{ canInstall: !!deferredEvent, promptInstall, installed }}>
      {children}
    </InstallPromptContext.Provider>
  );
}

export function useInstallPrompt() {
  const ctx = useContext(InstallPromptContext);
  if (!ctx) throw new Error("useInstallPrompt must be used within InstallPromptProvider");
  return ctx;
}
