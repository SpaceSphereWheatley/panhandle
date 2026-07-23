import React from "react";

// A user/member row for the management lists (Vårt hjem members, Admin "Alle
// brukere") — a title line (name, optionally with Badges), an optional
// subtitle (username/origin), and a trailing actions slot. Replaces the
// .mgmt-row/.who/.uname/.sub/.acts CSS family so both lists share one
// component instead of a parallel BEM stylesheet.
//
// forwardRef + style pass-through so a parent can animate it with
// motion(ManagementRow), the same pattern the app uses for motion(Card) (see
// ItemCard.jsx / MealsTab.jsx).
export const ManagementRow = React.forwardRef(function ManagementRow(
  { title, subtitle = null, children = null, footer = null, style, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      style={{
        background: "var(--surface-sunken)",
        borderRadius: "var(--radius-md)",
        padding: "10px 12px",
        marginBottom: 6,
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              color: "var(--text-primary)",
              minWidth: 0,
            }}
          >
            {title}
          </div>
          {subtitle != null ? (
            <div
              style={{
                fontSize: "var(--text-2xs)",
                color: "var(--text-tertiary)",
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        {children != null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>{children}</div>
        ) : null}
      </div>
      {footer != null ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid var(--border-default)",
          }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
});
