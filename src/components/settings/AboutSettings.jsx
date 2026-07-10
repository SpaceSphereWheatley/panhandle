import { useState } from "react";
import { Modal } from "../Modal.jsx";
import { APP_VERSION } from "../../lib/version.js";

export function AboutSettings() {
  const [changelog, setChangelog] = useState(null); // string body when open, null when closed

  async function openChangelog() {
    let body = "Kunne ikke laste endringslogg.";
    try {
      const res = await fetch("/CHANGELOG.md");
      if (res.ok) body = await res.text();
    } catch {
      /* offline */
    }
    setChangelog(body);
  }

  return (
    <div>
      <div className="setrow"><div className="k">Versjon</div><div className="v">{APP_VERSION}</div></div>
      <div className="setrow">
        <button className="btn-primary" onClick={openChangelog}>Hva er nytt?</button>
      </div>
      {changelog !== null && (
        <Modal onClose={() => setChangelog(null)}>
          <h3>Hva er nytt</h3>
          <pre className="cred-box changelog-box">{changelog}</pre>
          <div className="actions">
            <button className="cancel" onClick={() => setChangelog(null)}>Lukk</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
