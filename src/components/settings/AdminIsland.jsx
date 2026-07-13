import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { iconForItem } from "../../lib/itemIcons.js";
import { APP_VERSION } from "../../lib/version.js";
import { CredentialsModal } from "../CredentialsModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { Card } from "../../design-system/index.js";
import { AccordionRow } from "./AccordionRow.jsx";

// Island 3 — "Administrasjon" (admin-only): a directly-visible 2x2 stats
// dashboard, then the heavier management tools accordioned.
export function AdminIsland() {
  const { user: currentUser } = useAuth();
  const { refresh: refreshListUsers } = useListUsers();
  const [userCount, setUserCount] = useState("–");
  const [listCount, setListCount] = useState("–");
  const [versionDetail, setVersionDetail] = useState("–");
  const [catCount, setCatCount] = useState("–");
  const [mealCount, setMealCount] = useState("–");
  const [iconGapCount, setIconGapCount] = useState("–");
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
        ? `${APP_VERSION} / ?`
        : apiVersion === APP_VERSION
          ? `${APP_VERSION}`
          : `${APP_VERSION} / ${apiVersion}`
    );
    const missing = cat.filter((c) => !iconForItem(c.name)).map((c) => c.name).sort();
    setIconGapCount(missing.length);
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
    setUserCount(list.length);
    setListCount(listIds.length);
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
    <Card padding="lg" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", marginBottom: 10 }}>Administrasjon</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 6 }}>
        <StatTile label="Varer i katalog" value={catCount} icon="package" />
        <StatTile label="Varer uten ikon" value={iconGapCount} icon="image-square" />
        <StatTile label="Måltider i database" value={mealCount} icon="cooking-pot" />
        <StatTile label="Brukere" value={userCount} icon="users" />
      </div>
      <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", marginBottom: 8 }}>
        {listCount} {listCount === 1 ? "liste" : "lister"} · Versjon {versionDetail}
      </div>

      <AccordionRow label="Varer uten ikon">
        <div className="icon-gap-list">
          {iconGaps.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </AccordionRow>

      <AccordionRow label="Opprett eier (ny liste)">
        <input
          placeholder="Brukernavn for ny eier"
          style={{ width: "100%", padding: 12, fontSize: 16, borderRadius: 10, border: "1px solid var(--border-default)", background: "var(--surface-sunken)", color: "var(--text-primary)" }}
          value={newOwnerName}
          onChange={(e) => setNewOwnerName(e.target.value)}
        />
        <button onClick={createOwner} className="btn-primary mt-8">+ Opprett eier</button>
        <div style={{ fontSize: 13, marginTop: 8, minHeight: 16, color: "var(--accent-primary)" }}>{ownerMsg}</div>
      </AccordionRow>

      <AccordionRow label="Alle brukere">
        {Object.keys(groups).map((listId) => (
          <div key={listId}>
            <div className="admin-group">
              Liste {listId ?? "-"} · {groups[listId].length} {groups[listId].length === 1 ? "bruker" : "brukere"}
            </div>
            {groups[listId].map((u) => (
              <div className="mgmt-row" key={u.username}>
                <div className="who">
                  <div className="uname">{u.username}</div>
                  <div className="sub">{u.username === currentUser ? "deg" : u.created_by ? "av " + u.created_by : " "}</div>
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
      </AccordionRow>

      {creds && (
        <CredentialsModal username={creds.username} password={creds.password} onClose={() => setCreds(null)} />
      )}
    </Card>
  );
}

function StatTile({ label, value, icon }) {
  return (
    <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius-tile)", padding: 14, textAlign: "center" }}>
      <i className={`ph ph-${icon}`} style={{ fontSize: 20, color: "var(--accent-primary)" }} />
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--md-display-small-size)",
          fontWeight: "var(--weight-display-max)",
          lineHeight: 1.1,
          margin: "4px 0",
          color: "var(--text-primary)",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{label}</div>
    </div>
  );
}
