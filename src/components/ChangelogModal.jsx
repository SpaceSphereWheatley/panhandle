import { useEffect, useState } from "react";
import { Modal } from "./Modal.jsx";

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
    <Modal onClose={onClose}>
      <h3>Hva er nytt</h3>
      <pre className="cred-box changelog-box">{body}</pre>
      <div className="actions">
        <button className="cancel" onClick={onClose}>Lukk</button>
      </div>
    </Modal>
  );
}
