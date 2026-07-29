import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../../lib/api.js";
import { Badge, Button, Card } from "../../../design-system/index.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useListUsers } from "../../../context/ListUsersContext.jsx";
import { InviteLinkModal } from "../../InviteLinkModal.jsx";
import { SubpageSection } from "../SubpageSection.jsx";
import { ManagementRow } from "../ManagementRow.jsx";
import { useConfirm } from "../../../context/ConfirmContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { useLanguage } from "../../../context/LanguageContext.jsx";
import { dateLocale } from "../../../lib/i18n/dateLocale.js";
import { useMotionConfig } from "../../../hooks/useMotionConfig.js";
import { apiErrorMessage } from "../../../lib/apiError.js";

const MotionRow = motion(ManagementRow);

// "Husstandsmedlemmer" subpage: who's on the list, plus invite/remove.
// Owners only — the nav row into it is owner-gated in SettingsRoot, and the
// isOwner check below is the backstop for a stale history entry restoring
// this path for someone who has since lost owner. Used to be half of "Vårt
// hjem", sharing a page with the (everyone-can-use) dinner schedule.
export function MembersSubpage() {
  const { user: currentUser, isOwner } = useAuth();
  const { listUsers, refresh } = useListUsers();
  const confirm = useConfirm();
  const toast = useToast();
  const { lang, t } = useLanguage();
  const { shouldAnimate, transition } = useMotionConfig();
  const [invite, setInvite] = useState(null);
  const [newLink, setNewLink] = useState(null);

  useEffect(() => {
    api("/list-invites").then((res) => {
      if (!res.error) setInvite(res);
    });
  }, []);

  async function generateInvite() {
    if (invite?.active) {
      const ok = await confirm(t("settings.household.members.invite.confirmRegenerate.body"), {
        title: t("settings.household.members.invite.confirmRegenerate.title"),
        confirmLabel: t("settings.household.members.invite.confirmRegenerate.confirmLabel"),
      });
      if (!ok) return;
    }
    const res = await api("/list-invites", { method: "POST" });
    if (res.error) {
      toast(apiErrorMessage(res, t), { error: true });
      return;
    }
    setInvite({ active: true, expires_at: res.expires_at });
    setNewLink(res.token);
  }

  async function revokeInvite() {
    if (
      !(await confirm(t("settings.household.members.invite.confirmRevoke.body"), {
        title: t("settings.household.members.invite.confirmRevoke.title"),
        confirmLabel: t("settings.household.members.invite.confirmRevoke.confirmLabel"),
      }))
    )
      return;
    const res = await api("/list-invites", { method: "DELETE" });
    if (res.error) {
      toast(apiErrorMessage(res, t), { error: true });
      return;
    }
    setInvite({ active: false, expires_at: null });
  }

  async function removeMember(username) {
    if (
      !(await confirm(t("settings.household.members.confirmRemove.body", { name: username }), {
        title: t("settings.household.members.confirmRemove.title"),
        confirmLabel: t("settings.household.members.confirmRemove.confirmLabel"),
      }))
    )
      return;
    const res = await api(`/list-users/${encodeURIComponent(username)}`, { method: "DELETE" });
    if (res.error) {
      toast(apiErrorMessage(res, t), { error: true });
      return;
    }
    await refresh();
  }

  if (!isOwner) return null;

  return (
    <Card padding="lg" style={{ overflow: "hidden" }}>
      {/* The count stays even though the page title says "members" — it's what
          explains the Add button going disabled at the 10-user cap. */}
      <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)" }}>{t("settings.household.members.count", { count: listUsers.length })}</div>

      <SubpageSection label={t("settings.household.members.label")}>
        <AnimatePresence initial={false}>
          {listUsers.map((u) => (
            <MotionRow
              key={u.username}
              layout={shouldAnimate}
              transition={transition}
              initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
              animate={shouldAnimate ? { opacity: 1, y: 0 } : false}
              exit={shouldAnimate ? { opacity: 0, scale: 0.9 } : undefined}
              title={
                <>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name || u.username}</span>
                  {!!u.is_owner && <Badge tone="secondary">{t("settings.household.members.badgeOwner")}</Badge>}
                  {!!u.is_admin && <Badge tone="primary">{t("settings.household.members.badgeAdmin")}</Badge>}
                </>
              }
              subtitle={u.username === currentUser ? t("settings.household.members.you") : u.username}
            >
              <Button variant="danger" size="sm" icon="trash" onClick={() => removeMember(u.username)}>{t("settings.household.members.remove")}</Button>
            </MotionRow>
          ))}
        </AnimatePresence>
      </SubpageSection>

      <SubpageSection label={t("settings.household.members.invite.label")}>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 10 }}>
          {t("settings.household.members.invite.explain")}
        </div>
        {invite?.active && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
                {t("settings.household.members.invite.active")}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                {t("settings.household.members.invite.expiresOn", {
                  date: new Date(invite.expires_at).toLocaleDateString(dateLocale(lang)),
                })}
              </div>
            </div>
            <Button variant="danger" size="sm" onClick={revokeInvite}>
              {t("settings.household.members.invite.revoke")}
            </Button>
          </div>
        )}
        <Button variant="primary" icon="plus" onClick={generateInvite} disabled={listUsers.length >= 10}>
          {t(invite?.active ? "settings.household.members.invite.regenerate" : "settings.household.members.invite.generate")}
        </Button>
      </SubpageSection>

      {newLink && <InviteLinkModal token={newLink} onClose={() => setNewLink(null)} />}
    </Card>
  );
}
