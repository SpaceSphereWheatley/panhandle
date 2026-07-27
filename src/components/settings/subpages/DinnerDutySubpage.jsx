import { useEffect, useState } from "react";
import { useListUsers } from "../../../context/ListUsersContext.jsx";
import { useRecurring } from "../../../context/RecurringContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { Card, Input, Select } from "../../../design-system/index.js";
import { useLanguage, useTranslation } from "../../../context/LanguageContext.jsx";
import { weekdayNames } from "../../../lib/i18n/dateLocale.js";
import { SubpageSection } from "../SubpageSection.jsx";
import { apiErrorMessage } from "../../../lib/apiError.js";

// "Middagsansvar" subpage: the standing weekly cook, one row per weekday.
// Open to every list member (so is /recurring server-side) — it used to be
// stacked under the owners-only member list on the shared "Vårt hjem" page,
// which is why a plain member tapping "x / 10 members" landed here.
export function DinnerDutySubpage() {
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
    <Card padding="lg" style={{ overflow: "hidden" }}>
      <SubpageSection
        label={t("settings.household.recurring.label")}
        description={t("settings.household.recurring.description")}
      >
        <div>
          {weekdays.map((day, dow) => {
            const current = schedule[dow] || "";
            const isOther = dow in otherDrafts || (current && !people.includes(current));
            const selectValue = isOther ? "__other__" : current;
            return (
              <div
                key={day}
                style={{
                  padding: "6px 0",
                  // No hairline under the last row — it would read as a stray
                  // divider against the Card's own edge.
                  borderBottom: dow < weekdays.length - 1 ? "1px solid var(--border-default)" : "none",
                }}
              >
                {/* Day and picker share one line: seven stacked label-over-
                    Select blocks made the week twice as tall as it needed. */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    id={`recurring-day-${dow}`}
                    style={{ flex: "0 0 auto", minWidth: 96, fontWeight: 600, color: "var(--text-primary)" }}
                  >
                    {day}
                  </div>
                  <Select
                    style={{ flex: 1, minWidth: 0 }}
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
                </div>
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
    </Card>
  );
}
