import { Card } from "../../design-system/index.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { MembersIsland } from "./MembersIsland.jsx";
import { RecurringIsland } from "./RecurringIsland.jsx";

// Island 2 — "Vårt Hjem": Medlemmer and Ukentlig matansvar merged into a
// single visual container, per the spec's "4 distinct visual container
// islands." Owners see both sections divided inside one card; non-owner
// members (no Medlemmer access) just get Recurring's content in the card.
// Reads isOwner itself via useAuth() (rather than taking it as a prop),
// matching AdminIsland's self-contained permission check.
export function HomeIsland() {
  const { isOwner } = useAuth();
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
