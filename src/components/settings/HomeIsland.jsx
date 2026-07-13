import { Card } from "../../design-system/index.js";
import { MembersIsland } from "./MembersIsland.jsx";
import { RecurringIsland } from "./RecurringIsland.jsx";

// Island 2 — "Vårt Hjem": Medlemmer and Ukentlig matansvar merged into a
// single visual container, per the spec's "4 distinct visual container
// islands." Owners see both sections divided inside one card; non-owner
// members (no Medlemmer access) just get Recurring's content in the card.
export function HomeIsland({ isOwner }) {
  return (
    <Card padding="lg" style={{ marginBottom: 16 }}>
      {isOwner && (
        <>
          <MembersIsland />
          <div style={{ borderTop: "1px solid var(--border-default)", margin: "16px 0" }} />
        </>
      )}
      <RecurringIsland />
    </Card>
  );
}
