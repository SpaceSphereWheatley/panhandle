import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { translate } from "../../lib/i18n/translate.js";

// The chrome around the rows pulls in the install prompt, the changelog and
// feedback modals, and an SVG asset — none of which this spec is about.
vi.mock("./PwaInstallCTA.jsx", () => ({ PwaInstallCTA: () => null }));
vi.mock("./AboutFooter.jsx", () => ({ AboutFooter: () => null }));

const auth = { user: "ola@example.com", name: "Ola", isAdmin: false, isOwner: false };
const listUsers = { listUsers: [{ username: "ola@example.com" }, { username: "kari@example.com" }] };

vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => auth }));
vi.mock("../../context/ListUsersContext.jsx", () => ({ useListUsers: () => listUsers }));
vi.mock("../../context/PushContext.jsx", () => ({ usePush: () => ({ subscribed: false }) }));
vi.mock("../../context/LanguageContext.jsx", () => ({
  useLanguage: () => ({ lang: "en" }),
  useTranslation: () => (key, params) => translate("en", key, params),
}));

const { SettingsRoot } = await import("./SettingsRoot.jsx");

function renderRoot(overrides = {}) {
  Object.assign(auth, { user: "ola@example.com", name: "Ola", isAdmin: false, isOwner: false }, overrides);
  return render(<SettingsRoot onNavigate={() => {}} />);
}

// A row's headline and its supporting text are the only text-only divs inside
// the row <button>, in that order (see SettingsRow.jsx).
function rowLabels(container) {
  return [...container.querySelectorAll("button")].map((b) => {
    const leaf = [...b.querySelectorAll("div")].find((d) => d.children.length === 0);
    return leaf?.textContent ?? "";
  });
}

describe("SettingsRoot", () => {
  // The regression this guards: SettingsRoot indexed the title registry with
  // stale Norwegian property names after the English-first restructure, so
  // six of seven rows rendered a blank headline (translate() hands back the
  // undefined key, which React renders as nothing). Nothing failed the build.
  it("renders a real label on every row", () => {
    const { container } = renderRoot({ isAdmin: true, isOwner: true });
    const labels = rowLabels(container);
    expect(labels).toEqual([
      "Appearance",
      "Account",
      "Language",
      "Notifications",
      "Household members",
      "Dinner duty",
      "Store layout",
      "Administration",
    ]);
    for (const label of labels) {
      expect(label).not.toBe("");
      // A missing key comes back verbatim, e.g. "settings.nav.account".
      expect(label).not.toMatch(/^settings\./);
    }
  });

  it("shows the household rows a plain member can actually use", () => {
    renderRoot();
    expect(screen.queryByText("Household members")).toBeNull();
    expect(screen.queryByText("Administration")).toBeNull();
    expect(screen.getByText("Dinner duty")).toBeTruthy();
    expect(screen.getByText("Store layout")).toBeTruthy();
  });

  it("shows the members row to an owner, with the member count", () => {
    renderRoot({ isOwner: true });
    expect(screen.getByText("Household members")).toBeTruthy();
    expect(screen.getByText("2 / 10 members")).toBeTruthy();
  });

  it("shows the administration row only to an admin", () => {
    renderRoot({ isAdmin: true });
    expect(screen.getByText("Administration")).toBeTruthy();
  });

  it("navigates to the path its label was resolved from", () => {
    const onNavigate = vi.fn();
    Object.assign(auth, { isAdmin: false, isOwner: false });
    render(<SettingsRoot onNavigate={onNavigate} />);
    screen.getByText("Dinner duty").closest("button").click();
    expect(onNavigate).toHaveBeenCalledWith(["dinner-duty"]);
  });
});
