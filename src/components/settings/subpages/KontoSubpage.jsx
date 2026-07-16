import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useListUsers } from "../../../context/ListUsersContext.jsx";
import { api } from "../../../lib/api.js";
import { Button, Card, Input } from "../../../design-system/index.js";
import { useToast } from "../../../context/ToastContext.jsx";
import { useConfirm } from "../../../context/ConfirmContext.jsx";

const fieldLabelStyle = { fontSize: "var(--text-xs)", color: "var(--text-secondary)", display: "block", marginBottom: 4 };
const dividerStyle = { borderTop: "1px solid var(--border-default)", marginTop: 16, paddingTop: 16 };

// Konto subpage — a subpage has room, so Navn/E-post/Bytt passord are
// direct fields rather than accordioned (contrast with the old
// ProfileIsland, which hid them behind AccordionRows on the shared root
// scroll). Logg ut / Slett konto are pulled into their own visually
// distinct danger-zone block below, instead of one more accordion a casual
// tap could stumble into.
export function KontoSubpage() {
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

        <div style={dividerStyle}>
          <div style={{ fontWeight: 600, marginBottom: 10, color: "var(--text-primary)" }}>Navn</div>
          <label htmlFor="profile-name" style={fieldLabelStyle}>Navn</label>
          <Input id="profile-name" placeholder="Navn" style={{ marginBottom: 8 }} value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
          <button onClick={saveName} className="btn-primary">Lagre navn</button>
        </div>

        <div style={dividerStyle}>
          <div style={{ fontWeight: 600, marginBottom: 10, color: "var(--text-primary)" }}>{email ? "E-post" : "Legg til e-post"}</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: 8 }}>
            Brukes til innlogging, Google-innlogging og for å tilbakestille passord hvis du glemmer det. Endrer du e-posten, logges andre enheter ut.
          </div>
          <label htmlFor="profile-email" style={fieldLabelStyle}>E-post</label>
          <Input id="profile-email" type="email" placeholder="E-post" style={{ marginBottom: 8 }} value={emailInput} onChange={(e) => setEmailInput(e.target.value)} />
          <label htmlFor="profile-email-pw" style={fieldLabelStyle}>Nåværende passord</label>
          <Input id="profile-email-pw" type="password" placeholder="Nåværende passord" style={{ marginBottom: 8 }} value={emailPw} onChange={(e) => setEmailPw(e.target.value)} />
          <button onClick={saveEmail} className="btn-primary">Lagre e-post</button>
        </div>

        <div style={dividerStyle}>
          <div style={{ fontWeight: 600, marginBottom: 10, color: "var(--text-primary)" }}>Bytt passord</div>
          <label htmlFor="profile-pw-current" style={fieldLabelStyle}>Nåværende passord</label>
          <Input id="profile-pw-current" type="password" placeholder="Nåværende passord" style={{ marginBottom: 8 }} value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} />
          <label htmlFor="profile-pw-new" style={fieldLabelStyle}>Nytt passord (min. 6 tegn)</label>
          <Input id="profile-pw-new" type="password" placeholder="Nytt passord (min. 6 tegn)" style={{ marginBottom: 8 }} value={pwNew} onChange={(e) => setPwNew(e.target.value)} />
          <button onClick={changePassword} className="btn-primary">Lagre nytt passord</button>
        </div>

        <div style={dividerStyle}>
          <button className="logout" onClick={() => logout()}>Logg ut</button>
        </div>
      </Card>

      <Card padding="lg" style={{ background: "var(--status-danger-subtle)" }}>
        <div style={{ fontWeight: 700, marginBottom: 10, color: "var(--status-danger)" }}>Slett konto</div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginBottom: 8 }}>
          {isOwner
            ? "Hvis du er listens eneste eier, slettes hele listen — handleliste, måltidsplan og alt annet innhold — når du sletter kontoen din. Har listen en annen eier, mister du bare din egen tilgang."
            : "Du mister tilgang til listen. Dette kan ikke angres."}
        </div>
        <label htmlFor="profile-delete-pw" style={fieldLabelStyle}>Nåværende passord</label>
        <Input id="profile-delete-pw" type="password" placeholder="Nåværende passord" style={{ marginBottom: 8 }} value={pwDelete} onChange={(e) => setPwDelete(e.target.value)} />
        <Button variant="danger" onClick={deleteAccount} disabled={deleting || !pwDelete}>Slett konto</Button>
      </Card>
    </section>
  );
}
