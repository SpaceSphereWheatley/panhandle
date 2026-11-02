import { useRef, useState } from "react";
import { useTranslation } from "../../context/LanguageContext.jsx";
import { useOutsideClick } from "../../hooks/useOutsideClick.js";

// Chip/token editor for what used to be plain comma-separated text inputs
// (meal ingredients, labels — see U21 in docs/ui-review-plan.md): existing
// tokens render as removable chips, typing + Enter/comma commits a new one,
// and Backspace on an empty field pops the last chip (standard token-input
// mobile keyboards already know). `suggestions` (the item catalogue for
// ingredients, known labels for labels) drive a dropdown so a token can be
// picked instead of retyped — same interaction as the meal-name field's
// dropdown (.meal-name-dropdown in index.css), reused here as .token-dropdown.
export function TokenInput({ id, value, onChange, suggestions = [], placeholder }) {
  const t = useTranslation();
  const [draft, setDraft] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapRef = useRef(null);

  useOutsideClick(wrapRef, () => setShowDropdown(false));

  function commit(raw) {
    const token = raw.trim();
    setDraft("");
    if (!token) return;
    if (value.some((v) => v.toLowerCase() === token.toLowerCase())) return;
    onChange([...value, token]);
  }

  function removeAt(i) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  function onKeyDown(e) {
    if (e.key === "Escape" && showDropdown && draft.trim()) {
      // Close just the dropdown, not the surrounding modal.
      e.stopPropagation();
      setShowDropdown(false);
    } else if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      removeAt(value.length - 1);
    }
  }

  // Suggestions only while something is typed. The dropdown floats over
  // whatever sits below the field — usually the modal's Save button — so
  // showing the whole suggestion list on focus, or leaving it up after a
  // token was committed (draft cleared), meant a tap aimed at Save landed
  // on an option instead and silently added that item.
  const query = draft.trim().toLowerCase();
  const matches = query
    ? suggestions.filter((s) => {
        const ls = s.toLowerCase();
        if (value.some((v) => v.toLowerCase() === ls)) return false;
        return ls.includes(query);
      })
    : [];

  return (
    <div className="token-input" ref={wrapRef}>
      <div className="token-input-chips">
        {value.map((token, i) => (
          <span className="token-chip" key={token}>
            {token}
            <button type="button" aria-label={t("meals.tokenInput.remove", { token })} onClick={() => removeAt(i)}>
              <i className="ph ph-x" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          className="token-input-field"
          autoComplete="off"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setShowDropdown(true);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => commit(draft)}
          placeholder={value.length ? "" : placeholder}
        />
      </div>
      {showDropdown && matches.length > 0 && (
        <div className="token-dropdown">
          {matches.slice(0, 8).map((s) => (
            <div
              className="token-dropdown-option"
              key={s}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(s);
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
