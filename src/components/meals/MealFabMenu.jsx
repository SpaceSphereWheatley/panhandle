import { Modal } from "../Modal.jsx";

// The Måltider tab's FAB opens this small chooser rather than going straight
// to "new meal", since editing an existing meal is just as common a reason to
// tap it.
export function MealFabMenu({ onClose, onNewMeal, onBrowse }) {
  return (
    <Modal onClose={onClose}>
      <h3>Måltider</h3>
      <button className="meal-browse-add" onClick={onNewMeal}>Nytt måltid</button>
      <button
        className="meal-browse-add"
        style={{ background: "var(--bg-sunken)", color: "var(--text)" }}
        onClick={onBrowse}
      >
        Rediger måltider
      </button>
      <div className="actions">
        <button className="cancel" onClick={onClose}>Avbryt</button>
      </div>
    </Modal>
  );
}
