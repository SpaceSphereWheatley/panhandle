import { useEffect, useRef } from "react";
import { Sheet } from "../design-system/index.js";

// Module-scoped (not per-instance) since every modal in the app shares one
// "is a modal open" gate: only the first modal to open pushes a history
// entry, and only the last one to close pops it, so switching between modal
// types (e.g. MealsTab swapping its single `modal` state from one type to
// another) doesn't churn the history stack.
let openModalCount = 0;
let historyEntryPushed = false;

export function Modal({ onClose, children }) {
  const closedByPopRef = useRef(false);

  useEffect(() => {
    openModalCount += 1;
    if (!historyEntryPushed) {
      historyEntryPushed = true;
      history.pushState({ ...history.state, phModal: true }, "");
    }

    function onPopState(e) {
      if (!e.state?.phModal) {
        closedByPopRef.current = true;
        historyEntryPushed = false;
        onClose && onClose();
      }
    }
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      openModalCount -= 1;
      if (!closedByPopRef.current) {
        // Deferred: a same-commit swap to a different modal type (e.g.
        // browse -> edit) unmounts this one and mounts the next before this
        // task finishes. Only pop the shared entry if nothing re-claimed it.
        queueMicrotask(() => {
          if (openModalCount === 0 && historyEntryPushed) {
            historyEntryPushed = false;
            history.back();
          }
        });
      }
    };
  }, []);

  return (
    <Sheet open onClose={onClose} className="modal">
      {children}
    </Sheet>
  );
}
