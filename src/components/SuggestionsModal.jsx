import { Modal } from "./Modal.jsx";
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
              <button
                type="button"
                className="suggest-add"
                aria-label={`Legg til ${cap(it.name)}`}
                onClick={() => onAdd(it)}
              >
                +
              </button>
            </div>
          ))
        )}
      </div>
      <button
        className="meal-browse-add"
        style={{ background: "var(--bg-sunken)", color: "var(--text)" }}
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
