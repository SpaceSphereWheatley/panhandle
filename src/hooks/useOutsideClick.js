import { useEffect } from "react";

// Fires `onOutside` for any click landing outside `ref`'s subtree — used to
// close a dropdown/popover. Capture phase, not bubble: a click inside a
// Sheet-based Modal can have its bubble-phase propagation stopped by the
// Sheet's content wrapper, which would otherwise stop a bubble-phase
// document listener from ever firing for clicks inside the modal.
export function useOutsideClick(ref, onOutside) {
  useEffect(() => {
    function onDocClick(e) {
      if (!ref.current?.contains(e.target)) onOutside();
    }
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  });
}
