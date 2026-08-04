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
          const body = JSON.stringify({
            name: trimmedName, location: trimmedLocation, items,
            ...(box ? {} : claimNumber ? { claim_number: claimNumber } : {}),
          });
          let res;
          try {
            res = box
              ? await api(`/storage/boxes/${box.id}`, { method: "PATCH", body })
              : await api("/storage/boxes", { method: "POST", body });
          } catch {
            toast(t("storage.toast.saveFailed"), { error: true });
            return;
          }
          if (res.error) {
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
          try {
            await api(`/storage/boxes/${box.id}`, { method: "DELETE" });
          } catch {
            toast(t("storage.toast.deleteFailed"), { error: true });
            return;
          }
          requestClose(onSaved);
        }

        return (
          <>
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
              ) : claimNumber ? (
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
              ) : (
                <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
                  {t("storage.edit.numberPending")}
                </div>
              )}
            </div>

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

            <div className="actions">
              <Button variant="outline" onClick={() => requestClose()}>{t("common.cancel")}</Button>
              <Button variant="primary" onClick={save}>{t("common.save")}</Button>
            </div>
            {box && (
              <Button variant="danger" icon="trash" onClick={deleteBox} style={{ width: "100%", marginTop: 8 }}>
                {t("storage.edit.deleteBox")}
              </Button>
            )}
          </>
        );
      }}
    </Modal>
  );
}
