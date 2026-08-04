import { useEffect, useMemo, useState } from "react";
import { Card, Badge, Input, FabMenu, EmptyState } from "../design-system/index.js";
import { useTranslation } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { apiErrorMessage } from "../lib/apiError.js";
import { haptic } from "../lib/shoppingUtils.js";
import { formatBoxNumber, matchesQuery, boxDeepLinkUrl } from "../lib/storageBoxes.js";
import { BoxEditModal } from "../components/storage/BoxEditModal.jsx";
import { QrScanModal } from "../components/storage/QrScanModal.jsx";
import { BoxLabelsModal } from "../components/storage/BoxLabelsModal.jsx";
import { BoxQrCode } from "../components/storage/BoxQrCode.jsx";

const ITEM_PREVIEW_LIMIT = 4;

function BoxCard({ box, onClick, t }) {
  const shown = box.items.slice(0, ITEM_PREVIEW_LIMIT);
  const extra = box.items.length - shown.length;
  return (
    <Card interactive onClick={onClick}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-default)", flexShrink: 0, width: 48, height: 48 }}>
          <BoxQrCode value={boxDeepLinkUrl(box.number)} label={formatBoxNumber(box.number)} size={48} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", fontWeight: 700 }}>
              {formatBoxNumber(box.number)}
            </span>
            <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "var(--text-md)" }}>{box.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>
            <i className="ph ph-map-pin" aria-hidden="true" />
            {box.location}
          </div>
        </div>
        <Badge tone="neutral">{t("storage.itemCount", { count: box.items.length })}</Badge>
      </div>
      {box.items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {shown.map((item) => (
            <span
              key={item}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-pill)",
                background: "var(--surface-sunken)",
                color: "var(--text-secondary)",
                fontSize: "var(--text-xs)",
              }}
            >
              {item}
            </span>
          ))}
          {extra > 0 && (
            <span style={{ padding: "4px 10px", color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>
              {t("storage.moreItems", { count: extra })}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

/** Storage/box-organization tab — see AppShell.jsx for the account+device
 * gating (STORAGE_TAB_USER client-side, hasStorageAccess server-side; see
 * docs/storage-module-plan.md). Boxes are real household-shared data now
 * (GET/POST/PATCH/DELETE /storage/boxes), not localStorage. Unlike
 * ShoppingListTab/MealsTab there's no 7s poll — read-mostly reference data,
 * so this loads once when the tab first becomes active and again after any
 * write, rather than continuously.
 *
 * `pendingBoxNumber`/`onConsumedPendingBoxNumber`: a scanned box's deep link
 * (.../b/{number}, see App.jsx and worker/index.js's ROUTING section) lands
 * here already switched to this tab by AppShell. Resolved the same way as
 * an in-app camera scan (see `openBoxByNumber` below) — no intermediate
 * "is this the right one?" step (the scan itself is the confirmation, per
 * the doc), independent of whether the full box list has loaded yet. */
export function StorageTab({ active, pendingBoxNumber, onConsumedPendingBoxNumber }) {
  const t = useTranslation();
  const toast = useToast();
  const [boxes, setBoxes] = useState([]);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [query, setQuery] = useState("");
  const [editingBox, setEditingBox] = useState(null); // { mode: "new" | "edit", box?, claimNumber? }
  const [scanning, setScanning] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  async function loadBoxes() {
    try {
      const res = await api("/storage/boxes");
      if (Array.isArray(res)) setBoxes(res);
    } catch {
      toast(t("storage.toast.loadFailed"), { error: true });
    }
  }

  useEffect(() => {
    if (active && !loadedOnce) {
      setLoadedOnce(true);
      loadBoxes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, loadedOnce]);

  // Shared by both entry points that resolve a scanned/deep-linked number —
  // the in-app camera scanner and the .../b/{number} URL below. A number
  // with no box yet (STORAGE_BOX_NOT_FOUND) isn't necessarily an error: it's
  // also what a reserved-but-unfilled number looks like (POST
  // /storage/boxes/reserve), or a deleted box's old sticker — the doc calls
  // for the same "set it up?" screen in every one of those cases, so this
  // opens a new-box editor pre-targeting that exact number (via
  // BoxEditModal's claimNumber prop / POST /storage/boxes's claim_number)
  // rather than surfacing the 404 as a toast.
  async function openBoxByNumber(number) {
    try {
      const res = await api(`/storage/boxes/by-number/${number}`);
      if (res.error) {
        if (res.code === "STORAGE_BOX_NOT_FOUND") {
          setEditingBox({ mode: "new", claimNumber: Number(number) });
        } else {
          toast(apiErrorMessage(res, t), { error: true });
        }
      } else {
        setEditingBox({ mode: "edit", box: res });
      }
    } catch {
      toast(t("storage.toast.loadFailed"), { error: true });
    }
  }

  useEffect(() => {
    if (!pendingBoxNumber) return;
    let cancelled = false;
    openBoxByNumber(pendingBoxNumber).finally(() => {
      if (!cancelled) onConsumedPendingBoxNumber?.();
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBoxNumber]);

  const filtered = useMemo(
    () => boxes.filter((box) => matchesQuery(box, query)).sort((a, b) => a.number - b.number),
    [boxes, query]
  );

  const existingLocations = useMemo(
    () => [...new Set(boxes.map((b) => b.location).filter(Boolean))].sort(),
    [boxes]
  );

  return (
    <div style={{ padding: "var(--space-4)", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          borderRadius: "var(--radius-md)",
          background: "var(--accent-primary-subtle)",
          color: "var(--text-secondary)",
          fontSize: "var(--text-sm)",
        }}
      >
        <i className="ph ph-eye" style={{ fontSize: 18, flexShrink: 0 }} aria-hidden="true" />
        <span>{t("storage.previewBanner")}</span>
      </div>

      <Input
        icon="magnifying-glass"
        placeholder={t("storage.searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <EmptyState icon="package" title={t("storage.emptyTitle")} description={t(boxes.length === 0 ? "storage.emptyNoBoxes" : "storage.emptyDescription")} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {filtered.map((box) => (
            <BoxCard key={box.id} box={box} t={t} onClick={() => setEditingBox({ mode: "edit", box })} />
          ))}
        </div>
      )}

      <FabMenu
        label={t("storage.fab.label")}
        haptic={haptic}
        actions={[
          { icon: "plus", label: t("storage.fab.addBox"), onClick: () => setEditingBox({ mode: "new" }) },
          { icon: "qr-code", label: t("storage.fab.scan"), onClick: () => setScanning(true) },
          { icon: "printer", label: t("storage.fab.labels"), onClick: () => setShowLabels(true) },
        ]}
      />

      {editingBox && (
        <BoxEditModal
          box={editingBox.box || null}
          claimNumber={editingBox.claimNumber}
          existingLocations={existingLocations}
          onClose={() => setEditingBox(null)}
          onSaved={() => {
            setEditingBox(null);
            loadBoxes();
          }}
        />
      )}

      {scanning && (
        <QrScanModal
          onClose={() => setScanning(false)}
          onFound={(number) => {
            setScanning(false);
            openBoxByNumber(number);
          }}
        />
      )}

      {showLabels && <BoxLabelsModal boxes={boxes} onClose={() => setShowLabels(false)} />}
    </div>
  );
}
