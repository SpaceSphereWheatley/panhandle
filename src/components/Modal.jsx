import { Sheet } from "../design-system/index.js";

export function Modal({ onClose, children }) {
  return (
    <Sheet open onClose={onClose} className="modal">
      {children}
    </Sheet>
  );
}
