import { createContext, useContext, useCallback, useState } from "react";
import { Modal } from "../components/Modal.jsx";
import { Button } from "../design-system/index.js";
import { useTranslation } from "./LanguageContext.jsx";

const ConfirmContext = createContext(null);

// Promise-based replacement for native confirm(), styled like the rest of
// the app's modals instead of the browser's own dialog. Mirrors
// ToastContext's shape (one global overlay driven by a hook).
export function ConfirmProvider({ children }) {
  const t = useTranslation();
  const [state, setState] = useState(null);

  // Callers pass already-translated title/confirmLabel strings; the defaults
  // are resolved at render time (below) rather than here, so `confirm` keeps
  // its stable identity — it's in several components' effect/callback deps.
  const confirm = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setState({
        message,
        title: opts.title || null,
        confirmLabel: opts.confirmLabel || null,
        danger: opts.danger !== false,
        resolve,
      });
    });
  }, []);

  function settle(result) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Modal onClose={() => settle(false)} title={state.title || t("common.confirm.defaultTitle")}>
          {(requestClose) => (
            <>
              <p style={{ color: "var(--text-primary)", fontSize: "var(--text-sm)", lineHeight: 1.5, margin: 0 }}>
                {state.message}
              </p>
              <div className="actions">
                {/* Cancel and Confirm settle different outcomes, so each passes
                    its own finalCallback rather than relying on requestClose's
                    default (Modal's onClose prop, wired above to settle(false)
                    — the right fallback for backdrop/Escape/drag/back, but
                    Confirm needs settle(true) instead). Calling settle()
                    immediately (without requestClose) would null out `state`
                    right away, unmounting <Modal> before the exit animation
                    ever played. */}
                <Button variant="outline" onClick={() => requestClose(() => settle(false))}>{t("common.cancel")}</Button>
                <Button variant={state.danger ? "danger" : "primary"} onClick={() => requestClose(() => settle(true))}>
                  {state.confirmLabel || t("common.confirm.defaultLabel")}
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
