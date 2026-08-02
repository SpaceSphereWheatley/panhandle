import { Modal } from "../Modal.jsx";
import { Button } from "../../design-system/index.js";
import { useTranslation } from "../../context/LanguageContext.jsx";

// Manual install walkthrough for Chrome on Android, shown when the browser
// hasn't (yet) fired `beforeinstallprompt` itself — there's no JS API to
// force that, so this is the closest thing to a real "Installer" flow: an
// actual button + focused steps, instead of a paragraph of static text.
export function InstallHelpModal({ onClose }) {
  const t = useTranslation();
  return (
    <Modal onClose={onClose} title={t("settings.install.cta")}>
      {(requestClose) => (
        <>
          <ol style={{ margin: "0 0 4px", paddingLeft: 20, color: "var(--text-primary)", fontSize: "var(--text-sm)", lineHeight: 1.7 }}>
            {/* Each emphasized step is three keys (before/strong/after) so the bold
                run survives translation — see the dictionary's note. */}
            <li>
              {t("settings.installHelp.step1.before")}
              <span style={{ fontWeight: 700 }}>{t("settings.installHelp.step1.strong")}</span>
              {t("settings.installHelp.step1.after")}
            </li>
            <li>
              {t("settings.installHelp.step2.before")}
              <span style={{ fontWeight: 700 }}>{t("settings.installHelp.step2.strong")}</span>
              {t("settings.installHelp.step2.after")}
            </li>
            <li>{t("settings.installHelp.step3")}</li>
          </ol>
          <p className="cred-note" style={{ margin: "10px 0 0" }}>{t("settings.installHelp.note")}</p>
          <div className="actions">
            <Button variant="primary" onClick={() => requestClose()}>{t("common.close")}</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
