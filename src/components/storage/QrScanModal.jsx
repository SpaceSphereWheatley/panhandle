import { useEffect, useRef, useState } from "react";
import { Modal } from "../Modal.jsx";
import { Button, EmptyState } from "../../design-system/index.js";
import { BoxQrCode } from "./BoxQrCode.jsx";
import { useTranslation } from "../../context/LanguageContext.jsx";

const SCAN_DURATION_MS = 1600;

// Fully simulated "scan a box's QR label" flow — no camera access, no real
// decoding. A timer stands in for "found something" and picks a random box
// out of the current list, purely so the "walk up to a shelf, scan the box,
// jump straight to its contents" idea has something to click through. See
// BoxQrCode.jsx for the other half of the mockup (the fake label itself).
export function QrScanModal({ boxes, onClose, onFound }) {
  const t = useTranslation();
  const [foundBox, setFoundBox] = useState(null);
  const timerRef = useRef(null);

  function startScan() {
    setFoundBox(null);
    clearTimeout(timerRef.current);
    if (boxes.length === 0) return;
    timerRef.current = setTimeout(() => {
      setFoundBox(boxes[Math.floor(Math.random() * boxes.length)]);
    }, SCAN_DURATION_MS);
  }

  useEffect(() => {
    startScan();
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal onClose={onClose} title={t("storage.scan.title")}>
      {(requestClose) => (
        <>
          {boxes.length === 0 ? (
            <EmptyState icon="qr-code" title={t("storage.scan.noBoxesTitle")} description={t("storage.scan.noBoxesDescription")} />
          ) : (
            <>
              <div
                style={{
                  position: "relative",
                  width: 200,
                  height: 200,
                  margin: "8px auto 16px",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--surface-sunken)",
                  overflow: "hidden",
                }}
              >
                {["top:10px;left:10px;border-width:3px 0 0 3px", "top:10px;right:10px;border-width:3px 3px 0 0", "bottom:10px;left:10px;border-width:0 0 3px 3px", "bottom:10px;right:10px;border-width:0 3px 3px 0"].map((decl, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      width: 28,
                      height: 28,
                      borderColor: "var(--accent-primary)",
                      borderStyle: "solid",
                      ...Object.fromEntries(decl.split(";").map((rule) => {
                        const [prop, val] = rule.split(":");
                        return [prop === "border-width" ? "borderWidth" : prop, val];
                      })),
                    }}
                  />
                ))}
                {!foundBox && (
                  <span
                    aria-hidden="true"
                    className="qr-scan-line"
                    style={{
                      position: "absolute",
                      left: 12,
                      right: 12,
                      height: 2,
                      background: "var(--accent-primary)",
                      boxShadow: "0 0 8px var(--accent-primary)",
                    }}
                  />
                )}
                {foundBox && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <BoxQrCode value={foundBox.number} size={110} />
                  </div>
                )}
              </div>

              {!foundBox ? (
                <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                  {t("storage.scan.scanning")}
                </div>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700, fontSize: "var(--text-lg)" }}>{foundBox.number}</div>
                  <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, marginTop: 2 }}>{foundBox.name}</div>
                  <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", marginTop: 2 }}>{foundBox.location}</div>
                  <div className="actions" style={{ marginTop: 16 }}>
                    <Button variant="outline" onClick={startScan}>{t("storage.scan.scanAgain")}</Button>
                    <Button variant="primary" onClick={() => requestClose(() => onFound(foundBox))}>{t("storage.scan.viewBox")}</Button>
                  </div>
                </div>
              )}
            </>
          )}
          <div style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-2xs)", marginTop: 16 }}>
            {t("storage.scan.disclaimer")}
          </div>
        </>
      )}
    </Modal>
  );
}
