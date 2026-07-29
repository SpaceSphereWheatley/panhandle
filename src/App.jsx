import { useEffect, useState } from "react";
import "./index.css";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { ConfirmProvider } from "./context/ConfirmContext.jsx";
import { ListUsersProvider } from "./context/ListUsersContext.jsx";
import { RecurringProvider } from "./context/RecurringContext.jsx";
import { CategoryOrderProvider } from "./context/CategoryOrderContext.jsx";
import { PushProvider } from "./context/PushContext.jsx";
import { InstallPromptProvider } from "./context/InstallPromptContext.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { AuthScreens } from "./components/AuthScreens.jsx";
import { AppShell } from "./components/AppShell.jsx";
import { OnboardingFlow } from "./components/onboarding/OnboardingFlow.jsx";
import { applyTheme, currentTheme } from "./lib/theme.js";
import { applyIntensity, currentIntensity } from "./lib/designIntensity.js";
import { hasSeenOnboarding, markOnboardingSeen } from "./lib/onboarding.js";

// Hand-drawn wobble filter for item icons (see lib/itemIcons.js). Defined
// once; every icon's <g> references it via filter="url(#sketchy)".
function SketchyFilterDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="sketchy" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.05" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

function Root() {
  const { token } = useAuth();
  const [onboardingSeen, setOnboardingSeen] = useState(hasSeenOnboarding);

  if (!token) return <AuthScreens />;
  if (!onboardingSeen) {
    return (
      <OnboardingFlow
        onDone={() => {
          markOnboardingSeen();
          setOnboardingSeen(true);
        }}
      />
    );
  }
  return (
    <ListUsersProvider>
      <RecurringProvider>
        <CategoryOrderProvider>
          <PushProvider>
            <AppShell />
          </PushProvider>
        </CategoryOrderProvider>
      </RecurringProvider>
    </ListUsersProvider>
  );
}

export default function App() {
  useEffect(() => {
    applyTheme(currentTheme());
    applyIntensity(currentIntensity());
  }, []);

  return (
    <LanguageProvider>
      <InstallPromptProvider>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <SketchyFilterDefs />
              <Root />
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </InstallPromptProvider>
    </LanguageProvider>
  );
}
