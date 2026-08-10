import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useShoppingList } from "./useShoppingList.js";
import { ToastProvider } from "../context/ToastContext.jsx";
import { LanguageProvider } from "../context/LanguageContext.jsx";
import { enqueue, queueLength } from "../lib/writeQueue.js";

vi.mock("../lib/api.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, api: vi.fn() };
});
import { api } from "../lib/api.js";

// Mimics api.js's throw contract (see writeQueue.test.js's identical helper):
// a rejected fetch surfaces as Error("network"); everything else resolves.
function networkError() {
  return new Error("network");
}

function TestConsumer({ active, onSyncTick, onOffline }) {
  const { items, loading, pendingWrites, loadList } = useShoppingList({ active, onSyncTick, onOffline });
  return (
    <div>
      <div data-testid="items">{JSON.stringify(items)}</div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="pending">{pendingWrites}</div>
      <button onClick={() => loadList()}>reload</button>
    </div>
  );
}

function renderHookUnderTest(props) {
  const onSyncTick = vi.fn();
  const onOffline = vi.fn();
  render(
    <LanguageProvider>
      <ToastProvider>
        <TestConsumer active onSyncTick={onSyncTick} onOffline={onOffline} {...props} />
      </ToastProvider>
    </LanguageProvider>
  );
  return { onSyncTick, onOffline };
}

describe("useShoppingList", () => {
  beforeEach(() => {
    localStorage.clear();
    api.mockReset();
  });

  it("flushes the write queue before fetching /list, every call", async () => {
    enqueue({ kind: "toggle", targetId: 5 });
    const calls = [];
    api.mockImplementation(async (path) => {
      calls.push(path);
      if (path === "/list/5/toggle") return { ok: true };
      if (path === "/list") return [];
      if (path === "/catalogue" || path === "/catalogue/suggestions") return [];
      if (path === "/presence") return [];
      return {};
    });

    renderHookUnderTest();

    await waitFor(() => expect(calls).toContain("/list"));
    const toggleIdx = calls.indexOf("/list/5/toggle");
    const listIdx = calls.indexOf("/list");
    expect(toggleIdx).toBeGreaterThan(-1);
    expect(toggleIdx).toBeLessThan(listIdx);
  });

  it("a stuck queue leaves items untouched, calls onOffline, and never fetches /list", async () => {
    enqueue({ kind: "toggle", targetId: 5 });
    api.mockImplementation(async (path) => {
      if (path === "/catalogue" || path === "/notification-settings") return {};
      throw networkError();
    });

    const { onOffline } = renderHookUnderTest();

    await waitFor(() => expect(onOffline).toHaveBeenCalled());
    expect(screen.getByTestId("items").textContent).toBe("[]");
    expect(api).not.toHaveBeenCalledWith("/list", expect.anything());
    expect(api.mock.calls.some((c) => c[0] === "/list")).toBe(false);
  });

  it("a failed /list fetch leaves items untouched and calls onOffline, not onSyncTick", async () => {
    api.mockImplementation(async (path) => {
      if (path === "/catalogue") return [];
      if (path === "/list") throw networkError();
      return [];
    });

    const { onOffline, onSyncTick } = renderHookUnderTest();

    await waitFor(() => expect(onOffline).toHaveBeenCalled());
    expect(screen.getByTestId("items").textContent).toBe("[]");
    expect(onSyncTick).not.toHaveBeenCalled();
  });

  it("a successful fetch updates items; suggestions/presence fail and succeed independently", async () => {
    const fixture = [{ id: 1, name: "Melk" }];
    api.mockImplementation(async (path) => {
      if (path === "/catalogue") return [];
      if (path === "/list") return fixture;
      if (path === "/catalogue/suggestions") throw new Error("boom");
      if (path === "/presence") return ["alice"];
      return {};
    });

    const { onSyncTick } = renderHookUnderTest();

    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe(JSON.stringify(fixture)));
    // onSyncTick fires right after /list, unaffected by suggestions failing.
    expect(onSyncTick).toHaveBeenCalledTimes(1);
  });

  it("pendingWrites reflects queueLength() after a flush attempt, drained or not", async () => {
    enqueue({ kind: "toggle", targetId: 5 });
    expect(queueLength()).toBe(1);

    api.mockImplementation(async (path) => {
      if (path === "/catalogue") return [];
      if (path === "/list/5/toggle") return { ok: true };
      if (path === "/list") return [];
      return [];
    });

    renderHookUnderTest();

    await waitFor(() => expect(screen.getByTestId("pending").textContent).toBe("0"));
    expect(queueLength()).toBe(0);
  });

  it("pendingWrites stays nonzero when the flush can't drain the queue", async () => {
    enqueue({ kind: "toggle", targetId: 5 });
    api.mockImplementation(async (path) => {
      if (path === "/catalogue" || path === "/notification-settings") return {};
      throw networkError();
    });

    renderHookUnderTest();

    await waitFor(() => expect(screen.getByTestId("pending").textContent).toBe("1"));
  });

  it("clicking reload replays the queue-before-fetch ordering again on demand", async () => {
    api.mockImplementation(async (path) => {
      if (path === "/catalogue") return [];
      if (path === "/list") return [];
      return [];
    });
    renderHookUnderTest();
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    enqueue({ kind: "toggle", targetId: 9 });
    const calls = [];
    api.mockImplementation(async (path) => {
      calls.push(path);
      if (path === "/list/9/toggle") return { ok: true };
      return [];
    });

    fireEvent.click(screen.getByText("reload"));

    await waitFor(() => expect(calls).toContain("/list"));
    expect(calls.indexOf("/list/9/toggle")).toBeLessThan(calls.indexOf("/list"));
  });
});
