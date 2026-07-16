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

// Varsler subpage — Web Push opt-in, plus the shared household setting for
// the "no meal planned for tomorrow" reminder (TODO #7 phase 1). The
// reminder setting is list-wide (see /notification-settings, same
// permission level as /recurring), so any member changes it for everyone.
export function VarslerSubpage() {
  const { supported, subscribed, subscribe, unsubscribe } = usePush();
  const toast = useToast();
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState("18:00");
  const iosNeedsInstall = isIOS() && !isStandalone();

  useEffect(() => {
    api("/notification-settings").then((res) => {
      if (res.error) return;
      setReminderEnabled(res.meal_reminder_enabled);
      setReminderTime(res.meal_reminder_time);
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

  async function saveSettings(enabled, time) {
    try {
      const res = await api("/notification-settings", {
        method: "POST",
        body: JSON.stringify({ meal_reminder_enabled: enabled, meal_reminder_time: time }),
      });
      if (res.error) toast(res.error, { error: true });
    } catch {
      toast("Noe gikk galt", { error: true });
    }
  }

  function onToggleReminder(on) {
    setReminderEnabled(on);
    saveSettings(on, reminderTime);
  }

  function onChangeTime(e) {
    const time = e.target.value;
    if (!time) return;
    setReminderTime(time);
    saveSettings(reminderEnabled, time);
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
          checked={reminderEnabled}
          onChange={onToggleReminder}
          label="Påminnelse om middag ikke planlagt i morgen"
        />
      </div>

      {reminderEnabled && (
        <div>
          <label
            htmlFor="reminder-time"
            style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}
          >
            Tidspunkt for påminnelse
          </label>
          <Input
            id="reminder-time"
            type="time"
            step={900}
            value={reminderTime}
            onChange={onChangeTime}
            style={{ maxWidth: 160 }}
          />
        </div>
      )}
    </Card>
  );
}
