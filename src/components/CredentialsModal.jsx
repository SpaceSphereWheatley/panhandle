import { Modal } from "./Modal.jsx";
import { Button } from "../design-system/index.js";
import { useToast } from "../context/ToastContext.jsx";
import { useTranslation } from "../context/LanguageContext.jsx";

// One-time credential dialog with a "copy invite text" button. The password
// is never recoverable after this — the server only stores its hash.
export function CredentialsModal({ username, password, onClose }) {
  const toast = useToast();
  const t = useTranslation();
  // Written in the inviter's UI language — they're the one composing and
  // sending it, and the invitee has no language preference stored yet.
  const invite = t("auth.credentials.invite", { username, password });

  return (
    <Modal onClose={onClose} title={t("auth.credentials.title")}>
      {(requestClose) => {
        async function copyInvite() {
          try {
            await navigator.clipboard.writeText(invite);
          } catch {
            toast(t("auth.credentials.copyFailed"), { error: true });
            return;
          }
          toast(t("auth.credentials.copied"));
          requestClose();
        }

        return (
          <>
            <p className="cred-note">{t("auth.credentials.note")}</p>
            <div className="cred-box">{invite}</div>
            <div className="actions">
              <Button variant="outline" onClick={() => requestClose()}>{t("common.close")}</Button>
              <Button variant="primary" onClick={copyInvite}>{t("auth.credentials.copy")}</Button>
            </div>
          </>
        );
      }}
    </Modal>
  );
}
