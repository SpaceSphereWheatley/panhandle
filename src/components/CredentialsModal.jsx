import { Modal } from "./Modal.jsx";
import { Button } from "../design-system/index.js";
import { useToast } from "../context/ToastContext.jsx";

// One-time credential dialog with a "copy invite text" button. The password
// is never recoverable after this — the server only stores its hash.
export function CredentialsModal({ username, password, onClose }) {
  const toast = useToast();
  const invite = `Du er lagt til i Panhandle! Logg inn på https://shopping.mohibb.com\nE-post (brukernavn): ${username}\nPassord: ${password}\n(Bytt passord etter at du har logget inn.)`;

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(invite);
    } catch {
      toast("Kunne ikke kopiere – merk og kopier teksten manuelt", { error: true });
      return;
    }
    toast("Invitasjon kopiert");
    onClose();
  }

  return (
    <Modal onClose={onClose} title="Konto opprettet">
      <p className="cred-note">Dette passordet vises bare nå. Kopier og send det til brukeren.</p>
      <div className="cred-box">{invite}</div>
      <div className="actions">
        <Button variant="outline" onClick={onClose}>Lukk</Button>
        <Button variant="primary" onClick={copyInvite}>Kopier invitasjon</Button>
      </div>
    </Modal>
  );
}
