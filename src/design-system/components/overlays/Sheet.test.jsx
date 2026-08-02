import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { render, fireEvent, act } from "@testing-library/react";
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

// Mirrors how Modal.jsx drives Sheet: `open` flips false the instant a close
// is requested, but the caller (here, `onExited`) shouldn't be told it's
// safe to unmount until the dismissal animation has actually finished.
function ControlledSheet({ onExited }) {
  const [open, setOpen] = useState(true);
  return (
    <Sheet open={open} onClose={() => setOpen(false)} onExited={onExited} title="Test">
      <button>Focusable content</button>
    </Sheet>
  );
}

describe("Sheet dismissal animation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays in the DOM and doesn't call onExited the instant a close is requested", () => {
    const onExited = vi.fn();
    const { container, getByRole } = render(<ControlledSheet onExited={onExited} />);
    fireEvent.click(container.firstChild);
    expect(getByRole("dialog")).toBeInTheDocument();
    expect(onExited).not.toHaveBeenCalled();
  });

  // jsdom doesn't implement the AnimationEvent constructor at all (a known,
  // documented gap — it doesn't run CSS animations), so the primary
  // onAnimationEnd completion path can't be driven from this suite; it's
  // exercised manually in a real browser instead. The fallback timer below
  // is what this suite can verify end-to-end.
  it("falls back to calling onExited if onAnimationEnd never fires", () => {
    vi.useFakeTimers();
    const onExited = vi.fn();
    const { container } = render(<ControlledSheet onExited={onExited} />);
    act(() => {
      fireEvent.click(container.firstChild);
    });
    expect(onExited).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onExited).toHaveBeenCalledTimes(1);
  });
});
