import { Modal } from "./Modal.jsx";
import { Button } from "../design-system/index.js";
import { useToast } from "../context/ToastContext.jsx";
import { useTranslation } from "../context/LanguageContext.jsx";

// One-time display of a freshly generated invite link — same structure as
// CredentialsModal, but the link itself is the only secret (no username to
// show alongside it). The raw token is only ever returned by POST
// /list-invites; it can't be recovered afterward since the server only
// stores its hash.
export function InviteLinkModal({ token, onClose }) {
  const toast = useToast();
  const t = useTranslation();
  const link = `${window.location.origin}/?invite_token=${token}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      toast(t("settings.household.members.invite.copyFailed"), { error: true });
      return;
    }
    toast(t("settings.household.members.invite.copied"));
  }

  return (
    <Modal onClose={onClose} title={t("settings.household.members.invite.linkModalTitle")}>
      {(requestClose) => (
        <>
          <p className="cred-note">{t("settings.household.members.invite.linkModalNote")}</p>
          <div className="cred-box">{link}</div>
          <div className="actions">
            <Button variant="outline" onClick={() => requestClose()}>{t("common.close")}</Button>
            <Button variant="primary" onClick={copyLink}>{t("settings.household.members.invite.copyLink")}</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
