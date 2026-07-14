import { createContext, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null); // { message, error, fn, label }
  const timerRef = useRef(null);

  function dismiss() {
    clearTimeout(timerRef.current);
    setToast(null);
  }

  // Mirrors public/app.html's showToast(): `undoFn` adds an "Angre" button and
  // extends the visible time; `actionFn`/`actionLabel` does the same with a
  // custom label. Otherwise it auto-hides after a few seconds.
  function show(message, { error = false, undoFn = null, actionFn = null, actionLabel = "Angre" } = {}) {
    clearTimeout(timerRef.current);
    const fn = undoFn || actionFn;
    setToast({ message, error, fn, label: undoFn ? "Angre" : actionLabel });
    timerRef.current = setTimeout(() => setToast(null), fn ? 5000 : 3000);
  }

  function runAction() {
    const fn = toast?.fn;
    dismiss();
    fn?.();
  }

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        id="toast"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`${toast ? "show" : ""} ${toast?.error ? "error" : ""}`}
      >
        {toast && (
          <>
            <span>{toast.message}</span>
            {toast.fn && <button onClick={runAction}>{toast.label}</button>}
          </>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.show;
}
