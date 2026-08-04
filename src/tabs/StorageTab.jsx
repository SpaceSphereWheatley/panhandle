import { useMemo, useState } from "react";
import { Card, Badge, Input, Button, EmptyState } from "../design-system/index.js";
import { useTranslation } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

// Static mock content for this prototype tab — nothing here is fetched or
// persisted, and there's no backend for it yet. English-only regardless of
// language, same deliberate choice as meal names (see CLAUDE.md's Language
// support section): it's throwaway fixture data, not real user content.
const MOCK_LOCATIONS = [
  {
    id: "garage",
    icon: "car",
    name: "Garage",
    items: ["Christmas lights", "Tool box", "Winter tires", "Extension cords", "Paint cans"],
  },
  {
    id: "attic",
    icon: "house",
    name: "Attic",
    items: ["Old photo albums", "Baby clothes", "Camping tent", "Spare pillows"],
  },
  {
    id: "kitchen-cupboard",
    icon: "cooking-pot",
    name: "Kitchen cupboard (top shelf)",
    items: ["Fondue set", "Waffle iron", "Extra glasses", "Picnic basket"],
  },
  {
    id: "basement",
    icon: "package",
    name: "Basement shelf 2",
    items: ["Board games", "Suitcases", "Ski boots", "Fairy lights", "Halloween decorations"],
  },
];

/** Storage/box-organization concept preview — see AppShell.jsx for the
 * account-gated visibility check. Client-side search over the static mock
 * data above so the eventual "find which box has X" flow feels real, even
 * though nothing is wired to a server yet. */
export function StorageTab({ active }) {
  const t = useTranslation();
  const toast = useToast();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_LOCATIONS;
    return MOCK_LOCATIONS
      .map((loc) => {
        const nameMatches = loc.name.toLowerCase().includes(q);
        const items = nameMatches ? loc.items : loc.items.filter((i) => i.toLowerCase().includes(q));
        return items.length ? { ...loc, items } : null;
      })
      .filter(Boolean);
  }, [query]);

  return (
    <div style={{ padding: "var(--space-4)", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          borderRadius: "var(--radius-md)",
          background: "var(--accent-primary-subtle)",
          color: "var(--text-secondary)",
          fontSize: "var(--text-sm)",
        }}
      >
        <i className="ph ph-eye" style={{ fontSize: 18, flexShrink: 0 }} aria-hidden="true" />
        <span>{t("storage.previewBanner")}</span>
      </div>

      <Input
        icon="magnifying-glass"
        placeholder={t("storage.searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <EmptyState icon="magnifying-glass" title={t("storage.emptyTitle")} description={t("storage.emptyDescription")} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {filtered.map((loc) => (
            <Card key={loc.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <i className={`ph ph-${loc.icon}`} style={{ fontSize: 20, color: "var(--accent-primary)" }} aria-hidden="true" />
                <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "var(--text-md)", flex: 1 }}>{loc.name}</span>
                <Badge tone="neutral">{t("storage.itemCount", { count: loc.items.length })}</Badge>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {loc.items.map((item) => (
                  <span
                    key={item}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "var(--radius-pill)",
                      background: "var(--surface-sunken)",
                      color: "var(--text-secondary)",
                      fontSize: "var(--text-xs)",
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Button variant="secondary" icon="plus" onClick={() => toast(t("storage.addBoxToast"))} style={{ alignSelf: "center" }}>
        {t("storage.addBox")}
      </Button>
    </div>
  );
}
