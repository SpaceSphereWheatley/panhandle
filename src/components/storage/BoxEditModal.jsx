import { useState } from "react";
import { Modal } from "../Modal.jsx";
import { Button, Input } from "../../design-system/index.js";
import { TokenInput } from "../meals/TokenInput.jsx";
import { BoxQrCode } from "./BoxQrCode.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useConfirm } from "../../context/ConfirmContext.jsx";
import { useTranslation } from "../../context/LanguageContext.jsx";
import { newBoxId } from "../../lib/storageBoxes.js";

const LOCATIONS_DATALIST_ID = "storage-box-location-options";

// Add (box=null) or edit (box given) a box, entirely in local component
// state — see StorageTab.jsx for how the result is merged into the
// localStorage-backed list. No server call, so there's no error/loading
// state to handle, unlike every other *EditModal in the app.
export function BoxEditModal({ box, nextNumber, existingLocations, onClose, onSave, onDelete }) {
  const toast = useToast();
  const confirm = useConfirm();
  const t = useTranslation();
  const [name, setName] = useState(box?.name || "");
  const [location, setLocation] = useState(box?.location || "");
  const [items, setItems] = useState(box?.items || []);
  const number = box?.number || nextNumber;

  return (
    <Modal onClose={onClose} title={t(box ? "storage.edit.title" : "storage.edit.newTitle")}>
      {(requestClose) => {
        function save() {
          const trimmedName = name.trim();
          const trimmedLocation = location.trim();
          if (!trimmedName || !trimmedLocation) {
            toast(t("storage.edit.requiredFields"), { error: true });
            return;
          }
          requestClose(() =>
            onSave({
              id: box?.id || newBoxId(),
              number,
              name: trimmedName,
              location: trimmedLocation,
              items,
            })
          );
        }

        async function deleteBox() {
          if (
            !(await confirm(t("storage.edit.confirmDelete.body", { name: box.name }), {
              title: t("storage.edit.confirmDelete.title"),
              confirmLabel: t("storage.edit.confirmDelete.confirmLabel"),
            }))
          )
            return;
          requestClose(() => onDelete(box.id));
        }

        return (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
              <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-default)", flexShrink: 0 }}>
                <BoxQrCode value={number} size={72} />
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>
                  {t("storage.edit.numberLabel")}
                </div>
                <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "var(--text-lg)", fontWeight: 700 }}>{number}</div>
              </div>
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
