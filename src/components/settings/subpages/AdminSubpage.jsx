import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../../lib/api.js";
import { useListUsers } from "../../../context/ListUsersContext.jsx";
import { iconForItem } from "../../../lib/itemIcons.js";
import { APP_VERSION } from "../../../lib/version.js";
import { CredentialsModal } from "../../CredentialsModal.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Button, Card, Input, Switch } from "../../../design-system/index.js";
import { SubpageSection } from "../SubpageSection.jsx";
import { SettingsRow } from "../SettingsRow.jsx";
import { FieldLabel } from "../FieldLabel.jsx";
import { ManagementRow } from "../ManagementRow.jsx";
import { useConfirm } from "../../../context/ConfirmContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { useMotionConfig } from "../../../hooks/useMotionConfig.js";

const MotionRow = motion(ManagementRow);

// Per-list group header inside "Alle brukere" — the same eyebrow treatment
// SettingsGroup uses for root clusters, kept in sync instead of the old
// duplicate .admin-group CSS class.
const groupHeadingStyle = {
  fontSize: "var(--text-2xs)",
  fontWeight: 700,
  color: "var(--text-tertiary)",
  textTransform: "uppercase",
  letterSpacing: "var(--tracking-wide)",
  margin: "14px 0 6px",
};

// Administrasjon subpage — directly-visible 2x2 stats, then the heavier
// management tools as always-open SubpageSections (no accordions — see
// SubpageSection.jsx). Statistikk is promoted out to its own subpage/row
// instead of a fold-out, since a full charts dashboard needs its own screen
// (see StatistikkSubpage.jsx).
export function AdminSubpage({ onNavigate }) {
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
    <Card padding="lg" style={{ overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 6 }}>
        <StatTile label="Varer i katalog" value={catCount} icon="package" />
        <StatTile label="Varer uten ikon" value={iconGapCount} icon="image-square" />
        <StatTile label="Måltider i database" value={mealCount} icon="cooking-pot" />
        <StatTile label="Brukere" value={userCount} icon="users" />
      </div>
      <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", marginBottom: 8 }}>
        {listCount} {listCount === 1 ? "liste" : "lister"} · Versjon {versionDetail}
      </div>

      {isSuperAdmin && (
        <SubpageSection label="Varer uten ikon">
          <div className="icon-gap-list">
            {iconGaps.map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
        </SubpageSection>
      )}

      {isSuperAdmin && (
        <SubpageSection label="Opprett eier (ny liste)">
          <FieldLabel htmlFor="admin-new-owner-name" visuallyHidden>Navn på ny eier</FieldLabel>
          <Input
            id="admin-new-owner-name"
            placeholder="Navn"
            value={newOwnerName}
            onChange={(e) => setNewOwnerName(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <FieldLabel htmlFor="admin-new-owner-email" visuallyHidden>E-post for ny eier</FieldLabel>
          <Input
            id="admin-new-owner-email"
            type="email"
            placeholder="E-post"
            value={newOwnerEmail}
            onChange={(e) => setNewOwnerEmail(e.target.value)}
            style={{ marginBottom: 10 }}
          />
          <Button variant="primary" icon="plus" onClick={createOwner}>Opprett eier</Button>
        </SubpageSection>
      )}

      <SubpageSection label="Alle brukere">
        {Object.keys(groups).map((listId) => (
            <div key={listId}>
              <div style={groupHeadingStyle}>
                Liste {listId ?? "-"} · {groups[listId].length} {groups[listId].length === 1 ? "bruker" : "brukere"}
              </div>
              <AnimatePresence initial={false}>
                {groups[listId].map((u) => (
                  <MotionRow
                    key={u.username}
                    layout={shouldAnimate}
                    transition={transition}
                    initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
                    animate={shouldAnimate ? { opacity: 1, y: 0 } : false}
                    exit={shouldAnimate ? { opacity: 0, scale: 0.9 } : undefined}
                    title={u.name || u.username}
                    subtitle={
                      u.username +
                      (u.username === currentUser ? " · deg" : u.created_by ? " · av " + u.created_by : "")
                    }
                    footer={
                      <>
                        <Switch
                          checked={!!u.is_admin}
                          onChange={(v) => setFlag(u.username, "is_admin", v)}
                          label="Admin"
                        />
                        <Switch
                          checked={!!u.is_owner}
                          onChange={(v) => setFlag(u.username, "is_owner", v)}
                          label="Eier"
                        />
                        <div style={{ flex: 1 }} />
                        <Button variant="outline" size="sm" onClick={() => resetPassword(u.username)}>
                          Nullstill passord
                        </Button>
                        {isSuperAdmin && (
                          <Button variant="danger" size="sm" onClick={() => deleteUser(u.username)}>
                            Slett
                          </Button>
                        )}
                      </>
                    }
                  />
                ))}
              </AnimatePresence>
            </div>
          ))}
      </SubpageSection>

      {isSuperAdmin && (
        <div style={{ borderTop: "1px solid var(--border-default)", marginTop: 12, paddingTop: 4 }}>
          <SettingsRow
            flush
            label="Statistikk"
            supportingText="Bruksdata for alle lister"
            onClick={() => onNavigate(["admin", "statistikk"])}
          />
        </div>
      )}

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
