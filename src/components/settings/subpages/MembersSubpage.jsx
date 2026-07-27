import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../../lib/api.js";
import { Badge, Button, Card, Input } from "../../../design-system/index.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useListUsers } from "../../../context/ListUsersContext.jsx";
import { CredentialsModal } from "../../CredentialsModal.jsx";
import { SubpageSection } from "../SubpageSection.jsx";
import { FieldLabel } from "../FieldLabel.jsx";
import { ManagementRow } from "../ManagementRow.jsx";
import { useConfirm } from "../../../context/ConfirmContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { useTranslation } from "../../../context/LanguageContext.jsx";
import { useMotionConfig } from "../../../hooks/useMotionConfig.js";
import { apiErrorMessage } from "../../../lib/apiError.js";

const MotionRow = motion(ManagementRow);

// "Husstandsmedlemmer" subpage: who's on the list, plus add/remove. Owners
// only — the nav row into it is owner-gated in SettingsRoot, and the isOwner
// check below is the backstop for a stale history entry restoring this path
// for someone who has since lost owner. Used to be half of "Vårt hjem",
// sharing a page with the (everyone-can-use) dinner schedule.
export function MembersSubpage() {
  const { user: currentUser, isOwner } = useAuth();
  const { listUsers, refresh } = useListUsers();
  const confirm = useConfirm();
  const toast = useToast();
  const t = useTranslation();
  const { shouldAnimate, transition } = useMotionConfig();
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creds, setCreds] = useState(null);

  const full = listUsers.length >= 10;

  async function addMember() {
    const name = newName.trim();
    const email = newEmail.trim();
    if (!name) {
      toast(t("settings.admin.toast.enterName"), { error: true });
      return;
    }
    if (!email) {
      toast(t("settings.admin.toast.enterEmail"), { error: true });
      return;
    }
    const res = await api("/list-users", { method: "POST", body: JSON.stringify({ name, email }) });
    if (res.error) {
      toast(apiErrorMessage(res, t), { error: true });
      return;
    }
    setNewName("");
    setNewEmail("");
    await refresh();
    setCreds({ username: res.username, password: res.password });
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

      <SubpageSection label={t("settings.household.members.add.label")}>
        <FieldLabel htmlFor="members-new-name" visuallyHidden>{t("settings.household.members.add.nameField")}</FieldLabel>
        <Input
          id="members-new-name"
          placeholder={t("settings.account.name.label")}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ marginBottom: 8 }}
        />
        <FieldLabel htmlFor="members-new-email" visuallyHidden>{t("settings.household.members.add.emailField")}</FieldLabel>
        <Input
          id="members-new-email"
          type="email"
          placeholder={t("settings.account.email.label")}
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <Button variant="primary" icon="plus" onClick={addMember} disabled={full}>
          {t("settings.household.members.add.submit")}
        </Button>
      </SubpageSection>

      {creds && (
        <CredentialsModal username={creds.username} password={creds.password} onClose={() => setCreds(null)} />
      )}
    </Card>
  );
}
