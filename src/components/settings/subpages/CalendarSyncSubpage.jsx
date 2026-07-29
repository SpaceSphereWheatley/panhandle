import { useEffect, useState } from "react";
import { api } from "../../../lib/api.js";
import { Button, Card, SegmentedControl } from "../../../design-system/index.js";
import { CalendarFeedLinkModal } from "../../CalendarFeedLinkModal.jsx";
import { SubpageSection } from "../SubpageSection.jsx";
import { useConfirm } from "../../../context/ConfirmContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { useTranslation } from "../../../context/LanguageContext.jsx";
import { apiErrorMessage } from "../../../lib/apiError.js";

// "Kalendersynk" subpage — a personal, subscribable ICS feed of the meal
// plan for Google/Apple/Outlook Calendar's "subscribe by URL" flow. Modeled
// on MembersSubpage's invite-link generate/reveal-once/revoke flow, with a
// scope choice (everyone's meals vs. just this user's own days) borrowed
// from StoreSubpage's save-on-change pattern.
//
// Token and scope are updated through separate endpoints on purpose:
// flipping scope must not rotate the token, or a calendar app already
// subscribed to the link (which polls infrequently) would silently start
// 404ing until the user re-subscribes.
export function CalendarSyncSubpage() {
  const confirm = useConfirm();
  const toast = useToast();
  const t = useTranslation();
  const [feed, setFeed] = useState(null);
  const [newLink, setNewLink] = useState(null);

  useEffect(() => {
    api("/calendar-feed").then((res) => {
      if (!res.error) setFeed(res);
    });
  }, []);

  async function setScope(scope) {
    const prev = feed;
    setFeed({ ...feed, scope });
    const res = await api("/calendar-feed", { method: "POST", body: JSON.stringify({ scope }) });
    if (res.error) {
      setFeed(prev);
      toast(apiErrorMessage(res, t), { error: true });
    }
  }

  async function generateLink() {
    if (feed?.active) {
      const ok = await confirm(t("settings.calendarSync.confirmRegenerate.body"), {
        title: t("settings.calendarSync.confirmRegenerate.title"),
        confirmLabel: t("settings.calendarSync.confirmRegenerate.confirmLabel"),
      });
      if (!ok) return;
    }
    const res = await api("/calendar-feed/token", { method: "POST" });
    if (res.error) {
      toast(apiErrorMessage(res, t), { error: true });
      return;
    }
    setFeed({ ...feed, active: true });
    setNewLink(res.token);
  }

  async function revokeLink() {
    if (
      !(await confirm(t("settings.calendarSync.confirmRevoke.body"), {
        title: t("settings.calendarSync.confirmRevoke.title"),
        confirmLabel: t("settings.calendarSync.confirmRevoke.confirmLabel"),
      }))
    )
      return;
    const res = await api("/calendar-feed/token", { method: "DELETE" });
    if (res.error) {
      toast(apiErrorMessage(res, t), { error: true });
      return;
    }
    setFeed({ ...feed, active: false });
  }

  if (!feed) return null;

  const scopeOptions = [
    { value: "all", label: t("settings.calendarSync.scope.all") },
    { value: "mine", label: t("settings.calendarSync.scope.mine") },
  ];

  return (
    <Card padding="lg" style={{ overflow: "hidden" }}>
      <SubpageSection
        label={t("settings.calendarSync.scope.label")}
        description={t("settings.calendarSync.scope.description")}
      >
        <SegmentedControl value={feed.scope} onChange={setScope} options={scopeOptions} />
      </SubpageSection>

      <SubpageSection
        label={t("settings.calendarSync.label")}
        description={t("settings.calendarSync.explain")}
      >
        {feed.active && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
              {t("settings.calendarSync.active")}
            </div>
            <Button variant="danger" size="sm" onClick={revokeLink}>
              {t("settings.calendarSync.revoke")}
            </Button>
          </div>
        )}
        <Button variant="primary" icon="plus" onClick={generateLink}>
          {t(feed.active ? "settings.calendarSync.regenerate" : "settings.calendarSync.generate")}
        </Button>
      </SubpageSection>

      {newLink && <CalendarFeedLinkModal token={newLink} onClose={() => setNewLink(null)} />}
    </Card>
  );
}
