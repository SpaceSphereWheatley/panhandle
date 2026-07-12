import { useState } from "react";
import { api } from "../../lib/api.js";
import { Button } from "../../design-system/index.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { CredentialsModal } from "../CredentialsModal.jsx";

export function MembersSettings() {
  const { user: currentUser } = useAuth();
  const { listUsers, refresh } = useListUsers();
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState("");
  const [creds, setCreds] = useState(null);

  const full = listUsers.length >= 10;

  async function addMember() {
    const name = newName.trim();
    setMsg("");
    if (!name) {
      setMsg("Skriv inn et brukernavn");
      return;
    }
    const res = await api("/list-users", { method: "POST", body: JSON.stringify({ username: name }) });
    if (res.error) {
      setMsg(res.error);
      return;
    }
    setNewName("");
    await refresh();
    setCreds({ username: res.username, password: res.password });
  }

  async function removeMember(username) {
    if (!confirm(`Fjerne ${username} fra listen?`)) return;
    const res = await api(`/list-users/${encodeURIComponent(username)}`, { method: "DELETE" });
    if (res.error) {
      alert(res.error);
      return;
    }
    await refresh();
  }

  return (
    <div>
      <div className="setrow">
        <div className="k" style={{ marginBottom: 4 }}>Brukere på listen</div>
        <div className="v" style={{ marginBottom: 10 }}>{listUsers.length} / 10 brukere</div>
        <div>
          {listUsers.map((u) => (
            <div className="mgmt-row" key={u.username}>
              <div className="who">
                <div className="uname">
                  {u.username}{" "}
                  {u.is_owner && <span className="badge-tag">Eier</span>}{" "}
                  {u.is_admin && <span className="badge-tag admin">Admin</span>}
                </div>
                {u.username === currentUser && <div className="sub">deg</div>}
              </div>
              <div className="acts">
                <Button variant="danger" size="sm" icon="trash" onClick={() => removeMember(u.username)}>Fjern</Button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <input
            placeholder="Brukernavn for nytt medlem"
            style={{ width: "100%", padding: 12, fontSize: 16, borderRadius: 10, border: "1px solid var(--border-default)", background: "var(--surface-sunken)", color: "var(--text-primary)" }}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button onClick={addMember} disabled={full} className="btn-primary mt-8" style={{ opacity: full ? 0.5 : 1 }}>
            + Legg til bruker
          </button>
          <div style={{ fontSize: 13, marginTop: 8, minHeight: 16, color: "var(--accent-primary)" }}>{msg}</div>
        </div>
      </div>

      {creds && (
        <CredentialsModal username={creds.username} password={creds.password} onClose={() => setCreds(null)} />
      )}
    </div>
  );
}
