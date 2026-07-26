import { useEffect, useState } from "react";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { useRecurring } from "../../context/RecurringContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { Input, Select } from "../../design-system/index.js";
import { useLanguage, useTranslation } from "../../context/LanguageContext.jsx";
import { weekdayNames } from "../../lib/i18n/dateLocale.js";
import { SubpageSection } from "./SubpageSection.jsx";
import { apiErrorMessage } from "../../lib/apiError.js";

// "Vårt hjem" subpage, part 2: weekly recurring meal responsibility,
// always-open like MembersIsland's sub-sections (no accordions — see
// SubpageSection.jsx). Content-only — no own Card wrapper, see
// MembersIsland.jsx / HouseholdSubpage.jsx.
export function RecurringIsland() {
  const { people, nameFor, refresh } = useListUsers();
  const { schedule, ensureLoaded, saveDay } = useRecurring();
  const toast = useToast();
  const t = useTranslation();
  const { lang } = useLanguage();
  const weekdays = weekdayNames(lang);
  const [otherDrafts, setOtherDrafts] = useState({});

  useEffect(() => {
    refresh();
    ensureLoaded();
  }, []);

  async function onSelectChange(dow, value) {
    if (value === "__other__") {
      setOtherDrafts((prev) => ({ ...prev, [dow]: schedule[dow] || "" }));
      return;
    }
    setOtherDrafts((prev) => {
      const next = { ...prev };
      delete next[dow];
      return next;
    });
    const res = await saveDay(dow, value);
    if (res.error) toast(apiErrorMessage(res, t), { error: true });
    else toast(t("settings.household.recurring.saved"));
  }

  async function onOtherBlur(dow, value) {
    const val = value.trim();
    // Blur fires on every focus loss, not just an edit — skip the round trip
    // (and the new "Lagret." toast) when nothing actually changed, so tabbing
    // through the field without typing doesn't spam a confirmation.
    if (val === (schedule[dow] || "")) return;
    const res = await saveDay(dow, val || "");
    if (res.error) toast(apiErrorMessage(res, t), { error: true });
    else toast(t("settings.household.recurring.saved"));
    if (!val) {
      setOtherDrafts((prev) => {
        const next = { ...prev };
        delete next[dow];
        return next;
      });
    }
  }

  return (
    <SubpageSection label={t("settings.household.recurring.label")}>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: "0 0 12px" }}>
        {t("settings.household.recurring.description")}
      </div>
      <div>
        {weekdays.map((day, dow) => {
          const current = schedule[dow] || "";
          const isOther = dow in otherDrafts || (current && !people.includes(current));
          const selectValue = isOther ? "__other__" : current;
          return (
            <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border-default)" }} key={day}>
              <div id={`recurring-day-${dow}`} style={{ fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>{day}</div>
              <Select
                value={selectValue}
                onChange={(e) => onSelectChange(dow, e.target.value)}
                aria-labelledby={`recurring-day-${dow}`}
              >
                <option value="">{t("meals.responsible.none")}</option>
                {people.map((p) => (
                  <option value={p} key={p}>{nameFor(p)}</option>
                ))}
                <option value="__other__">{t("meals.responsible.other")}</option>
              </Select>
              {isOther && (
                <Input
                  type="text"
                  placeholder={t("settings.household.recurring.describePlaceholder")}
                  aria-label={t("settings.household.recurring.describeAria", { day })}
                  style={{ marginTop: 8 }}
                  defaultValue={current}
                  onBlur={(e) => onOtherBlur(dow, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
    </SubpageSection>
  );
}
