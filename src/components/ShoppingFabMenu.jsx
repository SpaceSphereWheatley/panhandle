import { Modal } from "./Modal.jsx";
import { Button } from "../design-system/index.js";

// The Handleliste tab's FAB chooser, mirroring MealFabMenu's pattern: pulling
// this week's meal-plan ingredients is now the primary action, with the
// "probably out of" recommendations as a secondary option.
export function ShoppingFabMenu({ onClose, onWeekIngredients, onSuggestions, suggestionCount }) {
  return (
    <Modal onClose={onClose}>
      <h3>Handleliste</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Button variant="primary" icon="cooking-pot" onClick={onWeekIngredients} style={{ width: "100%" }}>
          Fra middagsplanen
        </Button>
        <Button variant="outline" icon="sparkle" onClick={onSuggestions} style={{ width: "100%" }}>
          Forslag{suggestionCount ? ` (${suggestionCount})` : ""}
        </Button>
      </div>
      <div className="actions">
        <button className="cancel" onClick={onClose}>Avbryt</button>
      </div>
    </Modal>
  );
}
