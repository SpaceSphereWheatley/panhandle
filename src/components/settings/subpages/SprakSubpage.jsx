import { Card, SegmentedControl } from "../../../design-system/index.js";
import { useLanguage } from "../../../context/LanguageContext.jsx";
import { SubpageSection } from "../SubpageSection.jsx";

const LANGUAGE_OPTIONS = [
  { value: "nb", label: "Norsk" },
  { value: "en", label: "English" },
];

export function SprakSubpage() {
  const { lang, setLang } = useLanguage();

  return (
    <Card padding="lg" style={{ overflow: "hidden" }}>
      <SubpageSection label="Språk" description="Språket appen vises på. Gjelder bare denne enheten.">
        <SegmentedControl value={lang} onChange={setLang} options={LANGUAGE_OPTIONS} />
      </SubpageSection>
    </Card>
  );
}
