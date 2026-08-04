import { Modal } from "../Modal.jsx";
import { Button, EmptyState } from "../../design-system/index.js";
import { BoxQrCode } from "./BoxQrCode.jsx";
import { useTranslation } from "../../context/LanguageContext.jsx";
import { formatBoxNumber } from "../../lib/storageBoxes.js";

// Printable sheet of one sticker per box — just the (fake) QR code and the
// box number, nothing else, so it's meant to be cut apart and stuck on the
// physical box. See index.css's `@media print` rule for how `.storage-print-labels`
// isolates this grid from the rest of the app when the Print button (below)
// triggers window.print().
export function BoxLabelsModal({ boxes, onClose }) {
  const t = useTranslation();
  const sorted = [...boxes].sort((a, b) => a.number - b.number);

  return (
    <Modal onClose={onClose} title={t("storage.labels.title")}>
      {() => (
        <>
          <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", marginTop: 0 }}>
            {t("storage.labels.description")}
          </p>

          {sorted.length === 0 ? (
            <EmptyState icon="printer" title={t("storage.labels.emptyTitle")} description={t("storage.labels.emptyDescription")} />
          ) : (
            <>
              <Button variant="primary" icon="printer" onClick={() => window.print()} style={{ width: "100%", marginBottom: 16 }}>
                {t("storage.labels.printButton")}
              </Button>
              <div
                className="storage-print-labels"
                style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 12 }}
              >
                {sorted.map((box) => (
                  <div
                    key={box.id}
                    className="storage-sticker"
                    style={{
                      border: "1.5px dashed var(--border-default)",
                      borderRadius: "var(--radius-md)",
                      padding: 10,
                      textAlign: "center",
                    }}
                  >
                    <BoxQrCode value={formatBoxNumber(box.number)} size={80} />
                    <div style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700, fontSize: "var(--text-md)", marginTop: 6 }}>
                      {formatBoxNumber(box.number)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
