import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "../Modal.jsx";
import { Button, EmptyState, Checkbox, SegmentedControl, Input, Select } from "../../design-system/index.js";
import { BoxQrCode } from "./BoxQrCode.jsx";
import { useTranslation } from "../../context/LanguageContext.jsx";
import { formatBoxNumber, boxDeepLinkUrl } from "../../lib/storageBoxes.js";

// Sheet types are the counts actually sold as pre-cut A4 label stock —
// picking one of these instead of free-typed columns/rows means the
// printed grid always matches paper someone can buy, not an arbitrary
// division of the page. Portrait only. cols/rows are chosen so each cell
// stays wider than tall (a landscape cell suits the QR-left/number-right
// layout below); usable page area is 190x277mm (A4 less a 10mm margin,
// matching index.css's `.storage-print-labels`).
const PAGE_WIDTH_MM = 190;
const PAGE_HEIGHT_MM = 277;
const SHEET_LAYOUTS = [
  { count: 10, cols: 2, rows: 5 },
  { count: 12, cols: 2, rows: 6 },
  { count: 16, cols: 2, rows: 8 },
  { count: 18, cols: 3, rows: 6 },
  { count: 21, cols: 3, rows: 7 },
  { count: 24, cols: 3, rows: 8 },
  { count: 27, cols: 3, rows: 9 },
];
const DEFAULT_SHEET_TYPE = 24;

// Printable A4 sheet of stickers (docs/storage-module-plan.md) — QR code and
// box number only, nothing else, since a box's *name* and contents change
// over time while the number never does. Two independent print paths share
// one grid (see index.css's `.storage-print-labels`, print-only content —
// this component's own visible UI is the checklist/form below, not
// a second on-screen copy of the sheet):
//  - "Existing boxes": reprint a selected subset of already-created boxes,
//    so replacing one lost sticker doesn't cost a full sheet.
//  - "New sequence": generate and print a custom range of numbers (e.g.,
//    1–10, 50–75), still laid out on the same chosen sheet type.
export function BoxLabelsModal({ boxes, onClose }) {
  const t = useTranslation();
  const sorted = [...boxes].sort((a, b) => a.number - b.number);

  const [mode, setMode] = useState("existing"); // "existing" | "new"
  const [selected, setSelected] = useState(() => new Set(sorted.map((b) => b.id)));
  const [sheetType, setSheetType] = useState(DEFAULT_SHEET_TYPE);
  const layout = SHEET_LAYOUTS.find((l) => l.count === sheetType);

  // New sequence settings
  const [startNumber, setStartNumber] = useState(1);
  const [sequenceMode, setSequenceMode] = useState("end"); // "end" or "count"
  const [endNumber, setEndNumber] = useState(10);
  const [count, setCount] = useState(10);

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
  const sheetsNeeded = Math.ceil(totalStickers / layout.count);

  // Calculate label dimensions in mm
  const labelWidth = (PAGE_WIDTH_MM / layout.cols).toFixed(1);
  const labelHeight = (PAGE_HEIGHT_MM / layout.rows).toFixed(1);

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

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="storage-sheet-type" style={{ display: "block", margin: "0 0 6px", fontSize: "var(--text-sm)", fontWeight: 500 }}>
              {t("storage.labels.sheetType")}
            </label>
            <Select
              id="storage-sheet-type"
              value={sheetType}
              onChange={(e) => setSheetType(Number(e.target.value))}
            >
              {SHEET_LAYOUTS.map((l) => (
                <option key={l.count} value={l.count}>
                  {t("storage.labels.sheetTypeOption", { count: l.count, cols: l.cols, rows: l.rows })}
                </option>
              ))}
            </Select>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: "6px 0 0" }}>
              {t("storage.labels.labelSize", { width: labelWidth, height: labelHeight })}
            </p>
          </div>

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

          {createPortal(
            // Portaled straight to <body> — a sibling of #root, not nested
            // inside Sheet's own position:fixed backdrop — so the print
            // stylesheet (index.css's `.storage-print-labels` block) can
            // just hide #root outright under @media print instead of
            // fighting that nesting (see the block comment there for what
            // that used to require).
            <div
              className="storage-print-labels"
              style={{
                '--cols': layout.cols,
                '--rows': layout.rows,
              }}
            >
              {printSheet.map((box) => (
                <div key={box.id} className="storage-sticker">
                  <div className="storage-sticker__inner">
                    <BoxQrCode value={boxDeepLinkUrl(box.number)} label={formatBoxNumber(box.number)} size={80} />
                    <div className="storage-sticker__number">{formatBoxNumber(box.number)}</div>
                  </div>
                </div>
              ))}
            </div>,
            document.body
          )}
        </>
      )}
    </Modal>
  );
}
