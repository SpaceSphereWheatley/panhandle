import { Modal } from "../Modal.jsx";
import { Button } from "../../design-system/index.js";

// The Måltider tab's FAB opens this small chooser rather than going straight
// to "new meal", since editing an existing meal is just as common a reason to
// tap it.
export function MealFabMenu({ onClose, onNewMeal, onBrowse }) {
  return (
    <Modal onClose={onClose}>
      <h3>Måltider</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Button variant="primary" icon="plus" onClick={onNewMeal} style={{ width: "100%" }}>
          Nytt måltid
        </Button>
        <Button variant="outline" icon="pencil-simple" onClick={onBrowse} style={{ width: "100%" }}>
          Rediger måltider
        </Button>
      </div>
      <div className="actions">
        <button className="cancel" onClick={onClose}>Avbryt</button>
      </div>
    </Modal>
  );
}
