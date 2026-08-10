import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useOfflineQueue } from "./useOfflineQueue.js";
import { AuthProvider } from "../context/AuthContext.jsx";
import { loadQueue } from "../lib/writeQueue.js";

function TestConsumer({ setItems, refreshPendingWrites }) {
  const { queueOfflineAdd, enqueueToggle, enqueueImportant } = useOfflineQueue(setItems, refreshPendingWrites);
  return (
    <div>
      <button onClick={() => queueOfflineAdd({ name: "melk", category: "Dairy", notes: null, qty: 2, exact: false })}>
        add
      </button>
      <button onClick={() => queueOfflineAdd({ name: "Milk", category: "Dairy", notes: null, qty: 1, exact: true })}>
        add-exact
      </button>
      <button onClick={() => enqueueToggle(5)}>toggle</button>
      <button onClick={() => enqueueImportant(5, true)}>important</button>
    </div>
  );
}

function renderHookUnderTest(overrides = {}) {
  const setItems = vi.fn();
  const refreshPendingWrites = vi.fn();
  render(
    <AuthProvider>
      <TestConsumer setItems={setItems} refreshPendingWrites={refreshPendingWrites} {...overrides} />
    </AuthProvider>
  );
  return { setItems, refreshPendingWrites };
}

describe("useOfflineQueue", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ph_user", "alice");
  });

  it("queueOfflineAdd enqueues an 'add' op and pushes a matching optimistic row", () => {
    const { setItems, refreshPendingWrites } = renderHookUnderTest();

    fireEvent.click(screen.getByText("add"));

    const q = loadQueue();
    expect(q).toHaveLength(1);
    expect(q[0].kind).toBe("add");
    expect(q[0].body).toEqual({ name: "melk", qty: 2, category: "Dairy", notes: null, exact: false });
    expect(q[0].tempId).toBeTruthy();

    expect(setItems).toHaveBeenCalledTimes(1);
    const updater = setItems.mock.calls[0][0];
    const result = updater([]);
    expect(result).toHaveLength(1);
    // Non-exact names are capitalized to mirror the server, same as the
    // catalogue-matched add path.
    expect(result[0]).toMatchObject({
      id: q[0].tempId,
      bought: 0,
      important: 0,
      added_by: "alice",
      qty: 2,
      notes: null,
      name: "Melk",
      category: "Dairy",
    });

    expect(refreshPendingWrites).toHaveBeenCalledTimes(1);
  });

  it("queueOfflineAdd keeps an exact name as typed, not capitalized", () => {
    const { setItems } = renderHookUnderTest();

    fireEvent.click(screen.getByText("add-exact"));

    const updater = setItems.mock.calls[0][0];
    const result = updater([]);
    expect(result[0].name).toBe("Milk");
  });

  it("enqueueToggle enqueues a 'toggle' op and refreshes pending writes", () => {
    const { refreshPendingWrites } = renderHookUnderTest();

    fireEvent.click(screen.getByText("toggle"));

    const q = loadQueue();
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ kind: "toggle", targetId: 5 });
    expect(refreshPendingWrites).toHaveBeenCalledTimes(1);
  });

  it("enqueueImportant enqueues an 'important' op with the target value and refreshes pending writes", () => {
    const { refreshPendingWrites } = renderHookUnderTest();

    fireEvent.click(screen.getByText("important"));

    const q = loadQueue();
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ kind: "important", targetId: 5, important: true });
    expect(refreshPendingWrites).toHaveBeenCalledTimes(1);
  });
});
