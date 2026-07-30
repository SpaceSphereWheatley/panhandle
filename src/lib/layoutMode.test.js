import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DESKTOP_MIN_WIDTH, DESKTOP_QUERY, layoutModeForWidth } from "./layoutMode.js";

describe("layoutMode", () => {
  it("switches to desktop at exactly the breakpoint, not before", () => {
    expect(layoutModeForWidth(0)).toBe("compact");
    expect(layoutModeForWidth(DESKTOP_MIN_WIDTH - 1)).toBe("compact");
    expect(layoutModeForWidth(DESKTOP_MIN_WIDTH)).toBe("desktop");
    expect(layoutModeForWidth(DESKTOP_MIN_WIDTH + 1)).toBe("desktop");
  });

  // The media-query string and the number are used by different halves of the
  // app (matchMedia vs. the pure helper). Assert they're derived from the same
  // constant so an edit to one can't silently leave the other behind.
  it("derives its media query from the same constant", () => {
    expect(DESKTOP_QUERY).toBe(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
  });

  // Guards the documented fallback: with no matchMedia (jsdom, ancient
  // browsers) the app must land on the phone layout, never the desktop one.
  it("falls back to compact without matchMedia", async () => {
    const { currentLayoutMode } = await import("./layoutMode.js");
    expect(currentLayoutMode()).toBe("compact");
  });
});

// jsdom does implement matchMedia here (unlike the suite above, which relies
// on the environment omitting it entirely) so these can drive it directly.
describe("layoutMode override", () => {
  const originalMatchMedia = window.matchMedia;

  function stubMatchMedia(matches) {
    window.matchMedia = (query) => ({
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
  }

  beforeEach(() => {
    localStorage.removeItem("ph_layout_override");
  });

  afterEach(() => {
    localStorage.removeItem("ph_layout_override");
    window.matchMedia = originalMatchMedia;
  });

  it("viewportLayoutMode ignores the override; currentLayoutMode honors it", async () => {
    stubMatchMedia(true); // viewport is desktop-width
    const { currentLayoutMode, viewportLayoutMode, setLayoutOverride } = await import("./layoutMode.js");

    expect(viewportLayoutMode()).toBe("desktop");
    expect(currentLayoutMode()).toBe("desktop");

    setLayoutOverride("compact");
    expect(viewportLayoutMode()).toBe("desktop");
    expect(currentLayoutMode()).toBe("compact");

    setLayoutOverride(null);
    expect(currentLayoutMode()).toBe("desktop");
  });

  it("persists the override across reads", async () => {
    stubMatchMedia(true);
    const { layoutOverride, setLayoutOverride } = await import("./layoutMode.js");

    expect(layoutOverride()).toBe(null);
    setLayoutOverride("compact");
    expect(layoutOverride()).toBe("compact");
    expect(localStorage.getItem("ph_layout_override")).toBe("compact");
  });
});
