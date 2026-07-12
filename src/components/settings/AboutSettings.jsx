import { useState } from "react";
import { ChangelogModal } from "../ChangelogModal.jsx";
import { APP_VERSION } from "../../lib/version.js";
import logoMark from "../../design-system/assets/logo/panhandle-mark.svg";

export function AboutSettings() {
  const [showChangelog, setShowChangelog] = useState(false);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <img src={logoMark} alt="" style={{ width: 48, height: 48 }} />
      </div>
      <div className="setrow"><div className="k">Versjon</div><div className="v">{APP_VERSION}</div></div>
      <div className="setrow">
        <button className="btn-primary" onClick={() => setShowChangelog(true)}>Hva er nytt?</button>
      </div>
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </div>
  );
}
