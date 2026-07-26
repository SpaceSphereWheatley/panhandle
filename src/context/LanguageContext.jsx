import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { currentLanguage, setLanguage, applyLanguage } from "../lib/i18n/language.js";
import { translate } from "../lib/i18n/translate.js";

const LanguageContext = createContext(null);

// Unlike theme.js (a contextless module — CSS attribute selectors react to
// dataset.theme with no React involvement), a language switch has to
// re-render already-committed translated JSX, so this needs real React
// state: setLang updates both localStorage (via setLanguage) and this
// context's state, which re-renders every t()-consuming component.
export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(currentLanguage());

  useEffect(() => {
    applyLanguage(lang);
  }, [lang]);

  function setLang(l) {
    setLanguage(l);
    setLangState(l);
  }

  const t = useMemo(() => (key, params) => translate(lang, key, params), [lang]);

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

export function useTranslation() {
  return useLanguage().t;
}
