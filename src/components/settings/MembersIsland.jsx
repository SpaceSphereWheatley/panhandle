import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../lib/api.js";
import { Badge, Button, Input } from "../../design-system/index.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { CredentialsModal } from "../CredentialsModal.jsx";
import { SubpageSection } from "./SubpageSection.jsx";
import { FieldLabel } from "./FieldLabel.jsx";
import { ManagementRow } from "./ManagementRow.jsx";
import { useConfirm } from "../../context/ConfirmContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useTranslation } from "../../context/LanguageContext.jsx";
import { useMotionConfig } from "../../hooks/useMotionConfig.js";
import { apiErrorMessage } from "../../lib/apiError.js";

const MotionRow = motion(ManagementRow);

// "Vårt hjem" subpage, part 1: member list + add member, each always-open
// (no accordions — see SubpageSection.jsx). Content-only — no own Card
// wrapper, since HjemSubpage.jsx merges this with RecurringIsland into one
// shared container.
export function MembersIsland() {
  const { user: currentUser } = useAuth();
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
      !(await confirm(t("settings.hjem.members.confirmRemove.body", { name: username }), {
        title: t("settings.hjem.members.confirmRemove.title"),
        confirmLabel: t("settings.hjem.members.confirmRemove.confirmLabel"),
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

  return (
    <>
      <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{t("settings.hjem.members.eyebrow")}</div>
      <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)" }}>{t("settings.hjem.members.count", { count: listUsers.length })}</div>

      <SubpageSection label={t("settings.hjem.members.label")}>
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
                  {!!u.is_owner && <Badge tone="secondary">{t("settings.hjem.members.badgeOwner")}</Badge>}
                  {!!u.is_admin && <Badge tone="primary">{t("settings.hjem.members.badgeAdmin")}</Badge>}
                </>
              }
              subtitle={u.username === currentUser ? t("settings.hjem.members.you") : u.username}
            >
              <Button variant="danger" size="sm" icon="trash" onClick={() => removeMember(u.username)}>{t("settings.hjem.members.remove")}</Button>
            </MotionRow>
          ))}
        </AnimatePresence>
      </SubpageSection>

      <SubpageSection label={t("settings.hjem.members.add.label")}>
        <FieldLabel htmlFor="members-new-name" visuallyHidden>{t("settings.hjem.members.add.nameField")}</FieldLabel>
        <Input
          id="members-new-name"
          placeholder={t("settings.konto.name.label")}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ marginBottom: 8 }}
        />
        <FieldLabel htmlFor="members-new-email" visuallyHidden>{t("settings.hjem.members.add.emailField")}</FieldLabel>
        <Input
          id="members-new-email"
          type="email"
          placeholder={t("settings.konto.email.label")}
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <Button variant="primary" icon="plus" onClick={addMember} disabled={full}>
          {t("settings.hjem.members.add.submit")}
        </Button>
      </SubpageSection>

      {creds && (
        <CredentialsModal username={creds.username} password={creds.password} onClose={() => setCreds(null)} />
      )}
    </>
  );
}
