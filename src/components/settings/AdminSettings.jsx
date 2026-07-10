import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { iconForItem } from "../../lib/itemIcons.js";
import { APP_VERSION } from "../../lib/version.js";
import { CredentialsModal } from "../CredentialsModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export function AdminSettings() {
  const { user: currentUser } = useAuth();
  const { refresh: refreshListUsers } = useListUsers();
  const [totals, setTotals] = useState("-");
  const [versionDetail, setVersionDetail] = useState("-");
  const [catCount, setCatCount] = useState("-");
  const [mealCount, setMealCount] = useState("-");
  const [iconGapCount, setIconGapCount] = useState("-");
  const [iconGaps, setIconGaps] = useState([]);
  const [users, setUsers] = useState([]);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [ownerMsg, setOwnerMsg] = useState("");
  const [creds, setCreds] = useState(null);

  async function loadCounts() {
    const cat = await api("/catalogue");
    const meals = await api("/meals");
    setCatCount(cat.length);
    setMealCount(meals.length);
    let apiVersion = null;
    try {
      apiVersion = (await api("/version")).version;
    } catch {
      /* offline */
    }
    setVersionDetail(
      !apiVersion
        ? `${APP_VERSION} (app) / ? (api)`
        : apiVersion === APP_VERSION
          ? `${APP_VERSION} ✓`
          : `${APP_VERSION} (app) / ${apiVersion} (api) — avvik`
    );
    const missing = cat.filter((c) => !iconForItem(c.name)).map((c) => c.name).sort();
    setIconGapCount(`${missing.length} av ${cat.length}`);
    setIconGaps(missing);
  }

  async function loadAllUsers() {
    let list;
    try {
      list = await api("/admin/users");
    } catch {
      return;
    }
    const listIds = [...new Set(list.map((u) => u.list_id))];
    setTotals(
      `${list.length} ${list.length === 1 ? "bruker" : "brukere"} · ${listIds.length} ${listIds.length === 1 ? "liste" : "lister"}`
    );
    setUsers(list);
  }

  useEffect(() => {
    loadCounts();
    loadAllUsers();
  }, []);

  async function setFlag(username, flag, value) {
    const res = await api(`/admin/users/${encodeURIComponent(username)}/flags`, {
      method: "PATCH",
      body: JSON.stringify({ [flag]: value }),
    });
    if (res.error) alert(res.error);
    loadAllUsers();
    refreshListUsers();
  }

  async function resetPassword(username) {
    if (!confirm(`Nullstille passordet til ${username}? Alle deres aktive økter logges ut.`)) return;
    const res = await api(`/admin/users/${encodeURIComponent(username)}/reset-password`, { method: "POST" });
    if (res.error) {
      alert(res.error);
      return;
    }
    setCreds({ username: res.username, password: res.password });
  }

  async function createOwner() {
    const name = newOwnerName.trim();
    setOwnerMsg("");
    if (!name) {
      setOwnerMsg("Skriv inn et brukernavn");
      return;
    }
    const res = await api("/admin/owners", { method: "POST", body: JSON.stringify({ username: name }) });
    if (res.error) {
      setOwnerMsg(res.error);
      return;
    }
    setNewOwnerName("");
    loadAllUsers();
    setCreds({ username: res.username, password: res.password });
  }

  const groups = {};
  for (const u of users) (groups[u.list_id] = groups[u.list_id] || []).push(u);

  return (
    <div>
      <div className="setrow"><div className="k">Oversikt</div><div className="v">{totals}</div></div>
      <div className="setrow"><div className="k">Versjon (app / API)</div><div className="v">{versionDetail}</div></div>
      <div className="setrow"><div className="k">Varer i katalog</div><div className="v">{catCount}</div></div>
      <div className="setrow"><div className="k">Måltider i database</div><div className="v">{mealCount}</div></div>

      <div className="setrow">
        <div className="k">Varer uten ikon</div>
        <div className="v">{iconGapCount}</div>
        <div className="icon-gap-list">
          {iconGaps.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </div>

      <div className="setrow">
        <div className="k" style={{ marginBottom: 10 }}>Opprett eier (ny liste)</div>
        <input
          placeholder="Brukernavn for ny eier"
          style={{ width: "100%", padding: 12, fontSize: 16, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-sunken)", color: "var(--text)" }}
          value={newOwnerName}
          onChange={(e) => setNewOwnerName(e.target.value)}
        />
        <button onClick={createOwner} className="btn-primary mt-8">+ Opprett eier</button>
        <div style={{ fontSize: 13, marginTop: 8, minHeight: 16, color: "var(--accent)" }}>{ownerMsg}</div>
      </div>

      <div className="setrow">
        <div className="k" style={{ marginBottom: 10 }}>Alle brukere</div>
        <div>
          {Object.keys(groups).map((listId) => (
            <div key={listId}>
              <div className="admin-group">
                Liste {listId ?? "-"} · {groups[listId].length} {groups[listId].length === 1 ? "bruker" : "brukere"}
              </div>
              {groups[listId].map((u) => (
                <div className="mgmt-row" key={u.username}>
                  <div className="who">
                    <div className="uname">{u.username}</div>
                    <div className="sub">{u.username === currentUser ? "deg" : u.created_by ? "av " + u.created_by : " "}</div>
                  </div>
                  <div className="acts">
                    <label className="flag">
                      <input
                        type="checkbox"
                        checked={!!u.is_admin}
                        onChange={(e) => setFlag(u.username, "is_admin", e.target.checked)}
                      />
                      Admin
                    </label>
                    <label className="flag">
                      <input
                        type="checkbox"
                        checked={!!u.is_owner}
                        onChange={(e) => setFlag(u.username, "is_owner", e.target.checked)}
                      />
                      Eier
                    </label>
                    <button className="mini" onClick={() => resetPassword(u.username)}>Nullstill pw</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {creds && (
        <CredentialsModal username={creds.username} password={creds.password} onClose={() => setCreds(null)} />
      )}
    </div>
  );
}
