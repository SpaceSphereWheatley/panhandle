import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { translate } from "../../lib/i18n/translate.js";

vi.mock("../../context/LanguageContext.jsx", () => ({
  useTranslation: () => (key, params) => translate("en", key, params),
}));

const { TokenInput } = await import("./TokenInput.jsx");

const SUGGESTIONS = ["Bacon", "Bread", "Coffee", "Milk"];

function Harness({ onKeyDownOutside }) {
  const [value, setValue] = useState([]);
  return (
    <div onKeyDown={onKeyDownOutside}>
      <TokenInput id="t" value={value} onChange={setValue} suggestions={SUGGESTIONS} />
      <div data-testid="tokens">{value.join(",")}</div>
    </div>
  );
}

const options = () => document.querySelectorAll(".token-dropdown-option");

// The dropdown floats over whatever sits below the field (a modal's Save
// button). These pin that it's only up while something is typed, so it can
// never sit on top of Save and swallow the tap meant for it.
describe("TokenInput suggestions dropdown", () => {
  it("stays closed on focus while nothing is typed", () => {
    render(<Harness />);
    fireEvent.focus(screen.getByRole("textbox"));
    expect(options().length).toBe(0);
  });

  it("shows matches while typing", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "b" } });
    expect([...options()].map((o) => o.textContent)).toEqual(["Bacon", "Bread"]);
  });

  it("closes once a token is committed with Enter", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Marshmallows" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("tokens").textContent).toBe("Marshmallows");
    expect(options().length).toBe(0);
  });

  it("closes once a suggestion is picked", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "cof" } });
    fireEvent.mouseDown(options()[0]);
    expect(screen.getByTestId("tokens").textContent).toBe("Coffee");
    expect(options().length).toBe(0);
  });

  it("Escape closes the dropdown without reaching the surrounding modal", () => {
    const outside = vi.fn();
    render(<Harness onKeyDownOutside={outside} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "b" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(options().length).toBe(0);
    expect(outside).not.toHaveBeenCalled();
  });
});
