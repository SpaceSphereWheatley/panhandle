import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../lib/api.js";
import { Badge, Button, Input } from "../../design-system/index.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { CredentialsModal } from "../CredentialsModal.jsx";
import { AccordionRow } from "./AccordionRow.jsx";
import { useConfirm } from "../../context/ConfirmContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useMotionConfig } from "../../hooks/useMotionConfig.js";

const MotionRow = motion.div;

// Island 2 (part 1) — "Vårt Hjem": member list + add member, each in its own
// accordion per the spec ("Se nåværende, legg til"). Content-only — no own
// Card wrapper, since HomeIsland.jsx merges this with RecurringIsland into
// one shared container.
export function MembersIsland() {
  const { user: currentUser } = useAuth();
  const { listUsers, refresh } = useListUsers();
  const confirm = useConfirm();
  const toast = useToast();
  const { shouldAnimate, transition } = useMotionConfig();
  const [newName, setNewName] = useState("");
  const [creds, setCreds] = useState(null);

  const full = listUsers.length >= 10;

  async function addMember() {
    const name = newName.trim();
    if (!name) {
      toast("Skriv inn et brukernavn", { error: true });
      return;
    }
    const res = await api("/list-users", { method: "POST", body: JSON.stringify({ username: name }) });
    if (res.error) {
      toast(res.error, { error: true });
      return;
    }
    setNewName("");
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

      <AccordionRow label="Se nåværende medlemmer">
        <AnimatePresence initial={false}>
          {listUsers.map((u) => (
            <MotionRow
              className="mgmt-row"
              key={u.username}
              layout={shouldAnimate}
              transition={transition}
              initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
              animate={shouldAnimate ? { opacity: 1, y: 0 } : false}
              exit={shouldAnimate ? { opacity: 0, scale: 0.9 } : undefined}
            >
              <div className="who">
                <div className="uname">
                  {u.username}{" "}
                  {u.is_owner && <Badge tone="secondary">Eier</Badge>}{" "}
                  {u.is_admin && <Badge tone="primary">Admin</Badge>}
                </div>
                {u.username === currentUser && <div className="sub">deg</div>}
              </div>
              <div className="acts">
                <Button variant="danger" size="sm" icon="trash" onClick={() => removeMember(u.username)}>Fjern</Button>
              </div>
            </MotionRow>
          ))}
        </AnimatePresence>
      </AccordionRow>

      <AccordionRow label="Legg til medlem">
        <label htmlFor="members-new-username" className="sr-only">Brukernavn for nytt medlem</label>
        <Input
          id="members-new-username"
          placeholder="Brukernavn for nytt medlem"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button onClick={addMember} disabled={full} className="btn-primary mt-8" style={{ opacity: full ? 0.5 : 1 }}>
          + Legg til bruker
        </button>
      </AccordionRow>

      {creds && (
        <CredentialsModal username={creds.username} password={creds.password} onClose={() => setCreds(null)} />
      )}
    </>
  );
}
