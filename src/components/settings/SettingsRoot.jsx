import { useAuth } from "../../context/AuthContext.jsx";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { usePush } from "../../context/PushContext.jsx";
import { PwaInstallCTA } from "./PwaInstallCTA.jsx";
import { SettingsGroup } from "./SettingsGroup.jsx";
import { SettingsRow } from "./SettingsRow.jsx";
import { AboutFooter } from "./AboutFooter.jsx";

// Settings root: hero PWA CTA, then grouped clusters of navigation rows —
// "Meg" (this device + your account), a standalone Varsler row (it straddles
// personal and household, so it sits on its own rather than being forced into
// either), and "Husstanden" (the shared list) — then the flat About footer.
// Every row navigates to a subpage, so the root reads as one uniform list;
// nothing renders controls inline anymore. (Appearance — theme/design/haptics
// — used to live inline here under an "Appinnstillinger" label; it's now the
// "Utseende" subpage, so the root is consistent.)
export function SettingsRoot({ onNavigate }) {
  const { user, name, isAdmin } = useAuth();
  const { listUsers } = useListUsers();
  const { subscribed } = usePush();

  return (
    <section>
      <PwaInstallCTA />

      <SettingsGroup label="Meg">
        <SettingsRow
          icon="palette"
          label="Utseende"
          supportingText="Tema, design og vibrasjon"
          onClick={() => onNavigate(["utseende"])}
        />
        <SettingsRow
          icon="user-circle"
          label="Konto"
          supportingText={name || user}
          onClick={() => onNavigate(["konto"])}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          icon="bell"
          label="Varsler"
          supportingText={subscribed ? "Aktivert" : "Av"}
          onClick={() => onNavigate(["varsler"])}
        />
      </SettingsGroup>

      <SettingsGroup label="Husstanden">
        <SettingsRow
          icon="house"
          label="Vårt hjem"
          supportingText={`${listUsers.length} / 10 medlemmer`}
          onClick={() => onNavigate(["hjem"])}
        />
        <SettingsRow
          icon="storefront"
          label="Butikkoppsett"
          supportingText="Varegrupper og gamle varer"
          onClick={() => onNavigate(["butikk"])}
        />
        {isAdmin && (
          <SettingsRow
            icon="shield-check"
            label="Administrasjon"
            supportingText="Brukere, lister og statistikk"
            onClick={() => onNavigate(["admin"])}
          />
        )}
      </SettingsGroup>

      <AboutFooter />
    </section>
  );
}
