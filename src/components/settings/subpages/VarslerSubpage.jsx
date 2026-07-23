import { useEffect, useState } from "react";
import { usePush } from "../../../context/PushContext.jsx";
import { api } from "../../../lib/api.js";
import { useToast } from "../../../context/ToastContext.jsx";
import { Card, Switch, Input } from "../../../design-system/index.js";
import { SubpageSection } from "../SubpageSection.jsx";
import { FieldLabel } from "../FieldLabel.jsx";

// The server's REMINDER_TIME_RE only accepts :00/:15/:30/:45 (see
// worker/index.js), but a desktop <input type="time"> lets you type any
// minute (e.g. 18:07). Snap to the nearest quarter-hour before saving so a
// valid value is always sent — instead of a generic "Ugyldig tidspunkt"
// rejection with no correction (#96). Wraps within the day (23:53 -> 00:00).
function snapToQuarterHour(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const total = Math.round((Number(m[1]) * 60 + Number(m[2])) / 15) * 15;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const mm = String(wrapped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Web Push on iOS Safari only works for a PWA added to the Home Screen
// (standalone display mode), not an ordinary browser tab, and only iOS 16.4+.
function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// Varsler subpage — Web Push opt-in (per-device) plus the two shared
// household reminders (TODO #7 phases 1-2). The push toggle is per-device (a
// subscription belongs to this browser); the reminder settings are list-wide,
// so the copy calls out each scope. The stale-item marker threshold now lives
// under Butikkoppsett (it's a shopping-list indicator, not a notification);
// stale_item_days is still carried through here because /notification-settings
// upserts all five fields in one write — every save must send the full state.
export function VarslerSubpage() {
  const { supported, subscribed, subscribe, unsubscribe } = usePush();
  const toast = useToast();
  const [mealReminderEnabled, setMealReminderEnabled] = useState(true);
  const [mealReminderTime, setMealReminderTime] = useState("18:00");
  const [weeklyReminderEnabled, setWeeklyReminderEnabled] = useState(true);
  const [weeklyReminderTime, setWeeklyReminderTime] = useState("18:00");
  // Not shown here (its control is in Butikkoppsett), but kept so this page's
  // saves don't clobber it — see the endpoint note above.
  const [staleItemDays, setStaleItemDays] = useState(7);
  const iosNeedsInstall = isIOS() && !isStandalone();

  useEffect(() => {
    api("/notification-settings").then((res) => {
      if (res.error) return;
      setMealReminderEnabled(res.meal_reminder_enabled);
      setMealReminderTime(res.meal_reminder_time);
      setWeeklyReminderEnabled(res.weekly_reminder_enabled);
      setWeeklyReminderTime(res.weekly_reminder_time);
      setStaleItemDays(res.stale_item_days);
    });
  }, []);

  // The endpoint upserts all five fields together, so every save sends the
  // full current state, not just whichever control changed.
  async function saveSettings(next) {
    try {
      const res = await api("/notification-settings", {
        method: "POST",
        body: JSON.stringify({
          meal_reminder_enabled: next.mealReminderEnabled,
          meal_reminder_time: next.mealReminderTime,
          weekly_reminder_enabled: next.weeklyReminderEnabled,
          weekly_reminder_time: next.weeklyReminderTime,
          stale_item_days: next.staleItemDays,
        }),
      });
      if (res.error) toast(res.error, { error: true });
    } catch {
      toast("Noe gikk galt", { error: true });
    }
  }

  async function onToggleNotifications(on) {
    if (on) {
      const { error } = await subscribe();
      if (error) toast(error, { error: true });
    } else {
      await unsubscribe();
    }
  }

  function onToggleMealReminder(on) {
    setMealReminderEnabled(on);
    saveSettings({ mealReminderEnabled: on, mealReminderTime, weeklyReminderEnabled, weeklyReminderTime, staleItemDays });
  }

  function onChangeMealTime(e) {
    if (!e.target.value) return;
    const time = snapToQuarterHour(e.target.value);
    setMealReminderTime(time);
    saveSettings({ mealReminderEnabled, mealReminderTime: time, weeklyReminderEnabled, weeklyReminderTime, staleItemDays });
  }

  function onToggleWeeklyReminder(on) {
    setWeeklyReminderEnabled(on);
    saveSettings({ mealReminderEnabled, mealReminderTime, weeklyReminderEnabled: on, weeklyReminderTime, staleItemDays });
  }

  function onChangeWeeklyTime(e) {
    if (!e.target.value) return;
    const time = snapToQuarterHour(e.target.value);
    setWeeklyReminderTime(time);
    saveSettings({ mealReminderEnabled, mealReminderTime, weeklyReminderEnabled, weeklyReminderTime: time, staleItemDays });
  }

  const pushDescription = !supported
    ? "Nettleseren din støtter ikke push-varsler."
    : iosNeedsInstall
      ? "På iPhone/iPad må appen legges til på Hjem-skjermen (Del → Legg til på Hjem-skjermen) før varsler kan aktiveres."
      : "Gjelder kun denne enheten. Hvert medlem må slå på varsler på sine egne enheter.";

  return (
    <Card padding="lg" style={{ overflow: "hidden" }}>
      <SubpageSection label="Push-varsler" description={pushDescription}>
        <Switch checked={subscribed} onChange={onToggleNotifications} label="Aktiver varsler" />
      </SubpageSection>

      <SubpageSection
        label="Middag ikke planlagt"
        description="Gjelder hele husstanden."
      >
        <Switch
          checked={mealReminderEnabled}
          onChange={onToggleMealReminder}
          label="Påminnelse om middag ikke planlagt i morgen"
        />
        {mealReminderEnabled && (
          <div style={{ marginTop: 10 }}>
            <FieldLabel htmlFor="meal-reminder-time">Tidspunkt for påminnelse</FieldLabel>
            <Input
              id="meal-reminder-time"
              type="time"
              step={900}
              value={mealReminderTime}
              onChange={onChangeMealTime}
              style={{ maxWidth: 160 }}
            />
          </div>
        )}
      </SubpageSection>

      <SubpageSection
        label="Ukentlig planleggingspåminnelse"
        description="Gjelder hele husstanden."
      >
        <Switch
          checked={weeklyReminderEnabled}
          onChange={onToggleWeeklyReminder}
          label="Ukentlig påminnelse om å planlegge middager"
        />
        {weeklyReminderEnabled && (
          <div style={{ marginTop: 10 }}>
            <FieldLabel htmlFor="weekly-reminder-time">Tidspunkt på søndag</FieldLabel>
            <Input
              id="weekly-reminder-time"
              type="time"
              step={900}
              value={weeklyReminderTime}
              onChange={onChangeWeeklyTime}
              style={{ maxWidth: 160 }}
            />
          </div>
        )}
      </SubpageSection>
    </Card>
  );
}
