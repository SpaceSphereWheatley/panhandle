import { useEffect, useState } from "react";
import { usePush } from "../../../context/PushContext.jsx";
import { api } from "../../../lib/api.js";
import { useToast } from "../../../context/ToastContext.jsx";
import { Card, Switch, Input, IconButton } from "../../../design-system/index.js";
import { SubpageSection } from "../SubpageSection.jsx";

const STALE_ITEM_DAYS_MIN = 1;
const STALE_ITEM_DAYS_MAX = 90;

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
// /recurring), so any member changes them for everyone. Also holds the
// stale-item marker threshold — not a push reminder (it's a purely visual
// ShoppingListTab indicator), just riding along on the same settings
// row/endpoint since it's the app's only per-list preferences store.
export function VarslerSubpage() {
  const { supported, subscribed, subscribe, unsubscribe } = usePush();
  const toast = useToast();
  const [mealReminderEnabled, setMealReminderEnabled] = useState(true);
  const [mealReminderTime, setMealReminderTime] = useState("18:00");
  const [weeklyReminderEnabled, setWeeklyReminderEnabled] = useState(true);
  const [weeklyReminderTime, setWeeklyReminderTime] = useState("18:00");
  const [staleItemDays, setStaleItemDays] = useState(7);
  // Mirrors the input's raw typed text, decoupled from staleItemDays (the
  // last known-valid/saved value) — see onChangeStaleItemDaysText for why.
  const [staleItemDaysText, setStaleItemDaysText] = useState("7");
  const iosNeedsInstall = isIOS() && !isStandalone();

  useEffect(() => {
    api("/notification-settings").then((res) => {
      if (res.error) return;
      setMealReminderEnabled(res.meal_reminder_enabled);
      setMealReminderTime(res.meal_reminder_time);
      setWeeklyReminderEnabled(res.weekly_reminder_enabled);
      setWeeklyReminderTime(res.weekly_reminder_time);
      setStaleItemDays(res.stale_item_days);
      setStaleItemDaysText(String(res.stale_item_days));
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

  function onToggleMealReminder(on) {
    setMealReminderEnabled(on);
    saveSettings({ mealReminderEnabled: on, mealReminderTime, weeklyReminderEnabled, weeklyReminderTime, staleItemDays });
  }

  function onChangeMealTime(e) {
    const time = e.target.value;
    if (!time) return;
    setMealReminderTime(time);
    saveSettings({ mealReminderEnabled, mealReminderTime: time, weeklyReminderEnabled, weeklyReminderTime, staleItemDays });
  }

  function onToggleWeeklyReminder(on) {
    setWeeklyReminderEnabled(on);
    saveSettings({ mealReminderEnabled, mealReminderTime, weeklyReminderEnabled: on, weeklyReminderTime, staleItemDays });
  }

  function onChangeWeeklyTime(e) {
    const time = e.target.value;
    if (!time) return;
    setWeeklyReminderTime(time);
    saveSettings({ mealReminderEnabled, mealReminderTime, weeklyReminderEnabled, weeklyReminderTime: time, staleItemDays });
  }

  // Always mirrors what's typed, even mid-edit (empty, a lone "0", a value
  // outside 1-90) — only a fully valid value also updates/saves the real
  // staleItemDays, so a controlled re-render never snaps the field back to
  // the old number while the user is still typing a new one.
  function onChangeStaleItemDaysText(e) {
    const text = e.target.value;
    setStaleItemDaysText(text);
    const days = Number(text);
    if (text.trim() === "" || !Number.isInteger(days) || days < STALE_ITEM_DAYS_MIN || days > STALE_ITEM_DAYS_MAX) return;
    setStaleItemDays(days);
    saveSettings({ mealReminderEnabled, mealReminderTime, weeklyReminderEnabled, weeklyReminderTime, staleItemDays: days });
  }

  // On blur, resolve whatever's left in the field: clamp an out-of-range
  // number into bounds, or fall back to the last valid value if it isn't a
  // number at all (e.g. left empty).
  function onBlurStaleItemDaysText() {
    const days = Number(staleItemDaysText);
    const resolved =
      staleItemDaysText.trim() !== "" && Number.isInteger(days)
        ? Math.min(STALE_ITEM_DAYS_MAX, Math.max(STALE_ITEM_DAYS_MIN, days))
        : staleItemDays;
    setStaleItemDaysText(String(resolved));
    if (resolved !== staleItemDays) {
      setStaleItemDays(resolved);
      saveSettings({ mealReminderEnabled, mealReminderTime, weeklyReminderEnabled, weeklyReminderTime, staleItemDays: resolved });
    }
  }

  function adjustStaleItemDays(delta) {
    const next = Math.min(STALE_ITEM_DAYS_MAX, Math.max(STALE_ITEM_DAYS_MIN, staleItemDays + delta));
    setStaleItemDaysText(String(next));
    if (next === staleItemDays) return;
    setStaleItemDays(next);
    saveSettings({ mealReminderEnabled, mealReminderTime, weeklyReminderEnabled, weeklyReminderTime, staleItemDays: next });
  }

  const pushDescription = !supported
    ? "Nettleseren din støtter ikke push-varsler."
    : iosNeedsInstall
      ? "På iPhone/iPad må appen legges til på Hjem-skjermen (Del → Legg til på Hjem-skjermen) før varsler kan aktiveres."
      : null;

  return (
    <Card padding="lg" style={{ overflow: "hidden" }}>
      <SubpageSection label="Push-varsler" description={pushDescription}>
        <Switch checked={subscribed} onChange={onToggleNotifications} label="Aktiver varsler" />
      </SubpageSection>

      <SubpageSection label="Middag ikke planlagt">
        <Switch
          checked={mealReminderEnabled}
          onChange={onToggleMealReminder}
          label="Påminnelse om middag ikke planlagt i morgen"
        />
        {mealReminderEnabled && (
          <div style={{ marginTop: 10 }}>
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
      </SubpageSection>

      <SubpageSection label="Ukentlig planleggingspåminnelse">
        <Switch
          checked={weeklyReminderEnabled}
          onChange={onToggleWeeklyReminder}
          label="Ukentlig påminnelse om å planlegge middager"
        />
        {weeklyReminderEnabled && (
          <div style={{ marginTop: 10 }}>
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
      </SubpageSection>

      <SubpageSection label="Gamle varer på handlelisten" description="Varer som har ligget ukjøpt lenger enn dette får en diskré markering i handlelisten.">
        <div style={{ marginTop: 2 }}>
          <label
            htmlFor="stale-item-days"
            style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}
          >
            Antall dager
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconButton
              icon="minus"
              size="sm"
              variant="subtle"
              label="Reduser antall dager"
              onClick={() => adjustStaleItemDays(-1)}
            />
            <Input
              id="stale-item-days"
              type="number"
              inputMode="numeric"
              min={STALE_ITEM_DAYS_MIN}
              max={STALE_ITEM_DAYS_MAX}
              value={staleItemDaysText}
              onChange={onChangeStaleItemDaysText}
              onBlur={onBlurStaleItemDaysText}
              style={{ maxWidth: 76 }}
            />
            <IconButton
              icon="plus"
              size="sm"
              variant="subtle"
              label="Øk antall dager"
              onClick={() => adjustStaleItemDays(1)}
            />
          </div>
        </div>
      </SubpageSection>
    </Card>
  );
}
