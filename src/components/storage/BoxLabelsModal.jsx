import { useEffect, useState } from "react";
import { Modal } from "../Modal.jsx";
import { Button, EmptyState, Checkbox, SegmentedControl, Input } from "../../design-system/index.js";
import { BoxQrCode } from "./BoxQrCode.jsx";
import { useTranslation } from "../../context/LanguageContext.jsx";
import { formatBoxNumber, boxDeepLinkUrl } from "../../lib/storageBoxes.js";

// Printable A4 sheet of stickers (docs/storage-module-plan.md) — QR code and
// box number only, nothing else, since a box's *name* and contents change
// over time while the number never does. Two independent print paths share
// one grid (see index.css's `.storage-print-labels`, print-only content —
// this component's own visible UI is the checklist/form below, not
// a second on-screen copy of the sheet):
//  - "Existing boxes": reprint a selected subset of already-created boxes,
//    so replacing one lost sticker doesn't cost a full sheet.
//  - "New sequence": generate and print a custom range of numbers (e.g.,
//    1–10, 50–75) with configurable columns/rows per sheet and orientation.
export function BoxLabelsModal({ boxes, onClose }) {
  const t = useTranslation();
  const sorted = [...boxes].sort((a, b) => a.number - b.number);

  const [mode, setMode] = useState("existing"); // "existing" | "new"
  const [selected, setSelected] = useState(() => new Set(sorted.map((b) => b.id)));

  // New sequence settings
  const [startNumber, setStartNumber] = useState(1);
  const [sequenceMode, setSequenceMode] = useState("end"); // "end" or "count"
  const [endNumber, setEndNumber] = useState(10);
  const [count, setCount] = useState(10);
  const [columnsPerSheet, setColumnsPerSheet] = useState(3);
  const [rowsPerSheet, setRowsPerSheet] = useState(4);
  const [orientation, setOrientation] = useState("portrait"); // "portrait" or "landscape"

  // window.print() has to wait until the sheet is in the DOM
  const [shouldPrint, setShouldPrint] = useState(false);
  useEffect(() => {
    if (shouldPrint) {
      window.print();
      setShouldPrint(false);
    }
  }, [shouldPrint]);

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Calculate the actual end number and statistics for new sequence
  const actualEnd = sequenceMode === "end" ? endNumber : startNumber + count - 1;
  const totalStickers = Math.max(0, actualEnd - startNumber + 1);
  const stickersPerSheet = columnsPerSheet * rowsPerSheet;
  const sheetsNeeded = stickersPerSheet > 0 ? Math.ceil(totalStickers / stickersPerSheet) : 0;

  // Calculate label dimensions in mm
  const pageWidth = orientation === "portrait" ? 190 : 277;
  const pageHeight = orientation === "portrait" ? 277 : 190;
  const labelWidth = (pageWidth / columnsPerSheet).toFixed(1);
  const labelHeight = (pageHeight / rowsPerSheet).toFixed(1);

  // Generate print sheet for existing boxes
  const existingPrintSheet = sorted.filter((b) => selected.has(b.id));

  // Generate print sheet for new sequence
  const newPrintSheet = totalStickers > 0
    ? Array.from({ length: totalStickers }, (_, i) => ({
        id: `new-${startNumber + i}`,
        number: startNumber + i,
      }))
    : [];

  const printSheet = mode === "existing" ? existingPrintSheet : newPrintSheet;

  return (
    <Modal onClose={onClose} title={t("storage.labels.title")}>
      {() => (
        <>
          <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", marginTop: 0 }}>
            {t("storage.labels.description")}
          </p>

          <SegmentedControl
            options={[
              { value: "existing", label: t("storage.labels.tabExisting") },
              { value: "new", label: t("storage.labels.tabNew") },
            ]}
            value={mode}
            onChange={setMode}
          />

          {mode === "existing" ? (
            sorted.length === 0 ? (
              <EmptyState icon="printer" title={t("storage.labels.emptyTitle")} description={t("storage.labels.emptyDescription")} />
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0" }}>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                    {t("storage.labels.selectedCount", { count: selected.size })}
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button variant="outline" onClick={() => setSelected(new Set(sorted.map((b) => b.id)))} style={{ padding: "4px 10px" }}>
                      {t("storage.labels.selectAll")}
                    </Button>
                    <Button variant="outline" onClick={() => setSelected(new Set())} style={{ padding: "4px 10px" }}>
                      {t("storage.labels.selectNone")}
                    </Button>
                  </div>
                </div>
                <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
                  {sorted.map((box) => (
                    <div key={box.id} onClick={() => toggleSelected(box.id)} style={{ cursor: "pointer" }}>
                      <Checkbox
                        checked={selected.has(box.id)}
                        variant="select"
                        label={`${formatBoxNumber(box.number)} — ${box.name}`}
                      />
                    </div>
                  ))}
                </div>
                <Button
                  variant="primary"
                  icon="printer"
                  disabled={selected.size === 0}
                  onClick={() => window.print()}
                  style={{ width: "100%" }}
                >
                  {t("storage.labels.printButton")}
                </Button>
              </>
            )
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="storage-start-number" style={{ display: "block", margin: "0 0 6px", fontSize: "var(--text-sm)", fontWeight: 500 }}>
                    {t("storage.labels.startNumber")}
                  </label>
                  <Input
                    id="storage-start-number"
                    type="number"
                    min={1}
                    value={startNumber}
                    onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", gap: 8 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="radio"
                        checked={sequenceMode === "end"}
                        onChange={() => setSequenceMode("end")}
                        style={{ margin: 0 }}
                      />
                      <span style={{ fontSize: "var(--text-sm)" }}>{t("storage.labels.endNumber")}</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="radio"
                        checked={sequenceMode === "count"}
                        onChange={() => setSequenceMode("count")}
                        style={{ margin: 0 }}
                      />
                      <span style={{ fontSize: "var(--text-sm)" }}>{t("storage.labels.count")}</span>
                    </label>
                  </fieldset>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="storage-seq-value" style={{ display: "block", margin: "0 0 6px", fontSize: "var(--text-sm)", fontWeight: 500 }}>
                    {sequenceMode === "end" ? t("storage.labels.endNumber") : t("storage.labels.count")}
                  </label>
                  <Input
                    id="storage-seq-value"
                    type="number"
                    min={1}
                    max={sequenceMode === "count" ? 500 : 999}
                    value={sequenceMode === "end" ? endNumber : count}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                      if (sequenceMode === "end") {
                        setEndNumber(val);
                      } else {
                        setCount(val);
                      }
                    }}
                  />
                </div>
              </div>

              <div style={{ padding: "10px", backgroundColor: "var(--surface-sunken)", borderRadius: "var(--radius-md)", marginBottom: 12, fontSize: "var(--text-sm)" }}>
                <div>{t("storage.labels.totalStickers", { count: totalStickers })}</div>
                <div>{t("storage.labels.sheetsNeeded", { count: sheetsNeeded })}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                  {t("storage.labels.labelSize", { width: labelWidth, height: labelHeight })}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="storage-columns" style={{ display: "block", margin: "0 0 6px", fontSize: "var(--text-sm)", fontWeight: 500 }}>
                    {t("storage.labels.columnsPerSheet")}
                  </label>
                  <Input
                    id="storage-columns"
                    type="number"
                    min={1}
                    max={6}
                    value={columnsPerSheet}
                    onChange={(e) => setColumnsPerSheet(Math.max(1, Math.min(6, parseInt(e.target.value, 10) || 3)))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="storage-rows" style={{ display: "block", margin: "0 0 6px", fontSize: "var(--text-sm)", fontWeight: 500 }}>
                    {t("storage.labels.rowsPerSheet")}
                  </label>
                  <Input
                    id="storage-rows"
                    type="number"
                    min={1}
                    max={10}
                    value={rowsPerSheet}
                    onChange={(e) => setRowsPerSheet(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 4)))}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", margin: "0 0 6px", fontSize: "var(--text-sm)", fontWeight: 500 }}>
                  {t("storage.labels.orientation")}
                </label>
                <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      checked={orientation === "portrait"}
                      onChange={() => setOrientation("portrait")}
                      style={{ margin: 0 }}
                    />
                    <span style={{ fontSize: "var(--text-sm)" }}>{t("storage.labels.portrait")}</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      checked={orientation === "landscape"}
                      onChange={() => setOrientation("landscape")}
                      style={{ margin: 0 }}
                    />
                    <span style={{ fontSize: "var(--text-sm)" }}>{t("storage.labels.landscape")}</span>
                  </label>
                </fieldset>
              </div>

              <Button
                variant="primary"
                icon="printer"
                disabled={totalStickers === 0}
                onClick={() => setShouldPrint(true)}
                style={{ width: "100%" }}
              >
                {t("storage.labels.printButton")}
              </Button>
            </>
          )}

          <div
            className="storage-print-labels"
            data-orientation={orientation}
            style={{
              '--cols': columnsPerSheet,
              '--rows': rowsPerSheet,
            }}
          >
            {printSheet.map((box) => (
              <div key={box.id} className="storage-sticker">
                <BoxQrCode value={boxDeepLinkUrl(box.number)} label={formatBoxNumber(box.number)} size={80} />
                <div className="storage-sticker__number">{formatBoxNumber(box.number)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
