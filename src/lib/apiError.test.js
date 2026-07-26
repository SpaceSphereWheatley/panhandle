import { describe, it, expect } from "vitest";
import { apiErrorMessage } from "./apiError.js";
import { translate } from "./i18n/translate.js";

const t = (lang) => (key, params) => translate(lang, key, params);

describe("apiErrorMessage", () => {
  it("translates a known code", () => {
    const res = { error: "Feil e-post eller passord", code: "BAD_CREDENTIALS" };
    expect(apiErrorMessage(res, t("en"))).toBe("Wrong email or password");
    expect(apiErrorMessage(res, t("nb"))).toBe("Feil e-post eller passord");
  });

  // A Worker deploy older than the error-code rollout still answers with just
  // `error`; showing its Norwegian wording beats showing nothing.
  it("falls back to the server string when there is no code", () => {
    expect(apiErrorMessage({ error: "Noe uventet" }, t("en"))).toBe("Noe uventet");
  });

  // Likewise for a code newer than this bundle — never surface a raw key.
  it("falls back to the server string for an unknown code", () => {
    const res = { error: "Noe helt nytt", code: "SOMETHING_NEW" };
    expect(apiErrorMessage(res, t("en"))).toBe("Noe helt nytt");
  });

  it("returns null when the body is not an error", () => {
    expect(apiErrorMessage({ ok: true }, t("en"))).toBe(null);
    expect(apiErrorMessage(null, t("en"))).toBe(null);
    expect(apiErrorMessage(undefined, t("en"))).toBe(null);
  });

  it("keeps a code with no matching string usable", () => {
    // Code present, `error` absent (a client constructing a partial body).
    expect(apiErrorMessage({ code: "NOT_FOUND" }, t("en"))).toBe("Not found");
  });
});
