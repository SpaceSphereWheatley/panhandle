import { useState } from "react";
import { UiIcon } from "../UiIcon.jsx";

// Reusable expand/collapse row used inside a Settings island for content
// too heavy to show inline permanently (a form, a list with actions). A
// plain CSS transition — no Framer Motion — since this is content
// disclosure, not a layout-reflow case, and it's opened/closed often.
export function AccordionRow({ label, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: "1px solid var(--border-default)", marginTop: 12, paddingTop: 12 }}>
      <button
        onClick={() => setOpen(!open)}
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
