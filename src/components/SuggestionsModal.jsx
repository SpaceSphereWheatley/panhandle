import { Modal } from "./Modal.jsx";
import { Button, IconButton, EmptyState } from "../design-system/index.js";
import { cap } from "../lib/shoppingUtils.js";

export function SuggestionsModal({ suggestions, onAdd, onClose, onFocusAdd }) {
  return (
    <Modal onClose={onClose} title="Sannsynligvis tom for">
      <div>
        {suggestions.length === 0 ? (
          <EmptyState description="Ingen forslag akkurat nå." />
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
                size="lg"
                variant="filled"
                label={`Legg til ${cap(it.name)}`}
                onClick={() => onAdd(it)}
              />
            </div>
          ))
        )}
      </div>
      <div className="actions">
        <Button
          variant="outline"
          onClick={() => {
            onClose();
            onFocusAdd();
          }}
        >
          Legg til annen vare
        </Button>
      </div>
    </Modal>
  );
}
