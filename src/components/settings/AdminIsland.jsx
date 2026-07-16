import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../lib/api.js";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { iconForItem } from "../../lib/itemIcons.js";
import { APP_VERSION } from "../../lib/version.js";
import { CredentialsModal } from "../CredentialsModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { Card, Input } from "../../design-system/index.js";
import { AccordionRow } from "./AccordionRow.jsx";
import { AccordionGroup } from "./AccordionGroup.jsx";
import { SectionHeader } from "./SectionHeader.jsx";
import { MetricsSettings } from "./MetricsSettings.jsx";
import { useConfirm } from "../../context/ConfirmContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useMotionConfig } from "../../hooks/useMotionConfig.js";

const MotionRow = motion.div;

// Island 3 — "Administrasjon" (admin-only): a directly-visible 2x2 stats
// dashboard, then the heavier management tools accordioned.
export function AdminIsland() {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const { refresh: refreshListUsers } = useListUsers();
  const confirm = useConfirm();
  const toast = useToast();
  const { shouldAnimate, transition } = useMotionConfig();
  const [userCount, setUserCount] = useState("–");
  const [listCount, setListCount] = useState("–");
  const [versionDetail, setVersionDetail] = useState("–");
  const [catCount, setCatCount] = useState("–");
  const [mealCount, setMealCount] = useState("–");
  const [iconGapCount, setIconGapCount] = useState("–");
  const [iconGaps, setIconGaps] = useState([]);
  const [users, setUsers] = useState([]);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
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
    const flagLabel = flag === "is_admin" ? "admin" : "eier";
    const verb = value ? `gjøre ${username} til ${flagLabel}` : `fjerne ${flagLabel}-tilgangen til ${username}`;
    if (!(await confirm(`Er du sikker på at du vil ${verb}?`, { title: "Endre tilgang?", confirmLabel: "Bekreft", danger: !value }))) {
      // The checkbox's native DOM state already flipped on click, ahead of
      // this async confirmation — force a render so React's controlled
      // `checked` prop (unchanged, since we're bailing) resyncs onto it.
      setUsers((prev) => [...prev]);
      return;
    }
    const res = await api(`/admin/users/${encodeURIComponent(username)}/flags`, {
      method: "PATCH",
      body: JSON.stringify({ [flag]: value }),
    });
    if (res.error) toast(res.error, { error: true });
    loadAllUsers();
    refreshListUsers();
  }

  async function resetPassword(username) {
    if (!(await confirm(`Nullstille passordet til ${username}? Alle deres aktive økter logges ut.`, { title: "Nullstille passord?", confirmLabel: "Nullstill" })))
      return;
    const res = await api(`/admin/users/${encodeURIComponent(username)}/reset-password`, { method: "POST" });
    if (res.error) {
      toast(res.error, { error: true });
      return;
    }
    setCreds({ username: res.username, password: res.password });
  }

  async function deleteUser(username) {
    const target = users.find((u) => u.username === username);
    const isLoneOwner = !!target?.is_owner
      && groups[target.list_id].filter((u) => u.is_owner).length <= 1;

    if (isLoneOwner) {
      if (!(await confirm(
        `${username} er eneste eier av listen sin. Å slette brukeren sletter HELE listen med alt innhold (varer, katalog, måltider) permanent for alle på den. Dette kan ikke angres.`,
        { title: "Slette bruker og liste?", confirmLabel: "Slett bruker og liste" }
      ))) return;
      const res = await api(`/admin/users/${encodeURIComponent(username)}`, {
        method: "DELETE",
        body: JSON.stringify({ delete_list: true }),
      });
      if (res.error) {
        toast(res.error, { error: true });
        return;
      }
      toast(`${username} og listen er slettet`);
      loadAllUsers();
      refreshListUsers();
      return;
    }

    if (!(await confirm(`Slette brukeren ${username} for godt? Dette kan ikke angres.`, { title: "Slette bruker?", confirmLabel: "Slett" })))
      return;
    const res = await api(`/admin/users/${encodeURIComponent(username)}`, { method: "DELETE" });
    if (res.error) {
      toast(res.error, { error: true });
      return;
    }
    loadAllUsers();
    refreshListUsers();
  }

  async function createOwner() {
    const name = newOwnerName.trim();
    const email = newOwnerEmail.trim();
    if (!name) {
      toast("Skriv inn et navn", { error: true });
      return;
    }
    if (!email) {
      toast("Skriv inn en e-post", { error: true });
      return;
    }
    const res = await api("/admin/owners", { method: "POST", body: JSON.stringify({ name, email }) });
    if (res.error) {
      toast(res.error, { error: true });
      return;
    }
    setNewOwnerName("");
    setNewOwnerEmail("");
    loadAllUsers();
    setCreds({ username: res.username, password: res.password });
  }

  const groups = {};
  for (const u of users) (groups[u.list_id] = groups[u.list_id] || []).push(u);

  return (
    <Card padding="lg" style={{ marginBottom: 16, overflow: "hidden" }}>
      <SectionHeader>Administrasjon</SectionHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 6 }}>
        <StatTile label="Varer i katalog" value={catCount} icon="package" />
        <StatTile label="Varer uten ikon" value={iconGapCount} icon="image-square" />
        <StatTile label="Måltider i database" value={mealCount} icon="cooking-pot" />
        <StatTile label="Brukere" value={userCount} icon="users" />
      </div>
      <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", marginBottom: 8 }}>
        {listCount} {listCount === 1 ? "liste" : "lister"} · Versjon {versionDetail}
      </div>

      <AccordionGroup>
        <AccordionRow label="Varer uten ikon">
          <div className="icon-gap-list">
            {iconGaps.map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
        </AccordionRow>

        <AccordionRow label="Opprett eier (ny liste)">
          <label htmlFor="admin-new-owner-name" className="sr-only">Navn på ny eier</label>
          <Input
            id="admin-new-owner-name"
            placeholder="Navn"
            value={newOwnerName}
            onChange={(e) => setNewOwnerName(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <label htmlFor="admin-new-owner-email" className="sr-only">E-post for ny eier</label>
          <Input
            id="admin-new-owner-email"
            type="email"
            placeholder="E-post"
            value={newOwnerEmail}
            onChange={(e) => setNewOwnerEmail(e.target.value)}
          />
          <button onClick={createOwner} className="btn-primary mt-8">+ Opprett eier</button>
        </AccordionRow>

        <AccordionRow label="Alle brukere">
          {Object.keys(groups).map((listId) => (
            <div key={listId}>
              <div className="admin-group">
                Liste {listId ?? "-"} · {groups[listId].length} {groups[listId].length === 1 ? "bruker" : "brukere"}
              </div>
              <AnimatePresence initial={false}>
                {groups[listId].map((u) => (
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
                      <div className="uname">{u.name || u.username}</div>
                      <div className="sub">
                        {u.username}
                        {u.username === currentUser ? " · deg" : u.created_by ? " · av " + u.created_by : ""}
                      </div>
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
                      {isSuperAdmin && (
                        <button className="mini danger" onClick={() => deleteUser(u.username)}>Slett</button>
                      )}
                    </div>
                  </MotionRow>
                ))}
              </AnimatePresence>
            </div>
          ))}
        </AccordionRow>

        {isSuperAdmin && (
          <AccordionRow label="Statistikk (alle lister)">
            <MetricsSettings />
          </AccordionRow>
        )}
      </AccordionGroup>

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
