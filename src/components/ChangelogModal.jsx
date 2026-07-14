import { useEffect, useState } from "react";
import { Modal } from "./Modal.jsx";
import { Button } from "../design-system/index.js";

export function ChangelogModal({ onClose }) {
  const [body, setBody] = useState("Laster...");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/CHANGELOG.md");
        setBody(res.ok ? await res.text() : "Kunne ikke laste endringslogg.");
      } catch {
        setBody("Kunne ikke laste endringslogg.");
      }
    })();
  }, []);

  return (
    <Modal onClose={onClose} title="Hva er nytt">
      <pre className="cred-box changelog-box">{body}</pre>
      <div className="actions">
        <Button variant="primary" onClick={onClose}>Lukk</Button>
      </div>
    </Modal>
  );
}
