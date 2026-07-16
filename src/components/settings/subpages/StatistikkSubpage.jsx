import { Card } from "../../../design-system/index.js";
import { MetricsSettings } from "../MetricsSettings.jsx";

// Full-page charts dashboard (superadmin only) — previously buried inside
// an AccordionRow nested inside AdminIsland; promoted to its own subpage
// since a dashboard needs room, not a fold-out.
export function StatistikkSubpage() {
  return (
    <Card padding="lg">
      <MetricsSettings />
    </Card>
  );
}
