import { Modal } from "../Modal.jsx";
import { Button } from "../../design-system/index.js";

// Manual install walkthrough for Chrome on Android, shown when the browser
// hasn't (yet) fired `beforeinstallprompt` itself — there's no JS API to
// force that, so this is the closest thing to a real "Installer" flow: an
// actual button + focused steps, instead of a paragraph of static text.
export function InstallHelpModal({ onClose }) {
  return (
    <Modal onClose={onClose}>
      <h3>Installer Panhandle</h3>
      <ol style={{ margin: "0 0 4px", paddingLeft: 20, color: "var(--text-primary)", fontSize: "var(--text-sm)", lineHeight: 1.7 }}>
        <li>Trykk menyknappen <span style={{ fontWeight: 700 }}>⋮</span> øverst til høyre i Chrome.</li>
        <li>Velg <span style={{ fontWeight: 700 }}>"Installer app"</span> (eller "Legg til på startskjerm" hvis det er det eneste valget).</li>
        <li>Bekreft installasjonen. Panhandle dukker opp i appskuffen med sitt eget ikon.</li>
      </ol>
      <p className="cred-note" style={{ margin: "10px 0 0" }}>
        Ser du bare "Legg til på startskjerm"? Chrome bestemmer selv når appen regnes som
        installerbar, og kan trenge litt mer bruk av siden før den tilbyr full installasjon.
      </p>
      <div className="actions">
        <Button variant="primary" onClick={onClose}>Lukk</Button>
      </div>
    </Modal>
  );
}
