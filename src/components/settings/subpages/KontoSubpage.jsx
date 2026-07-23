import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useListUsers } from "../../../context/ListUsersContext.jsx";
import { api } from "../../../lib/api.js";
import { Button, Card, Input } from "../../../design-system/index.js";
import { useToast } from "../../../context/ToastContext.jsx";
import { useConfirm } from "../../../context/ConfirmContext.jsx";
import { SubpageSection } from "../SubpageSection.jsx";
import { FieldLabel } from "../FieldLabel.jsx";

// Konto subpage — a subpage has room, so Navn/E-post/Bytt passord are direct
// fields, each in a SubpageSection so every subpage's labeled blocks look like
// one system. Save model: Navn auto-saves on blur (no password needed, so it's
// a preference, not an action); E-post and Bytt passord keep explicit buttons
// because both require the current password — that's a credential-guarded
// action. Logg ut / Slett konto sit in their own visually distinct blocks so a
// casual tap can't stumble into them, and every button here is the shared
// design-system <Button> (no bespoke .btn-primary/.logout classes).
export function KontoSubpage() {
  const { user, name, isOwner, logout, updateIdentity } = useAuth();
  const { listUsers } = useListUsers();
  const toast = useToast();
  const confirm = useConfirm();
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
        toast(res.error, { error: true });
        return;
      }
      savedName.current = res.name;
      updateIdentity({ name: res.name });
      toast("Navn lagret.");
    } catch {
      toast("Noe gikk galt", { error: true });
    }
  }

  async function saveEmail() {
    try {
      const res = await api("/change-email", {
        method: "POST",
        body: JSON.stringify({ current_password: emailPw, email: emailInput.trim() }),
      });
      if (res.error) {
        toast(res.error, { error: true });
        return;
      }
      setEmail(res.email);
      setEmailPw("");
      updateIdentity({ token: res.token, user: res.username });
      toast("E-post lagret.");
    } catch {
      toast("Noe gikk galt", { error: true });
    }
  }

  async function changePassword() {
    if (pwNew.length < 8) {
      toast("Nytt passord må være minst 8 tegn", { error: true });
      return;
    }
    try {
      const res = await api("/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: pwCurrent, new_password: pwNew }),
      });
      if (res.error) {
        toast(res.error, { error: true });
        return;
      }
      if (res.token) localStorage.setItem("ph_token", res.token);
      toast("Passord endret. Andre enheter er logget ut.");
      setPwCurrent("");
      setPwNew("");
    } catch {
      toast("Noe gikk galt", { error: true });
    }
  }

  async function deleteAccount() {
    const soleOwner = isOwner && listUsers.filter((u) => u.is_owner).length <= 1;
    const otherMembers = listUsers.filter((u) => u.username !== user).map((u) => u.name || u.username);
    const message = !soleOwner
      ? "Kontoen din slettes for godt og du mister tilgang til listen. Dette kan ikke angres."
      : otherMembers.length > 0
        ? `Du er listens eneste eier. Sletter du kontoen din slettes hele listen — handleliste, måltidsplan og alt annet innhold — og tilgangen forsvinner også for: ${otherMembers.join(", ")}. Dette kan ikke angres.`
        : "Du er listens eneste eier. Sletter du kontoen din slettes hele listen — handleliste, måltidsplan og alt annet innhold — for godt. Dette kan ikke angres.";
    if (!(await confirm(message, { title: "Slette konto?", confirmLabel: "Slett konto for godt" }))) return;
    setDeleting(true);
    try {
      const res = await api("/account", {
        method: "DELETE",
        body: JSON.stringify({ current_password: pwDelete }),
      });
      if (res.error) {
        toast(res.error, { error: true });
        setDeleting(false);
        return;
      }
      logout();
    } catch {
      toast("Noe gikk galt", { error: true });
      setDeleting(false);
    }
  }

  return (
    <section>
      <Card padding="lg" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>Innlogget som</div>
        <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)" }}>{name || user}</div>
        <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{user}</div>

        <SubpageSection label="Navn">
          <FieldLabel htmlFor="profile-name">Navn</FieldLabel>
          <Input
            id="profile-name"
            placeholder="Navn"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={saveName}
          />
        </SubpageSection>

        <SubpageSection
          label={email ? "E-post" : "Legg til e-post"}
          description="Brukes til innlogging, Google-innlogging og for å tilbakestille passord hvis du glemmer det. Endrer du e-posten, logges andre enheter ut."
        >
          <FieldLabel htmlFor="profile-email">E-post</FieldLabel>
          <Input id="profile-email" type="email" placeholder="E-post" style={{ marginBottom: 8 }} value={emailInput} onChange={(e) => setEmailInput(e.target.value)} />
          <FieldLabel htmlFor="profile-email-pw">Nåværende passord</FieldLabel>
          <Input id="profile-email-pw" type="password" placeholder="Nåværende passord" style={{ marginBottom: 10 }} value={emailPw} onChange={(e) => setEmailPw(e.target.value)} />
          <Button variant="primary" onClick={saveEmail}>Lagre e-post</Button>
        </SubpageSection>

        <SubpageSection label="Bytt passord">
          <FieldLabel htmlFor="profile-pw-current">Nåværende passord</FieldLabel>
          <Input id="profile-pw-current" type="password" placeholder="Nåværende passord" style={{ marginBottom: 8 }} value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} />
          <FieldLabel htmlFor="profile-pw-new">Nytt passord (min. 8 tegn)</FieldLabel>
          <Input id="profile-pw-new" type="password" placeholder="Nytt passord (min. 8 tegn)" style={{ marginBottom: 10 }} value={pwNew} onChange={(e) => setPwNew(e.target.value)} />
          <Button variant="primary" onClick={changePassword}>Lagre nytt passord</Button>
        </SubpageSection>

        <SubpageSection>
          <Button variant="outline" onClick={() => logout()}>Logg ut</Button>
        </SubpageSection>
      </Card>

      <Card padding="lg" style={{ background: "var(--status-danger-subtle)" }}>
        <div style={{ fontWeight: 700, marginBottom: 10, color: "var(--status-danger)" }}>Slett konto</div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginBottom: 8 }}>
          {isOwner
            ? "Hvis du er listens eneste eier, slettes hele listen — handleliste, måltidsplan og alt annet innhold — når du sletter kontoen din. Har listen en annen eier, mister du bare din egen tilgang."
            : "Du mister tilgang til listen. Dette kan ikke angres."}
        </div>
        <FieldLabel htmlFor="profile-delete-pw">Nåværende passord</FieldLabel>
        <Input id="profile-delete-pw" type="password" placeholder="Nåværende passord" style={{ marginBottom: 10 }} value={pwDelete} onChange={(e) => setPwDelete(e.target.value)} />
        <Button variant="danger" onClick={deleteAccount} disabled={deleting || !pwDelete}>Slett konto</Button>
      </Card>
    </section>
  );
}
