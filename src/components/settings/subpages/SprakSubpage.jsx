import { Card, Select } from "../../../design-system/index.js";
import { useLanguage } from "../../../context/LanguageContext.jsx";
import { SubpageSection } from "../SubpageSection.jsx";

export function SprakSubpage() {
  const { lang, setLang } = useLanguage();

  return (
    <Card padding="lg" style={{ overflow: "hidden" }}>
      <SubpageSection label="Språk" description="Språket appen vises på. Gjelder bare denne enheten.">
        <Select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Språk">
          <option value="nb">Norsk</option>
          <option value="en">English</option>
        </Select>
      </SubpageSection>
    </Card>
  );
}
