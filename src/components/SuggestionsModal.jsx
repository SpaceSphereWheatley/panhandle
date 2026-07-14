import { Modal } from "./Modal.jsx";
import { IconButton } from "../design-system/index.js";
import { cap } from "../lib/shoppingUtils.js";

export function SuggestionsModal({ suggestions, onAdd, onClose, onFocusAdd }) {
  return (
    <Modal onClose={onClose}>
      <h3>Sannsynligvis tom for</h3>
      <div>
        {suggestions.length === 0 ? (
          <p className="cred-note">Ingen forslag akkurat nå.</p>
        ) : (
          suggestions.map((it) => (
            <div className="meal-browse-row suggest-row" key={it.id}>
              <span className="info">
                <span className="name">{cap(it.name)}</span>
                <span className="stats">
                  Sist kjøpt for {Math.round(it.days_since)} dager siden · vanligvis hver{" "}
                  {Math.round(it.avg_interval_days)}. dag
                </span>
              </span>
              <IconButton
                icon="plus"
                size="sm"
                variant="filled"
                label={`Legg til ${cap(it.name)}`}
                onClick={() => onAdd(it)}
              />
            </div>
          ))
        )}
      </div>
      <button
        className="meal-browse-add"
        style={{ background: "var(--surface-sunken)", color: "var(--text-primary)" }}
        onClick={() => {
          onClose();
          onFocusAdd();
        }}
      >
        Legg til annen vare
      </button>
    </Modal>
  );
}
