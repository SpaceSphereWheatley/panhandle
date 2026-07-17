import { Card } from "../../../design-system/index.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { MembersIsland } from "../MembersIsland.jsx";
import { RecurringIsland } from "../RecurringIsland.jsx";

// Vårt hjem subpage — Medlemmer (owners only) and Ukentlig matansvar in one
// container, same pairing as the old HomeIsland, just without its own
// Card-level title (the shared Header now carries "Vårt hjem").
export function HjemSubpage() {
  const { isOwner } = useAuth();
  return (
    <Card padding="lg" style={{ overflow: "hidden" }}>
      {isOwner && <MembersIsland />}
      <RecurringIsland />
    </Card>
  );
}
