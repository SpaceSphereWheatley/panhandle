import { useEffect, useState } from "react";
import { api } from "../../../lib/api.js";
import { Button, Card } from "../../../design-system/index.js";
import { SubpageSection } from "../SubpageSection.jsx";
import { useConfirm } from "../../../context/ConfirmContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { useLanguage } from "../../../context/LanguageContext.jsx";
import { apiErrorMessage } from "../../../lib/apiError.js";
import { dateLocale } from "../../../lib/i18n/dateLocale.js";

// "Tilkoblede apper" subpage — this user's claude.ai connector grants
// (docs/mcp-connector-plan.md), each revocable. Personal, like Calendar sync:
// a grant acts as the user who approved it, so only they see or revoke it.
export function ConnectedAppsSubpage() {
  const confirm = useConfirm();
  const toast = useToast();
  const { lang, t } = useLanguage();
  const [apps, setApps] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/connected-apps")
      .then((res) => {
        if (Array.isArray(res)) setApps(res);
        else setError(apiErrorMessage(res, t));
      })
      .catch(() => setError(t("auth.networkError")));
  }, [t]);

  async function revoke(app) {
    const ok = await confirm(t("settings.connectedApps.confirmRevoke.body", { client: app.client_name || "Claude" }), {
      title: t("settings.connectedApps.confirmRevoke.title"),
      confirmLabel: t("settings.connectedApps.revoke"),
    });
    if (!ok) return;
    const res = await api(`/connected-apps/${encodeURIComponent(app.id)}`, { method: "DELETE" });
    if (res.error) {
      toast(apiErrorMessage(res, t), { error: true });
      return;
    }
    setApps((list) => list.filter((a) => a.id !== app.id));
  }

  const fmt = (secs) => new Date(secs * 1000).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short", year: "numeric" });

  return (
    <Card padding="lg" style={{ overflow: "hidden" }}>
      <SubpageSection label={t("settings.connectedApps.label")} description={t("settings.connectedApps.explain")}>
        {error && <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{error}</div>}
        {apps && apps.length === 0 && (
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{t("settings.connectedApps.none")}</div>
        )}
        {apps && apps.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {apps.map((app) => (
              <div key={app.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
                    {app.client_name || "Claude"}
                    {app.redirect_host ? ` · ${app.redirect_host}` : ""}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                    {t(app.scope.includes("write") ? "settings.connectedApps.readWrite" : "settings.connectedApps.readOnly")}
                    {" · "}
                    {t("settings.connectedApps.since", { date: fmt(app.created_at) })}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <Button variant="danger" size="sm" onClick={() => revoke(app)}>
                    {t("settings.connectedApps.revoke")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SubpageSection>
      <SubpageSection label={t("settings.connectedApps.howTo.label")} description={t("settings.connectedApps.howTo.body", { url: `${window.location.origin}/mcp` })} />
    </Card>
  );
}
