import { useId } from "react";
import { UiIcon } from "../UiIcon.jsx";
import { useAccordionGroup } from "./AccordionGroup.jsx";

// Reusable expand/collapse row used inside a Settings island for content
// too heavy to show inline permanently (a form, a list with actions). A
// plain CSS transition — no Framer Motion — since this is content
// disclosure, not a layout-reflow case, and it's opened/closed often.
// Must be rendered inside an AccordionGroup, which makes it exclusive with
// its siblings in that group (opening one closes any other that was open).
export function AccordionRow({ label, children }) {
  const id = useId();
  const { openId, setOpenId } = useAccordionGroup();
  const open = openId === id;
  return (
    <div style={{ borderTop: "1px solid var(--border-default)", marginTop: 12, paddingTop: 12 }}>
      <button
        onClick={() => setOpenId(open ? null : id)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-md)",
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        <span>{label}</span>
        <UiIcon
          name="chevronDown"
          size={14}
          style={{
            color: "var(--accent-primary)",
            transform: open ? "none" : "rotate(-90deg)",
            transition: "transform var(--spring-duration-soft) var(--ease-spring-soft)",
          }}
        />
      </button>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}
