import { Modal } from "./Modal.jsx";
import { Button } from "../design-system/index.js";
import { useToast } from "../context/ToastContext.jsx";
import { useTranslation } from "../context/LanguageContext.jsx";

// One-time display of a freshly generated calendar-feed link — same
// structure as InviteLinkModal, but this link is meant to be pasted into a
// calendar app's "subscribe by URL" flow rather than opened directly. The
// raw token is only ever returned by POST /calendar-feed/token; it can't be
// recovered afterward since the server only stores its hash.
export function CalendarFeedLinkModal({ token, onClose }) {
  const toast = useToast();
  const t = useTranslation();
  const link = `${window.location.origin}/api/calendar/${token}.ics`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      toast(t("settings.calendarSync.copyFailed"), { error: true });
      return;
    }
    toast(t("settings.calendarSync.copied"));
  }

  return (
    <Modal onClose={onClose} title={t("settings.calendarSync.linkModalTitle")}>
      {(requestClose) => (
        <>
          <p className="cred-note">{t("settings.calendarSync.linkModalNote")}</p>
          <div className="cred-box">{link}</div>
          <div className="actions">
            <Button variant="outline" onClick={() => requestClose()}>{t("common.close")}</Button>
            <Button variant="primary" onClick={copyLink}>{t("settings.calendarSync.copyLink")}</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
