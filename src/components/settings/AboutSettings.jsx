import { useState } from "react";
import { ChangelogModal } from "../ChangelogModal.jsx";
import { APP_VERSION } from "../../lib/version.js";

export function AboutSettings() {
  const [showChangelog, setShowChangelog] = useState(false);

  return (
    <div>
      <div className="setrow"><div className="k">Versjon</div><div className="v">{APP_VERSION}</div></div>
      <div className="setrow">
        <button className="btn-primary" onClick={() => setShowChangelog(true)}>Hva er nytt?</button>
      </div>
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </div>
  );
}
