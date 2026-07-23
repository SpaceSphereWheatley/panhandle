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
import { useMotionConfig } from "../../hooks/useMotionConfig.js";

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
  const { shouldAnimate, transition } = useMotionConfig();
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creds, setCreds] = useState(null);

  const full = listUsers.length >= 10;

  async function addMember() {
    const name = newName.trim();
    const email = newEmail.trim();
    if (!name) {
      toast("Skriv inn et navn", { error: true });
      return;
    }
    if (!email) {
      toast("Skriv inn en e-post", { error: true });
      return;
    }
    const res = await api("/list-users", { method: "POST", body: JSON.stringify({ name, email }) });
    if (res.error) {
      toast(res.error, { error: true });
      return;
    }
    setNewName("");
    setNewEmail("");
    await refresh();
    setCreds({ username: res.username, password: res.password });
  }

  async function removeMember(username) {
    if (!(await confirm(`Fjerne ${username} fra listen?`, { title: "Fjerne medlem?", confirmLabel: "Fjern" }))) return;
    const res = await api(`/list-users/${encodeURIComponent(username)}`, { method: "DELETE" });
    if (res.error) {
      toast(res.error, { error: true });
      return;
    }
    await refresh();
  }

  return (
    <>
      <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>Medlemmer</div>
      <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)" }}>{listUsers.length} / 10 brukere</div>

      <SubpageSection label="Medlemmer">
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
                  {!!u.is_owner && <Badge tone="secondary">Eier</Badge>}
                  {!!u.is_admin && <Badge tone="primary">Admin</Badge>}
                </>
              }
              subtitle={u.username === currentUser ? "deg" : u.username}
            >
              <Button variant="danger" size="sm" icon="trash" onClick={() => removeMember(u.username)}>Fjern</Button>
            </MotionRow>
          ))}
        </AnimatePresence>
      </SubpageSection>

      <SubpageSection label="Legg til medlem">
        <FieldLabel htmlFor="members-new-name" visuallyHidden>Navn på nytt medlem</FieldLabel>
        <Input
          id="members-new-name"
          placeholder="Navn"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ marginBottom: 8 }}
        />
        <FieldLabel htmlFor="members-new-email" visuallyHidden>E-post for nytt medlem</FieldLabel>
        <Input
          id="members-new-email"
          type="email"
          placeholder="E-post"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <Button variant="primary" icon="plus" onClick={addMember} disabled={full}>
          Legg til bruker
        </Button>
      </SubpageSection>

      {creds && (
        <CredentialsModal username={creds.username} password={creds.password} onClose={() => setCreds(null)} />
      )}
    </>
  );
}
