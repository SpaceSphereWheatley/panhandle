import { Modal } from "./Modal.jsx";

// One-time credential dialog with a "copy invite text" button. The password
// is never recoverable after this — the server only stores its hash.
export function CredentialsModal({ username, password, onClose }) {
  const invite = `Du er lagt til i Panhandle! Logg inn på https://shopping.mohibb.com\nBrukernavn: ${username}\nPassord: ${password}\n(Bytt passord etter at du har logget inn.)`;

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(invite);
    } catch {
      /* clipboard may be blocked; user can still select the text */
    }
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      <h3>Konto opprettet</h3>
      <p className="cred-note">Dette passordet vises bare nå. Kopier og send det til brukeren.</p>
      <div className="cred-box">{invite}</div>
      <div className="actions">
        <button className="cancel" onClick={onClose}>Lukk</button>
        <button className="save" onClick={copyInvite}>Kopier invitasjon</button>
      </div>
    </Modal>
  );
}
