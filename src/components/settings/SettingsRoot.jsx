import { useAuth } from "../../context/AuthContext.jsx";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { usePush } from "../../context/PushContext.jsx";
import { useLanguage, useTranslation } from "../../context/LanguageContext.jsx";
import { settingsTitleKey } from "../../lib/settingsNav.js";
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
//
// Each row's destination is declared once below and drives both the label and
// onNavigate via settingsTitleKey — see settingsNav.js for why.
const PATHS = {
  appearance: ["appearance"],
  account: ["account"],
  language: ["language"],
  notifications: ["notifications"],
  members: ["members"],
  dinnerDuty: ["dinner-duty"],
  store: ["store"],
  admin: ["admin"],
  calendarSync: ["calendar-sync"],
};

export function SettingsRoot({ onNavigate }) {
  const { user, name, isAdmin, isOwner } = useAuth();
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
          label={t(settingsTitleKey(PATHS.appearance))}
          supportingText={t("settings.root.appearance.supporting")}
          onClick={() => onNavigate(PATHS.appearance)}
        />
        <SettingsRow
          icon="user-circle"
          label={t(settingsTitleKey(PATHS.account))}
          supportingText={name || user}
          onClick={() => onNavigate(PATHS.account)}
        />
        <SettingsRow
          icon="translate"
          label={t(settingsTitleKey(PATHS.language))}
          // Each language's own endonym, never translated — the point of this
          // row is to be recognisable to someone who can't read the current UI.
          supportingText={lang === "en" ? "English" : "Norsk"}
          onClick={() => onNavigate(PATHS.language)}
        />
        <SettingsRow
          icon="calendar-plus"
          label={t(settingsTitleKey(PATHS.calendarSync))}
          supportingText={t("settings.root.calendarSync.supporting")}
          onClick={() => onNavigate(PATHS.calendarSync)}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          icon="bell"
          label={t(settingsTitleKey(PATHS.notifications))}
          supportingText={t(subscribed ? "settings.root.notifications.on" : "settings.root.notifications.off")}
          onClick={() => onNavigate(PATHS.notifications)}
        />
      </SettingsGroup>

      <SettingsGroup label={t("settings.root.group.household")}>
        {/* Owners only — adding/removing members is the whole page, and both
            /list-users writes are owner-gated server-side. Members and dinner
            duty used to share one "Vårt hjem" row whose "x / 10 members"
            subtitle led a plain member straight to the dinner schedule. */}
        {isOwner && (
          <SettingsRow
            icon="users"
            label={t(settingsTitleKey(PATHS.members))}
            supportingText={t("settings.root.members.supporting", { count: listUsers.length })}
            onClick={() => onNavigate(PATHS.members)}
          />
        )}
        <SettingsRow
          icon="calendar-check"
          label={t(settingsTitleKey(PATHS.dinnerDuty))}
          supportingText={t("settings.root.dinnerDuty.supporting")}
          onClick={() => onNavigate(PATHS.dinnerDuty)}
        />
        <SettingsRow
          icon="storefront"
          label={t(settingsTitleKey(PATHS.store))}
          supportingText={t("settings.root.store.supporting")}
          onClick={() => onNavigate(PATHS.store)}
        />
        {isAdmin && (
          <SettingsRow
            icon="shield-check"
            label={t(settingsTitleKey(PATHS.admin))}
            supportingText={t("settings.root.admin.supporting")}
            onClick={() => onNavigate(PATHS.admin)}
          />
        )}
      </SettingsGroup>

      <AboutFooter />
    </section>
  );
}
