import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, rawLogin, configureApi } from "./api.js";

function mockResponse({ status = 200, body = {}, headers = {} } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name] ?? null },
    json: async () => body,
  };
}

describe("api()", () => {
  let getToken, onRefresh, onUnauthorized;

  beforeEach(() => {
    getToken = vi.fn(() => "current-token");
    onRefresh = vi.fn();
    onUnauthorized = vi.fn();
    configureApi({ getToken, onRefresh, onUnauthorized });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches an Authorization header built from getToken()", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ body: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    await api("/list");

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers.Authorization).toBe("Bearer current-token");
  });

  it("calls onUnauthorized and throws 'unauth' on a 401 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ status: 401 })));
    await expect(api("/list")).rejects.toThrow("unauth");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("throws 'network' when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    await expect(api("/list")).rejects.toThrow("network");
  });

  it("calls onRefresh when X-Refresh-Token differs from the current token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      mockResponse({ headers: { "X-Refresh-Token": "new-token" } })
    ));
    await api("/list");
    expect(onRefresh).toHaveBeenCalledWith("new-token");
  });

  it("does not call onRefresh for /change-password, even if X-Refresh-Token is present", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      mockResponse({ headers: { "X-Refresh-Token": "new-token" } })
    ));
    await api("/change-password", { method: "POST" });
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("does not call onRefresh when the refreshed token equals the current token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      mockResponse({ headers: { "X-Refresh-Token": "current-token" } })
    ));
    await api("/list");
    expect(onRefresh).not.toHaveBeenCalled();
  });
});

describe("rawLogin", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns {ok:true, data} on a successful login", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ status: 200, body: { token: "t" } })));
    expect(await rawLogin("alice", "pw")).toEqual({ ok: true, data: { token: "t" } });
  });

  it("returns {ok:false, data} on a failed login", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ status: 401, body: { error: "Feil" } })));
    expect(await rawLogin("alice", "wrong")).toEqual({ ok: false, data: { error: "Feil" } });
  });
});
