import { useEffect, useMemo, useState } from "react";
import { Card, Badge, Input, FabMenu, EmptyState } from "../design-system/index.js";
import { useTranslation } from "../context/LanguageContext.jsx";
import { haptic } from "../lib/shoppingUtils.js";
import { loadBoxes, saveBoxes, nextBoxNumber, matchesQuery } from "../lib/storageBoxes.js";
import { BoxEditModal } from "../components/storage/BoxEditModal.jsx";
import { QrScanModal } from "../components/storage/QrScanModal.jsx";
import { BoxQrCode } from "../components/storage/BoxQrCode.jsx";

const ITEM_PREVIEW_LIMIT = 4;

function BoxCard({ box, onClick, t }) {
  const shown = box.items.slice(0, ITEM_PREVIEW_LIMIT);
  const extra = box.items.length - shown.length;
  return (
    <Card interactive onClick={onClick}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-default)", flexShrink: 0, width: 48, height: 48 }}>
          <BoxQrCode value={box.number} size={48} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", fontWeight: 700 }}>
              {box.number}
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

/** Storage/box-organization concept preview — see AppShell.jsx for the
 * account-gated visibility. Boxes are the primary entity (a location + a
 * content list each), held in React state and mirrored to localStorage via
 * storageBoxes.js so add/edit/delete survive a reload, but nothing is ever
 * sent to a server — this whole tab has no backend. */
export function StorageTab({ active }) {
  const t = useTranslation();
  const [boxes, setBoxes] = useState(loadBoxes);
  const [query, setQuery] = useState("");
  const [editingBox, setEditingBox] = useState(null); // { mode: "new" | "edit", box? }
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    saveBoxes(boxes);
  }, [boxes]);

  const filtered = useMemo(
    () => boxes.filter((box) => matchesQuery(box, query)).sort((a, b) => a.number.localeCompare(b.number)),
    [boxes, query]
  );

  const existingLocations = useMemo(
    () => [...new Set(boxes.map((b) => b.location))].sort(),
    [boxes]
  );

  function saveBox(boxData) {
    setBoxes((prev) => {
      const exists = prev.some((b) => b.id === boxData.id);
      return exists ? prev.map((b) => (b.id === boxData.id ? boxData : b)) : [...prev, boxData];
    });
    setEditingBox(null);
  }

  function deleteBox(id) {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    setEditingBox(null);
  }

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
          { icon: "qr-code", label: t("storage.fab.scan"), onClick: () => setScanning(true) },
          { icon: "plus", label: t("storage.fab.addBox"), onClick: () => setEditingBox({ mode: "new" }) },
        ]}
      />

      {editingBox && (
        <BoxEditModal
          box={editingBox.box || null}
          nextNumber={nextBoxNumber(boxes)}
          existingLocations={existingLocations}
          onClose={() => setEditingBox(null)}
          onSave={saveBox}
          onDelete={deleteBox}
        />
      )}

      {scanning && (
        <QrScanModal
          boxes={boxes}
          onClose={() => setScanning(false)}
          onFound={(box) => {
            setScanning(false);
            setEditingBox({ mode: "edit", box });
          }}
        />
      )}
    </div>
  );
}
