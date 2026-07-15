import { Card } from "../../design-system/index.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { MembersIsland } from "./MembersIsland.jsx";
import { RecurringIsland } from "./RecurringIsland.jsx";
import { SectionHeader } from "./SectionHeader.jsx";

// Island 2 — "Vårt Hjem": Medlemmer and Ukentlig matansvar merged into a
// single visual container, per the spec's "4 distinct visual container
// islands." Owners see both sections divided inside one card; non-owner
// members (no Medlemmer access) just get Recurring's content in the card.
// Reads isOwner itself via useAuth() (rather than taking it as a prop),
// matching AdminIsland's self-contained permission check. No manual divider
// needed between the two — RecurringIsland's AccordionRow supplies its own
// top border, same as it does between MembersIsland's two accordions.
export function HomeIsland() {
  const { isOwner } = useAuth();
  return (
    <Card padding="lg" style={{ marginBottom: 16, overflow: "hidden" }}>
      <SectionHeader>Vårt hjem</SectionHeader>
      {isOwner && <MembersIsland />}
      <RecurringIsland />
    </Card>
  );
}
