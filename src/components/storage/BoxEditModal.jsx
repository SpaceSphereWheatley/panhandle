import { useState } from "react";
import { Modal } from "../Modal.jsx";
import { Button, Input } from "../../design-system/index.js";
import { TokenInput } from "../meals/TokenInput.jsx";
import { BoxQrCode } from "./BoxQrCode.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useConfirm } from "../../context/ConfirmContext.jsx";
import { useTranslation } from "../../context/LanguageContext.jsx";
import { api } from "../../lib/api.js";
import { apiErrorMessage } from "../../lib/apiError.js";
import { formatBoxNumber, boxDeepLinkUrl } from "../../lib/storageBoxes.js";

const LOCATIONS_DATALIST_ID = "storage-box-location-options";

// Add (box=null) or edit (box given) a box against the real /storage/boxes
// endpoints (docs/storage-module-plan.md) — same server-call-inside-the-modal
// shape as ItemEditModal, rather than handing data back to the caller to
// persist. The server allocates the box number (never accepted from the
// client), so a plain new box has no number to show until after it's saved.
//
// `claimNumber` (only meaningful when box=null): set when this add flow was
// reached via StorageTab's openBoxByNumber — scanning a reserved-but-unfilled
// sticker, or one whose old box was deleted — "set it up?" for that exact
// number rather than a fresh one, sent as POST /storage/boxes's claim_number.
export function BoxEditModal({ box, claimNumber, existingLocations, onClose, onSaved }) {
  const toast = useToast();
  const confirm = useConfirm();
  const t = useTranslation();
  const [name, setName] = useState(box?.name || "");
  const [location, setLocation] = useState(box?.location || "");
  const [items, setItems] = useState(box?.items || []);
  const [notes, setNotes] = useState(box?.notes || "");
  // Only meaningful for a plain new box (no existing box, and not already
  // targeting an exact number via a scan — see claimNumber above): lets
  // someone type the number they want instead of accepting the
  // server-allocated smallest-available one. Blank means auto-assign.
  const [manualNumber, setManualNumber] = useState("");
  // Guards against a double-tap double-submit on a slow connection: unlike a
  // duplicate list item (which the server just merges), a duplicate box POST
  // allocates a second box number, so this needs an actual in-flight lock,
  // not just cosmetic feedback. Mutually exclusive with `deleting` — only
  // one destructive/write action can be in flight at once.
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const busy = saving || deleting;

  return (
    <Modal onClose={onClose} title={t(box ? "storage.edit.title" : claimNumber ? "storage.edit.setupTitle" : "storage.edit.newTitle")}>
      {(requestClose) => {
        async function save() {
          const trimmedName = name.trim();
          const trimmedLocation = location.trim();
          if (!trimmedName || !trimmedLocation) {
            toast(t("storage.edit.requiredFields"), { error: true });
            return;
          }
          const trimmedManualNumber = manualNumber.trim();
          const parsedManualNumber = trimmedManualNumber ? parseInt(trimmedManualNumber, 10) : null;
          if (trimmedManualNumber && (!Number.isInteger(parsedManualNumber) || parsedManualNumber < 1)) {
            toast(t("storage.edit.invalidNumber"), { error: true });
            return;
          }
          const body = JSON.stringify({
            name: trimmedName, location: trimmedLocation, items, notes: notes.trim(),
            ...(box
              ? {}
              : claimNumber
                ? { claim_number: claimNumber }
                : parsedManualNumber
                  ? { claim_number: parsedManualNumber }
                  : {}),
          });
          setSaving(true);
          let res;
          try {
            res = box
              ? await api(`/storage/boxes/${box.id}`, { method: "PATCH", body })
              : await api("/storage/boxes", { method: "POST", body });
          } catch {
            setSaving(false);
            toast(t("storage.toast.saveFailed"), { error: true });
            return;
          }
          if (res.error) {
            setSaving(false);
            toast(apiErrorMessage(res, t), { error: true });
            return;
          }
          requestClose(onSaved);
        }

        async function deleteBox() {
          if (
            !(await confirm(t("storage.edit.confirmDelete.body", { name: box.name }), {
              title: t("storage.edit.confirmDelete.title"),
              confirmLabel: t("storage.edit.confirmDelete.confirmLabel"),
            }))
          )
            return;
          setDeleting(true);
          try {
            await api(`/storage/boxes/${box.id}`, { method: "DELETE" });
          } catch {
            setDeleting(false);
            toast(t("storage.toast.deleteFailed"), { error: true });
            return;
          }
          requestClose(onSaved);
        }

        return (
          <>
            {(box || claimNumber) && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
                {box ? (
                  <>
                    <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-default)", flexShrink: 0 }}>
                      <BoxQrCode value={boxDeepLinkUrl(box.number)} label={formatBoxNumber(box.number)} size={72} />
                    </div>
                    <div>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>
                        {t("storage.edit.numberLabel")}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "var(--text-lg)", fontWeight: 700 }}>
                        {formatBoxNumber(box.number)}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-default)", flexShrink: 0 }}>
                      <BoxQrCode value={boxDeepLinkUrl(claimNumber)} label={formatBoxNumber(claimNumber)} size={72} />
                    </div>
                    <div>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>
                        {t("storage.edit.numberLabel")}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "var(--text-lg)", fontWeight: 700 }}>
                        {formatBoxNumber(claimNumber)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {!box && !claimNumber && (
              <>
                <label htmlFor="box-edit-number">{t("storage.edit.numberManualLabel")}</label>
                <Input
                  id="box-edit-number"
                  type="number"
                  min={1}
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                  placeholder={t("storage.edit.numberManualPlaceholder")}
                />
              </>
            )}

            <label htmlFor="box-edit-name">{t("storage.edit.nameLabel")}</label>
            <Input id="box-edit-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("storage.edit.namePlaceholder")} />

            <label htmlFor="box-edit-location">{t("storage.edit.locationLabel")}</label>
            <Input
              id="box-edit-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t("storage.edit.locationPlaceholder")}
              list={LOCATIONS_DATALIST_ID}
            />
            <datalist id={LOCATIONS_DATALIST_ID}>
              {existingLocations.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>

            <label htmlFor="box-edit-items">{t("storage.edit.itemsLabel")}</label>
            <TokenInput id="box-edit-items" value={items} onChange={setItems} placeholder={t("storage.edit.itemsPlaceholder")} />

            <label htmlFor="box-edit-notes">{t("storage.edit.notesLabel")}</label>
            <Input
              id="box-edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("storage.edit.notesPlaceholder")}
            />

            <div className="actions">
              <Button variant="outline" disabled={busy} onClick={() => requestClose()}>{t("common.cancel")}</Button>
              <Button variant="primary" disabled={busy} onClick={save}>{t(saving ? "common.loading" : "common.save")}</Button>
            </div>
            {box && (
              <Button variant="danger" icon="trash" disabled={busy} onClick={deleteBox} style={{ width: "100%", marginTop: 8 }}>
                {t(deleting ? "common.loading" : "storage.edit.deleteBox")}
              </Button>
            )}
          </>
        );
      }}
    </Modal>
  );
}
