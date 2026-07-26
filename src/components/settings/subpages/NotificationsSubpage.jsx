import { useEffect, useState } from "react";
import { usePush } from "../../../context/PushContext.jsx";
import { api } from "../../../lib/api.js";
import { useToast } from "../../../context/ToastContext.jsx";
import { Card, Switch, Input } from "../../../design-system/index.js";
import { useTranslation } from "../../../context/LanguageContext.jsx";
import { SubpageSection } from "../SubpageSection.jsx";
import { FieldLabel } from "../FieldLabel.jsx";
import { apiErrorMessage } from "../../../lib/apiError.js";

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

// Notifications subpage (Settings → "Varsler") — Web Push opt-in plus the two meal-planning reminders,
// all now per-device (TODO #7 phases 1-2, made device-only). A push
// subscription belongs to this browser, and the reminder preferences are
// stored on it (see /push/reminder-settings), so everything on this page
// applies only to this device — one member can't toggle another's reminders.
// The reminder controls only appear once push is enabled, since there's no
// device subscription to store them against until then. The stale-item marker
// threshold lives under Butikkoppsett (it's a shopping-list indicator, and a
// shared per-list setting, not a per-device notification).
export function NotificationsSubpage() {
  const { supported, subscribed, endpoint, subscribe, unsubscribe } = usePush();
  const toast = useToast();
  const t = useTranslation();
  const [mealReminderEnabled, setMealReminderEnabled] = useState(true);
  const [mealReminderTime, setMealReminderTime] = useState("18:00");
  const [weeklyReminderEnabled, setWeeklyReminderEnabled] = useState(true);
  const [weeklyReminderTime, setWeeklyReminderTime] = useState("18:00");
  const iosNeedsInstall = isIOS() && !isStandalone();

  // Load this device's reminder settings once it's subscribed (its endpoint
  // keys the row). Re-runs if the endpoint changes (e.g. after (re)subscribing).
  useEffect(() => {
    if (!endpoint) return;
    api(`/push/reminder-settings?endpoint=${encodeURIComponent(endpoint)}`).then((res) => {
      if (res.error) return;
      setMealReminderEnabled(res.meal_reminder_enabled);
      setMealReminderTime(res.meal_reminder_time);
      setWeeklyReminderEnabled(res.weekly_reminder_enabled);
      setWeeklyReminderTime(res.weekly_reminder_time);
    });
  }, [endpoint]);

  // Every save sends the full reminder state (the endpoint updates all four
  // fields at once), not just whichever control changed.
  async function saveSettings(next) {
    if (!endpoint) return;
    try {
      const res = await api("/push/reminder-settings", {
        method: "POST",
        body: JSON.stringify({
          endpoint,
          meal_reminder_enabled: next.mealReminderEnabled,
          meal_reminder_time: next.mealReminderTime,
          weekly_reminder_enabled: next.weeklyReminderEnabled,
          weekly_reminder_time: next.weeklyReminderTime,
        }),
      });
      if (res.error) toast(apiErrorMessage(res, t), { error: true });
    } catch {
      toast(t("shoppingList.toast.genericError"), { error: true });
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
    saveSettings({ mealReminderEnabled: on, mealReminderTime, weeklyReminderEnabled, weeklyReminderTime });
  }

  function onChangeMealTime(e) {
    if (!e.target.value) return;
    const time = snapToQuarterHour(e.target.value);
    setMealReminderTime(time);
    saveSettings({ mealReminderEnabled, mealReminderTime: time, weeklyReminderEnabled, weeklyReminderTime });
  }

  function onToggleWeeklyReminder(on) {
    setWeeklyReminderEnabled(on);
    saveSettings({ mealReminderEnabled, mealReminderTime, weeklyReminderEnabled: on, weeklyReminderTime });
  }

  function onChangeWeeklyTime(e) {
    if (!e.target.value) return;
    const time = snapToQuarterHour(e.target.value);
    setWeeklyReminderTime(time);
    saveSettings({ mealReminderEnabled, mealReminderTime, weeklyReminderEnabled, weeklyReminderTime: time });
  }

  const pushDescription = !supported
    ? t("settings.notifications.push.unsupported")
    : iosNeedsInstall
      ? t("settings.notifications.push.iosHint")
      : t("settings.notifications.push.description");

  return (
    <Card padding="lg" style={{ overflow: "hidden" }}>
      <SubpageSection label={t("settings.notifications.push.label")} description={pushDescription}>
        <Switch checked={subscribed} onChange={onToggleNotifications} label={t("settings.notifications.push.toggle")} />
      </SubpageSection>

      {subscribed && (
        <>
          <SubpageSection
            label={t("settings.notifications.meal.label")}
            description={t("settings.notifications.deviceOnly")}
          >
            <Switch
              checked={mealReminderEnabled}
              onChange={onToggleMealReminder}
              label={t("settings.notifications.meal.toggle")}
            />
            {mealReminderEnabled && (
              <div style={{ marginTop: 10 }}>
                <FieldLabel htmlFor="meal-reminder-time">{t("settings.notifications.meal.time")}</FieldLabel>
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
            label={t("settings.notifications.weekly.label")}
            description={t("settings.notifications.deviceOnly")}
          >
            <Switch
              checked={weeklyReminderEnabled}
              onChange={onToggleWeeklyReminder}
              label={t("settings.notifications.weekly.toggle")}
            />
            {weeklyReminderEnabled && (
              <div style={{ marginTop: 10 }}>
                <FieldLabel htmlFor="weekly-reminder-time">{t("settings.notifications.weekly.time")}</FieldLabel>
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
        </>
      )}
    </Card>
  );
}
