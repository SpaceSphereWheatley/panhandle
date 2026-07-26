import { useState } from "react";
import { Modal } from "./Modal.jsx";
import { Button } from "../design-system/index.js";
import { api } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";
import { useTranslation } from "../context/LanguageContext.jsx";

// No dedicated design-system textarea exists yet (Input.jsx is hardcoded to
// a single-line <input>) — this is the app's first free-text multi-line
// field, so it's styled inline to match Input's look rather than extending
// a shared primitive for one caller.
export function FeedbackModal({ onClose }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const toast = useToast();
  const t = useTranslation();

  async function send() {
    const trimmed = message.trim();
    if (!trimmed) {
      toast(t("feedback.empty"), { error: true });
      return;
    }
    setSending(true);
    try {
      const res = await api("/feedback", { method: "POST", body: JSON.stringify({ message: trimmed }) });
      if (res.error) {
        // TODO(i18n): res.error is a raw server string (worker/index.js), not run through t() — phase 2+.
        toast(res.error, { error: true });
        setSending(false);
        return;
      }
      toast(t("feedback.thanks"));
      onClose();
    } catch {
      toast(t("shoppingList.toast.genericError"), { error: true });
      setSending(false);
    }
  }

  return (
    <Modal onClose={onClose} title={t("feedback.title")}>
      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.5, margin: "0 0 12px" }}>
        {t("feedback.intro")}
      </p>
      <label htmlFor="feedback-message" className="sr-only">{t("feedback.label")}</label>
      <textarea
        id="feedback-message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t("feedback.placeholder")}
        rows={5}
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "var(--surface-card)",
          border: "1.5px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-md)",
          color: "var(--text-primary)",
          resize: "vertical",
        }}
      />
      <div className="actions">
        <Button variant="outline" onClick={onClose} disabled={sending}>{t("common.cancel")}</Button>
        <Button variant="primary" onClick={send} disabled={sending || !message.trim()}>{t("feedback.send")}</Button>
      </div>
    </Modal>
  );
}
