import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ListUsersProvider, useListUsers } from "./ListUsersContext.jsx";

const mockUseAuth = vi.fn();
vi.mock("./AuthContext.jsx", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockApi = vi.fn();
vi.mock("../lib/api.js", () => ({
  api: (...args) => mockApi(...args),
}));

function TestConsumer() {
  const { listUsers, people } = useListUsers();
  return (
    <div>
      <div data-testid="count">{listUsers.length}</div>
      <div data-testid="people">{people.join(",")}</div>
    </div>
  );
}

describe("ListUsersContext", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockApi.mockReset();
  });

  it("fetches /list-users when a token is present and derives people from it", async () => {
    mockUseAuth.mockReturnValue({ token: "tok" });
    mockApi.mockResolvedValue([{ username: "alice" }, { username: "bob" }]);

    render(
      <ListUsersProvider>
        <TestConsumer />
      </ListUsersProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("2"));
    expect(screen.getByTestId("people").textContent).toBe("alice,bob");
    expect(mockApi).toHaveBeenCalledWith("/list-users");
  });

  it("does not fetch and clears listUsers when there is no token", () => {
    mockUseAuth.mockReturnValue({ token: null });
    render(
      <ListUsersProvider>
        <TestConsumer />
      </ListUsersProvider>
    );
    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("degrades gracefully on a failed fetch instead of throwing", async () => {
    mockUseAuth.mockReturnValue({ token: "tok" });
    mockApi.mockRejectedValue(new Error("network"));

    render(
      <ListUsersProvider>
        <TestConsumer />
      </ListUsersProvider>
    );

    await waitFor(() => expect(mockApi).toHaveBeenCalled());
    expect(screen.getByTestId("count").textContent).toBe("0");
  });
});
