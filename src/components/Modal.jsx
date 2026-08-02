import { useEffect, useRef, useState } from "react";
import { Sheet } from "../design-system/index.js";
import { useIsDesktop } from "../hooks/useIsDesktop.js";

// Module-scoped (not per-instance) since every modal in the app shares one
// "is a modal open" gate: only the first modal to open pushes a history
// entry, and only the last one to close pops it, so switching between modal
// types (e.g. MealsTab swapping its single `modal` state from one type to
// another) doesn't churn the history stack.
let openModalCount = 0;
let historyEntryPushed = false;

export function Modal({ onClose, title, children }) {
  const closedByPopRef = useRef(false);
  // Modal is the only consumer of Sheet, so this one call site decides the
  // placement for every modal in the app.
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(true);
  // Which callback to run once the exit animation actually finishes —
  // defaults to the plain "please unmount me" prop, overridden per-call by
  // requestClose(finalCallback) for outcome-specific dismissals (e.g. a
  // confirm dialog's Confirm button, or a save-success handler).
  const finalCallbackRef = useRef(onClose);

  // A modal's own content (Cancel/Confirm/Save buttons, a save-success
  // handler) needs a way to trigger Sheet's dismissal animation *before*
  // whatever "I'm done" callback it would otherwise call directly — calling
  // that callback immediately unmounts Modal (and cuts the animation short),
  // since it's that same callback's state update, in whichever component
  // rendered <Modal>, that stops rendering it at all.
  //
  // `requestClose(finalCallback)` plays the exit animation and, once it
  // actually finishes, invokes `finalCallback` — or this Modal's own
  // `onClose` prop if omitted, the right default for a plain
  // Cancel/backdrop/Escape/drag/browser-back dismiss. A save-success handler
  // instead passes its own "done" callback (e.g. the prop that clears
  // editing state and reloads data) so that callback fires only once the
  // sheet has actually left the screen, same as every other dismissal
  // route. `children` is a render function rather than a plain node so every
  // caller gets `requestClose` directly in scope — a hook wouldn't work
  // here, since the components calling `<Modal>` are Modal's *parent* in the
  // tree, not a descendant of anything Modal could provide context from.
  function requestClose(finalCallback = onClose) {
    finalCallbackRef.current = finalCallback;
    setOpen(false);
  }

  function handleExited() {
    finalCallbackRef.current && finalCallbackRef.current();
  }

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
        requestClose();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Sheet open={open} onClose={() => requestClose()} onExited={handleExited} title={title} className="modal" placement={isDesktop ? "dialog" : "sheet"}>
      {typeof children === "function" ? children(requestClose) : children}
    </Sheet>
  );
}
