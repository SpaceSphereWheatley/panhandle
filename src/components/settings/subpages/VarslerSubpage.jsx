import { useEffect, useState } from "react";
import { usePush } from "../../../context/PushContext.jsx";
import { api } from "../../../lib/api.js";
import { useToast } from "../../../context/ToastContext.jsx";
import { Card, Switch, Input } from "../../../design-system/index.js";

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Web Push on iOS Safari only works for a PWA added to the Home Screen
// (standalone display mode), not an ordinary browser tab, and only iOS 16.4+.
function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// Varsler subpage — Web Push opt-in, plus the shared household settings for
// the "no meal planned for tomorrow" reminder (TODO #7 phase 1) and the
// weekly meal-plan reminder (phase 2, fixed to Sunday evening — see
// checkWeeklyReminders in worker/index.js). Both reminder settings are
// list-wide (see /notification-settings, same permission level as
// /recurring), so any member changes them for everyone.
export function VarslerSubpage() {
  const { supported, subscribed, subscribe, unsubscribe } = usePush();
  const toast = useToast();
  const [mealReminderEnabled, setMealReminderEnabled] = useState(true);
  const [mealReminderTime, setMealReminderTime] = useState("18:00");
  const [weeklyReminderEnabled, setWeeklyReminderEnabled] = useState(true);
  const [weeklyReminderTime, setWeeklyReminderTime] = useState("18:00");
  const iosNeedsInstall = isIOS() && !isStandalone();

  useEffect(() => {
    api("/notification-settings").then((res) => {
      if (res.error) return;
      setMealReminderEnabled(res.meal_reminder_enabled);
      setMealReminderTime(res.meal_reminder_time);
      setWeeklyReminderEnabled(res.weekly_reminder_enabled);
      setWeeklyReminderTime(res.weekly_reminder_time);
    });
  }, []);

  async function onToggleNotifications(on) {
    if (on) {
      const { error } = await subscribe();
      if (error) toast(error, { error: true });
    } else {
      await unsubscribe();
    }
  }

  // The endpoint upserts all four fields together, so every save sends the
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
        }),
      });
      if (res.error) toast(res.error, { error: true });
    } catch {
      toast("Noe gikk galt", { error: true });
    }
  }

  function onToggleMealReminder(on) {
    setMealReminderEnabled(on);
    saveSettings({ mealReminderEnabled: on, mealReminderTime, weeklyReminderEnabled, weeklyReminderTime });
  }

  function onChangeMealTime(e) {
    const time = e.target.value;
    if (!time) return;
    setMealReminderTime(time);
    saveSettings({ mealReminderEnabled, mealReminderTime: time, weeklyReminderEnabled, weeklyReminderTime });
  }

  function onToggleWeeklyReminder(on) {
    setWeeklyReminderEnabled(on);
    saveSettings({ mealReminderEnabled, mealReminderTime, weeklyReminderEnabled: on, weeklyReminderTime });
  }

  function onChangeWeeklyTime(e) {
    const time = e.target.value;
    if (!time) return;
    setWeeklyReminderTime(time);
    saveSettings({ mealReminderEnabled, mealReminderTime, weeklyReminderEnabled, weeklyReminderTime: time });
  }

  return (
    <Card padding="lg">
      {!supported && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: 12 }}>
          Nettleseren din støtter ikke push-varsler.
        </div>
      )}

      {iosNeedsInstall && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: 12 }}>
          På iPhone/iPad må appen legges til på Hjem-skjermen (Del → Legg til på
          Hjem-skjermen) før varsler kan aktiveres.
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <Switch checked={subscribed} onChange={onToggleNotifications} label="Aktiver varsler" />
      </div>

      <div style={{ marginBottom: 14 }}>
        <Switch
          checked={mealReminderEnabled}
          onChange={onToggleMealReminder}
          label="Påminnelse om middag ikke planlagt i morgen"
        />
      </div>

      {mealReminderEnabled && (
        <div style={{ marginBottom: 14 }}>
          <label
            htmlFor="meal-reminder-time"
            style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}
          >
            Tidspunkt for påminnelse
          </label>
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

      <div style={{ marginBottom: 14 }}>
        <Switch
          checked={weeklyReminderEnabled}
          onChange={onToggleWeeklyReminder}
          label="Ukentlig påminnelse om å planlegge middager"
        />
      </div>

      {weeklyReminderEnabled && (
        <div>
          <label
            htmlFor="weekly-reminder-time"
            style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}
          >
            Tidspunkt på søndag
          </label>
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
    </Card>
  );
}
