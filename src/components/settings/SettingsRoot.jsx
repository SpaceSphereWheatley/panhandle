import { useAuth } from "../../context/AuthContext.jsx";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { usePush } from "../../context/PushContext.jsx";
import { useLanguage, useTranslation } from "../../context/LanguageContext.jsx";
import { SETTINGS_SUBPAGE_TITLE_KEYS } from "../../lib/settingsNav.js";
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
  const { lang } = useLanguage();
  const t = useTranslation();

  return (
    <section>
      <PwaInstallCTA />

      <SettingsGroup label={t("settings.root.group.me")}>
        <SettingsRow
          icon="palette"
          label={t(SETTINGS_SUBPAGE_TITLE_KEYS.utseende)}
          supportingText={t("settings.root.appearance.supporting")}
          onClick={() => onNavigate(["appearance"])}
        />
        <SettingsRow
          icon="user-circle"
          label={t(SETTINGS_SUBPAGE_TITLE_KEYS.konto)}
          supportingText={name || user}
          onClick={() => onNavigate(["account"])}
        />
        <SettingsRow
          icon="translate"
          label={t(SETTINGS_SUBPAGE_TITLE_KEYS.sprak)}
          // Each language's own endonym, never translated — the point of this
          // row is to be recognisable to someone who can't read the current UI.
          supportingText={lang === "en" ? "English" : "Norsk"}
          onClick={() => onNavigate(["language"])}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          icon="bell"
          label={t(SETTINGS_SUBPAGE_TITLE_KEYS.varsler)}
          supportingText={t(subscribed ? "settings.root.notifications.on" : "settings.root.notifications.off")}
          onClick={() => onNavigate(["notifications"])}
        />
      </SettingsGroup>

      <SettingsGroup label={t("settings.root.group.household")}>
        <SettingsRow
          icon="house"
          label={t(SETTINGS_SUBPAGE_TITLE_KEYS.hjem)}
          supportingText={t("settings.root.household.supporting", { count: listUsers.length })}
          onClick={() => onNavigate(["household"])}
        />
        <SettingsRow
          icon="storefront"
          label={t(SETTINGS_SUBPAGE_TITLE_KEYS.butikk)}
          supportingText={t("settings.root.store.supporting")}
          onClick={() => onNavigate(["store"])}
        />
        {isAdmin && (
          <SettingsRow
            icon="shield-check"
            label={t(SETTINGS_SUBPAGE_TITLE_KEYS.admin)}
            supportingText={t("settings.root.admin.supporting")}
            onClick={() => onNavigate(["admin"])}
          />
        )}
      </SettingsGroup>

      <AboutFooter />
    </section>
  );
}
