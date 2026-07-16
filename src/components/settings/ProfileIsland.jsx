import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { api } from "../../lib/api.js";
import { Button, Card, Input } from "../../design-system/index.js";
import { AccordionRow } from "./AccordionRow.jsx";
import { AccordionGroup } from "./AccordionGroup.jsx";
import { SectionHeader } from "./SectionHeader.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useConfirm } from "../../context/ConfirmContext.jsx";

// Island 1 — "Konto": identity display, then accordioned Navn/E-post/Bytt
// passord/Logg ut/Slett konto. Device/app-level prefs (Designintensitet,
// Tema, Vibrasjon) are their own separate island — see AppSettingsIsland.jsx
// — matching every other Settings section being one Card with one
// SectionHeader (see HomeIsland.jsx's comment on the visual-container-island
// spec). The PWA install highlight is its own standalone CTA — see
// PwaInstallCTA.jsx — rendered as a sibling after this card rather than a
// row nested inside it.
export function ProfileIsland() {
  const { user, name, isOwner, logout, updateIdentity } = useAuth();
  const { listUsers } = useListUsers();
  const toast = useToast();
  const confirm = useConfirm();
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [nameInput, setNameInput] = useState(name || user || "");
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
    });
  }, []);

  async function saveName() {
    try {
      const res = await api("/change-name", {
        method: "POST",
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      if (res.error) {
        toast(res.error, { error: true });
        return;
      }
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
      // Username always mirrors e-mail (see TODO #17) — the response carries
      // a fresh token/username since the old one's `sub` no longer matches
      // any row after the rename.
      updateIdentity({ token: res.token, user: res.username });
      toast("E-post lagret.");
    } catch {
      toast("Noe gikk galt", { error: true });
    }
  }

  async function changePassword() {
    if (pwNew.length < 6) {
      toast("Nytt passord må være minst 6 tegn", { error: true });
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
      // server returns a fresh token valid on the new version; the header
      // refresh is skipped for this endpoint, so the body token is authoritative.
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
    <Card padding="lg" style={{ marginBottom: 16, overflow: "hidden" }}>
      <SectionHeader>Konto</SectionHeader>
      <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>Innlogget som</div>
      <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)" }}>{name || user}</div>
      <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", marginBottom: 18 }}>{user}</div>

      <AccordionGroup>
        <AccordionRow label="Navn">
          <label htmlFor="profile-name" style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
            Navn
          </label>
          <Input
            id="profile-name"
            placeholder="Navn"
            style={{ marginBottom: 8 }}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
          />
          <button onClick={saveName} className="btn-primary">Lagre navn</button>
        </AccordionRow>

        <AccordionRow label={email ? "E-post" : "Legg til e-post"}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: 8 }}>
            Brukes til innlogging, Google-innlogging og for å tilbakestille passord hvis du glemmer det. Endrer du e-posten, logges andre enheter ut.
          </div>
          <label htmlFor="profile-email" style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
            E-post
          </label>
          <Input
            id="profile-email"
            type="email"
            placeholder="E-post"
            style={{ marginBottom: 8 }}
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
          />
          <label htmlFor="profile-email-pw" style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
            Nåværende passord
          </label>
          <Input
            id="profile-email-pw"
            type="password"
            placeholder="Nåværende passord"
            style={{ marginBottom: 8 }}
            value={emailPw}
            onChange={(e) => setEmailPw(e.target.value)}
          />
          <button onClick={saveEmail} className="btn-primary">Lagre e-post</button>
        </AccordionRow>

        <AccordionRow label="Bytt passord">
          <label htmlFor="profile-pw-current" style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
            Nåværende passord
          </label>
          <Input
            id="profile-pw-current"
            type="password"
            placeholder="Nåværende passord"
            style={{ marginBottom: 8 }}
            value={pwCurrent}
            onChange={(e) => setPwCurrent(e.target.value)}
          />
          <label htmlFor="profile-pw-new" style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
            Nytt passord (min. 6 tegn)
          </label>
          <Input
            id="profile-pw-new"
            type="password"
            placeholder="Nytt passord (min. 6 tegn)"
            style={{ marginBottom: 8 }}
            value={pwNew}
            onChange={(e) => setPwNew(e.target.value)}
          />
          <button onClick={changePassword} className="btn-primary">Lagre nytt passord</button>
        </AccordionRow>

        <button className="logout" style={{ marginTop: 16 }} onClick={() => logout()}>Logg ut</button>

        <AccordionRow label="Slett konto">
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: 8 }}>
            {isOwner
              ? "Hvis du er listens eneste eier, slettes hele listen — handleliste, måltidsplan og alt annet innhold — når du sletter kontoen din. Har listen en annen eier, mister du bare din egen tilgang."
              : "Du mister tilgang til listen. Dette kan ikke angres."}
          </div>
          <label htmlFor="profile-delete-pw" style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
            Nåværende passord
          </label>
          <Input
            id="profile-delete-pw"
            type="password"
            placeholder="Nåværende passord"
            style={{ marginBottom: 8 }}
            value={pwDelete}
            onChange={(e) => setPwDelete(e.target.value)}
          />
          <Button variant="danger" onClick={deleteAccount} disabled={deleting || !pwDelete}>Slett konto</Button>
        </AccordionRow>
      </AccordionGroup>
    </Card>
  );
}
