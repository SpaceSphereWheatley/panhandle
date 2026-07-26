import { Card, Select } from "../../../design-system/index.js";
import { useLanguage } from "../../../context/LanguageContext.jsx";
import { SubpageSection } from "../SubpageSection.jsx";

export function LanguageSubpage() {
  const { lang, setLang, t } = useLanguage();

  return (
    <Card padding="lg" style={{ overflow: "hidden" }}>
      <SubpageSection label={t("settings.language.label")} description={t("settings.language.description")}>
        {/* The two option labels stay each language's own endonym. */}
        <Select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t("settings.language.label")}>
          <option value="nb">Norsk</option>
          <option value="en">English</option>
        </Select>
      </SubpageSection>
    </Card>
  );
}
