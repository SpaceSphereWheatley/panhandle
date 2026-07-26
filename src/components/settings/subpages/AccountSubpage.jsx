import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useListUsers } from "../../../context/ListUsersContext.jsx";
import { api } from "../../../lib/api.js";
import { Button, Card, Input } from "../../../design-system/index.js";
import { useToast } from "../../../context/ToastContext.jsx";
import { useConfirm } from "../../../context/ConfirmContext.jsx";
import { useTranslation } from "../../../context/LanguageContext.jsx";
import { SubpageSection } from "../SubpageSection.jsx";
import { FieldLabel } from "../FieldLabel.jsx";
import { apiErrorMessage } from "../../../lib/apiError.js";

// Account subpage (Settings → "Konto") — a subpage has room, so Navn/E-post/Bytt passord are direct
// fields, each in a SubpageSection so every subpage's labeled blocks look like
// one system. Save model: Navn auto-saves on blur (no password needed, so it's
// a preference, not an action); E-post and Bytt passord keep explicit buttons
// because both require the current password — that's a credential-guarded
// action. Logg ut / Slett konto sit in their own visually distinct blocks so a
// casual tap can't stumble into them, and every button here is the shared
// design-system <Button> (no bespoke .btn-primary/.logout classes).
export function AccountSubpage() {
  const { user, name, isOwner, logout, updateIdentity } = useAuth();
  const { listUsers } = useListUsers();
  const toast = useToast();
  const confirm = useConfirm();
  const t = useTranslation();
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [nameInput, setNameInput] = useState(name || user || "");
  const savedName = useRef(name || user || "");
  const [email, setEmail] = useState(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailPw, setEmailPw] = useState("");
  const [pwDelete, setPwDelete] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api("/account").then((res) => {
      if (res.error) return;
      setEmail(res.email);
      setEmailInput(res.email || "");
      setNameInput(res.name || user || "");
      savedName.current = res.name || user || "";
    });
  }, []);

  // Auto-save on blur, but only when the value actually changed — tabbing
  // through the field without editing shouldn't POST or toast.
  async function saveName() {
    const next = nameInput.trim();
    if (!next || next === savedName.current) return;
    try {
      const res = await api("/change-name", {
        method: "POST",
        body: JSON.stringify({ name: next }),
      });
      if (res.error) {
        toast(apiErrorMessage(res, t), { error: true });
        return;
      }
      savedName.current = res.name;
      updateIdentity({ name: res.name });
      toast(t("settings.account.toast.nameSaved"));
    } catch {
      toast(t("shoppingList.toast.genericError"), { error: true });
    }
  }

  async function saveEmail() {
    try {
      const res = await api("/change-email", {
        method: "POST",
        body: JSON.stringify({ current_password: emailPw, email: emailInput.trim() }),
      });
      if (res.error) {
        toast(apiErrorMessage(res, t), { error: true });
        return;
      }
      setEmail(res.email);
      setEmailPw("");
      updateIdentity({ token: res.token, user: res.username });
      toast(t("settings.account.toast.emailSaved"));
    } catch {
      toast(t("shoppingList.toast.genericError"), { error: true });
    }
  }

  async function changePassword() {
    if (pwNew.length < 8) {
      toast(t("settings.account.toast.passwordTooShort"), { error: true });
      return;
    }
    try {
      const res = await api("/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: pwCurrent, new_password: pwNew }),
      });
      if (res.error) {
        toast(apiErrorMessage(res, t), { error: true });
        return;
      }
      if (res.token) localStorage.setItem("ph_token", res.token);
      toast(t("settings.account.toast.passwordChanged"));
      setPwCurrent("");
      setPwNew("");
    } catch {
      toast(t("shoppingList.toast.genericError"), { error: true });
    }
  }

  async function deleteAccount() {
    const soleOwner = isOwner && listUsers.filter((u) => u.is_owner).length <= 1;
    const otherMembers = listUsers.filter((u) => u.username !== user).map((u) => u.name || u.username);
    const message = !soleOwner
      ? t("settings.account.delete.confirmMember")
      : otherMembers.length > 0
        ? t("settings.account.delete.confirmSoleOwnerWithMembers", { members: otherMembers.join(", ") })
        : t("settings.account.delete.confirmSoleOwner");
    if (
      !(await confirm(message, {
        title: t("settings.account.delete.confirmTitle"),
        confirmLabel: t("settings.account.delete.confirmLabel"),
      }))
    )
      return;
    setDeleting(true);
    try {
      const res = await api("/account", {
        method: "DELETE",
        body: JSON.stringify({ current_password: pwDelete }),
      });
      if (res.error) {
        toast(apiErrorMessage(res, t), { error: true });
        setDeleting(false);
        return;
      }
      logout();
    } catch {
      toast(t("shoppingList.toast.genericError"), { error: true });
      setDeleting(false);
    }
  }

  return (
    <section>
      <Card padding="lg" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{t("settings.account.loggedInAs")}</div>
        <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)" }}>{name || user}</div>
        <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{user}</div>

        <SubpageSection label={t("settings.account.name.label")}>
          <FieldLabel htmlFor="profile-name">{t("settings.account.name.label")}</FieldLabel>
          <Input
            id="profile-name"
            placeholder={t("settings.account.name.label")}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={saveName}
          />
        </SubpageSection>

        <SubpageSection
          label={t(email ? "settings.account.email.label" : "settings.account.email.addLabel")}
          description={t("settings.account.email.description")}
        >
          <FieldLabel htmlFor="profile-email">{t("settings.account.email.label")}</FieldLabel>
          <Input id="profile-email" type="email" placeholder={t("settings.account.email.label")} style={{ marginBottom: 8 }} value={emailInput} onChange={(e) => setEmailInput(e.target.value)} />
          <FieldLabel htmlFor="profile-email-pw">{t("settings.account.currentPassword")}</FieldLabel>
          <Input id="profile-email-pw" type="password" placeholder={t("settings.account.currentPassword")} style={{ marginBottom: 10 }} value={emailPw} onChange={(e) => setEmailPw(e.target.value)} />
          <Button variant="primary" onClick={saveEmail}>{t("settings.account.email.save")}</Button>
        </SubpageSection>

        <SubpageSection label={t("settings.account.changePassword.label")}>
          <FieldLabel htmlFor="profile-pw-current">{t("settings.account.currentPassword")}</FieldLabel>
          <Input id="profile-pw-current" type="password" placeholder={t("settings.account.currentPassword")} style={{ marginBottom: 8 }} value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} />
          <FieldLabel htmlFor="profile-pw-new">{t("settings.account.newPassword")}</FieldLabel>
          <Input id="profile-pw-new" type="password" placeholder={t("settings.account.newPassword")} style={{ marginBottom: 10 }} value={pwNew} onChange={(e) => setPwNew(e.target.value)} />
          <Button variant="primary" onClick={changePassword}>{t("settings.account.changePassword.save")}</Button>
        </SubpageSection>

        <SubpageSection>
          <Button variant="outline" onClick={() => logout()}>{t("settings.account.logout")}</Button>
        </SubpageSection>
      </Card>

      <Card padding="lg" style={{ background: "var(--status-danger-subtle)" }}>
        <div style={{ fontWeight: 700, marginBottom: 10, color: "var(--status-danger)" }}>{t("settings.account.delete.label")}</div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginBottom: 8 }}>
          {t(isOwner ? "settings.account.delete.descriptionOwner" : "settings.account.delete.descriptionMember")}
        </div>
        <FieldLabel htmlFor="profile-delete-pw">{t("settings.account.currentPassword")}</FieldLabel>
        <Input id="profile-delete-pw" type="password" placeholder={t("settings.account.currentPassword")} style={{ marginBottom: 10 }} value={pwDelete} onChange={(e) => setPwDelete(e.target.value)} />
        <Button variant="danger" onClick={deleteAccount} disabled={deleting || !pwDelete}>{t("settings.account.delete.label")}</Button>
      </Card>
    </section>
  );
}
