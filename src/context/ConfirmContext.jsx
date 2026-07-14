import { createContext, useContext, useCallback, useState } from "react";
import { Modal } from "../components/Modal.jsx";
import { Button } from "../design-system/index.js";

const ConfirmContext = createContext(null);

// Promise-based replacement for native confirm(), styled like the rest of
// the app's modals instead of the browser's own dialog. Mirrors
// ToastContext's shape (one global overlay driven by a hook).
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setState({
        message,
        title: opts.title || "Er du sikker?",
        confirmLabel: opts.confirmLabel || "Bekreft",
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
        <Modal onClose={() => settle(false)} title={state.title}>
          <p style={{ color: "var(--text-primary)", fontSize: "var(--text-sm)", lineHeight: 1.5, margin: 0 }}>
            {state.message}
          </p>
          <div className="actions">
            <Button variant="outline" onClick={() => settle(false)}>Avbryt</Button>
            <Button variant={state.danger ? "danger" : "primary"} onClick={() => settle(true)}>
              {state.confirmLabel}
            </Button>
          </div>
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
