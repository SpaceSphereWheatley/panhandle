import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Sheet } from "./Sheet.jsx";

// Regression test for a bug where clicking outside a modal did nothing on
// desktop (only Escape closed it): focus-trap-react's default
// allowOutsideClick (false) preventDefault+stops propagation on any click
// outside the trapped element, which ate the click before Sheet's own
// backdrop onClick handler below ever saw it.
describe("Sheet", () => {
  it("closes when the backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Sheet open onClose={onClose} title="Test">
        <button>Focusable content</button>
      </Sheet>
    );
    const backdrop = container.firstChild;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when the dialog content is clicked", () => {
    const onClose = vi.fn();
    const { getByRole } = render(
      <Sheet open onClose={onClose} title="Test">
        <button>Focusable content</button>
      </Sheet>
    );
    fireEvent.click(getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
