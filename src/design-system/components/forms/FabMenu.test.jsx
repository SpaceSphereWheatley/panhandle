import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { FabMenu } from "./FabMenu.jsx";

// Regression test for a bug where tapping outside an open FabMenu did
// nothing (only Escape closed it): focus-trap-react's default
// allowOutsideClick (false) preventDefault+stops propagation on any click
// outside the trapped element, which ate the click before the scrim's own
// onClick handler ever saw it — the same bug already fixed for Sheet.jsx.
describe("FabMenu", () => {
  it("closes when the scrim is clicked outside the menu", () => {
    const onClick = vi.fn();
    const { getByLabelText, getByRole, container } = render(
      <FabMenu label="Legg til" actions={[{ icon: "plus", label: "Legg til vare", onClick }]} />
    );

    fireEvent.click(getByLabelText("Legg til"));
    const action = getByRole("menuitem", { name: "Legg til vare" });
    expect(action.tabIndex).toBe(0);

    const scrim = container.firstChild;
    fireEvent.click(scrim);

    expect(action.tabIndex).toBe(-1);
  });
});
