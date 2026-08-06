import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Modal } from "../Modal.jsx";
import { EmptyState } from "../../design-system/index.js";
import { useTranslation } from "../../context/LanguageContext.jsx";

// ~5fps: plenty for a static/slow-moving QR code held up to the camera, and
// keeps CPU/battery use down between frames.
const DETECT_INTERVAL_MS = 200;

// Parses a decoded QR payload into a box number. Accepts the full deep-link
// URL a real sticker encodes (.../b/007 — see BoxQrCode.jsx/boxDeepLinkUrl)
// and, as a fallback, a bare number (typed/decoded digits with no URL
// wrapper). Anything else returns null, so an unrelated QR code drifting
// through frame is silently ignored rather than treated as a match.
function parseScannedBoxNumber(text) {
  try {
    const url = new URL(text);
    const m = url.pathname.match(/^\/b\/(\d+)$/);
    if (m) return m[1];
  } catch {
    /* not a URL — fall through to the bare-number case below */
  }
  return /^\d+$/.test(text.trim()) ? text.trim() : null;
}

// Real camera-based QR scanning (docs/storage-module-plan.md's v2) —
// replaces the earlier simulated timer/random-pick mock. BarcodeDetector
// (Chrome, Android WebView — so the TWA gets it) is used where the browser
// supports it; jsQR — a small, dependency-free pure-JS decoder, so no WASM
// asset to wire into Vite's build (the doc's other named option, zxing-wasm,
// would need one) — is the fallback for Safari/iOS and any other browser
// without native support, fed frames snapshotted from the <video> stream
// onto an offscreen <canvas>.
//
// Resolving what was scanned (the by-number lookup, and the "set it up?"
// path for a number with no box yet) is StorageTab's job, not this
// component's — `onFound(number)` just hands back the parsed number the
// same way a .../b/{number} deep link does, so both paths share StorageTab's
// one openBoxByNumber resolver instead of duplicating it here.
//
// A recognized code hands off *immediately*: no pause showing the decoded
// number, and no exit animation via Modal's requestClose. This used to hold
// the number on screen for 700ms first, which read as a confirmation step to
// sit through on the way to the box — the scan itself is the confirmation
// (docs/storage-module-plan.md), so the box's own editor is the only thing
// worth waiting for. StorageTab unmounts this modal and mounts that editor in
// the same commit, so the handoff is one swap rather than a close-then-open.
export function QrScanModal({ onClose, onFound }) {
  const t = useTranslation();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  // Guards against a second detection resolving after the first handed off —
  // the detect loop itself stops once the camera does, but an in-flight
  // BarcodeDetector.detect() promise could still resolve after that.
  const resolvedRef = useRef(false);

  const [detector] = useState(() => {
    if (typeof window === "undefined" || !("BarcodeDetector" in window)) return null;
    try {
      return new window.BarcodeDetector({ formats: ["qr_code"] });
    } catch {
      return null;
    }
  });
  const [status, setStatus] = useState("starting"); // "starting" | "scanning" | "denied" | "unsupported"

  const stopCamera = useCallback(() => {
    clearTimeout(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const handleDetected = useCallback((text) => {
    if (resolvedRef.current) return;
    const number = parseScannedBoxNumber(text);
    if (!number) return; // not one of our codes — keep scanning
    resolvedRef.current = true;
    stopCamera();
    onFound(number);
  }, [stopCamera, onFound]);

  const tick = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < video.HAVE_CURRENT_DATA) {
      timerRef.current = setTimeout(tick, DETECT_INTERVAL_MS);
      return;
    }
    if (detector) {
      detector.detect(video)
        .then((codes) => {
          if (codes[0]) handleDetected(codes[0].rawValue);
          else timerRef.current = setTimeout(tick, DETECT_INTERVAL_MS);
        })
        .catch(() => { timerRef.current = setTimeout(tick, DETECT_INTERVAL_MS); });
      return;
    }
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(frame.data, frame.width, frame.height);
    if (code) handleDetected(code.data);
    else timerRef.current = setTimeout(tick, DETECT_INTERVAL_MS);
  }, [detector, handleDetected]);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("scanning");
        timerRef.current = setTimeout(tick, DETECT_INTERVAL_MS);
      } catch {
        if (!cancelled) setStatus("denied");
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal onClose={() => { stopCamera(); onClose(); }} title={t("storage.scan.title")}>
      {() => {
        const failed = status === "denied" || status === "unsupported";
        return (
          <>
            {failed ? (
              <EmptyState
                icon="qr-code"
                title={t(status === "denied" ? "storage.scan.deniedTitle" : "storage.scan.unsupportedTitle")}
                description={t(status === "denied" ? "storage.scan.deniedDescription" : "storage.scan.unsupportedDescription")}
              />
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
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: status === "scanning" ? "block" : "none" }}
                  />
                  <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden="true" />
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
                  {status === "scanning" && (
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
                </div>

                <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                  {status === "starting" && t("storage.scan.starting")}
                  {status === "scanning" && t("storage.scan.scanning")}
                </div>
              </>
            )}
          </>
        );
      }}
    </Modal>
  );
}
