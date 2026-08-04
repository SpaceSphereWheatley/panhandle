import { useEffect, useState } from "react";
import { Modal } from "../Modal.jsx";
import { Button, EmptyState, Checkbox, SegmentedControl, Input } from "../../design-system/index.js";
import { BoxQrCode } from "./BoxQrCode.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useTranslation } from "../../context/LanguageContext.jsx";
import { api } from "../../lib/api.js";
import { apiErrorMessage } from "../../lib/apiError.js";
import { formatBoxNumber, boxDeepLinkUrl } from "../../lib/storageBoxes.js";

// Mirrors the server's own cap on POST /storage/boxes/reserve.
const RESERVE_MAX = 60;

// Printable A4 sheet of stickers (docs/storage-module-plan.md) — QR code and
// box number only, nothing else, since a box's *name* and contents change
// over time while the number never does. Two independent print paths share
// one grid (see index.css's `.storage-print-labels`, print-only content —
// this component's own visible UI is the checklist/reserve form below, not
// a second on-screen copy of the sheet):
//  - "Existing boxes": reprint a selected subset of already-created boxes,
//    so replacing one lost sticker doesn't cost a full sheet.
//  - "New codes": reserve a batch of not-yet-assigned numbers
//    (POST /storage/boxes/reserve burns the counter without creating any
//    box rows) so a stack of empty boxes can be labeled in one pass and
//    filled in later by scanning.
export function BoxLabelsModal({ boxes, onClose }) {
  const t = useTranslation();
  const toast = useToast();
  const sorted = [...boxes].sort((a, b) => a.number - b.number);

  const [mode, setMode] = useState("existing"); // "existing" | "new"
  const [selected, setSelected] = useState(() => new Set(sorted.map((b) => b.id)));
  const [reserveCount, setReserveCount] = useState(12);
  const [reserving, setReserving] = useState(false);
  const [reservedNumbers, setReservedNumbers] = useState(null);

  // window.print() has to wait until the just-reserved sheet is actually in
  // the DOM — an effect keyed on the state that only changes right after a
  // successful reserve guarantees the render/commit has happened first,
  // unlike calling it inline in the async handler right after setState.
  useEffect(() => {
    if (reservedNumbers) window.print();
  }, [reservedNumbers]);

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function reserveAndPrint() {
    setReserving(true);
    let res;
    try {
      res = await api("/storage/boxes/reserve", { method: "POST", body: JSON.stringify({ count: reserveCount }) });
    } catch {
      setReserving(false);
      toast(t("storage.labels.reserveFailed"), { error: true });
      return;
    }
    setReserving(false);
    if (res.error) {
      toast(apiErrorMessage(res, t), { error: true });
      return;
    }
    setReservedNumbers(res.numbers);
  }

  const printSheet = mode === "existing"
    ? sorted.filter((b) => selected.has(b.id))
    : (reservedNumbers || []).map((number) => ({ id: `reserved-${number}`, number }));

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
              <label htmlFor="storage-reserve-count" style={{ display: "block", margin: "12px 0 6px" }}>
                {t("storage.labels.reserveCountLabel")}
              </label>
              <Input
                id="storage-reserve-count"
                type="number"
                min={1}
                max={RESERVE_MAX}
                value={reserveCount}
                onChange={(e) => setReserveCount(Math.min(RESERVE_MAX, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              />

              {reservedNumbers ? (
                <>
                  <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
                    {t("storage.labels.reservedSummary", {
                      from: formatBoxNumber(reservedNumbers[0]),
                      to: formatBoxNumber(reservedNumbers[reservedNumbers.length - 1]),
                    })}
                  </p>
                  <Button variant="primary" icon="printer" onClick={() => window.print()} style={{ width: "100%", marginTop: 8 }}>
                    {t("storage.labels.printButton")}
                  </Button>
                  <Button variant="outline" onClick={() => setReservedNumbers(null)} style={{ width: "100%", marginTop: 8 }}>
                    {t("storage.labels.reserveNewBatch")}
                  </Button>
                </>
              ) : (
                <Button variant="primary" icon="printer" disabled={reserving} onClick={reserveAndPrint} style={{ width: "100%", marginTop: 16 }}>
                  {reserving ? t("common.loading") : t("storage.labels.reserveButton")}
                </Button>
              )}
            </>
          )}

          <div className="storage-print-labels">
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
