import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "./AuthContext.jsx";

const PushContext = createContext(null);

// applicationServerKey must be raw bytes, not the base64url string the
// backend hands back.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Web Push subscribe/unsubscribe state (TODO #7 phase 1). `subscribed`
// tracks whether this device currently holds an active PushSubscription
// synced to the server — separate from Notification.permission itself (a
// user can grant permission once and still be unsubscribed if they later
// toggle the setting off).
export function PushProvider({ children }) {
  const { token } = useAuth();
  const [supported] = useState(
    () => typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
  );
  const [permission, setPermission] = useState(
    () => (typeof Notification !== "undefined" ? Notification.permission : "denied")
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Re-syncs the browser's current subscription (if any) to the server on
  // every mount/token change. This is also how a subscription that the
  // browser silently rotated while no tab was open (see sw.js's
  // `pushsubscriptionchange`, which only keeps the browser-level
  // registration alive, not the server-side row — a service worker has no
  // way to attach this app's auth token to a request) gets its new endpoint
  // picked up: next time the app is opened, this effect re-POSTs it. The
  // upsert-by-endpoint design (see migrations/0012) makes this a harmless
  // no-op when nothing changed.
  const refresh = useCallback(async () => {
    if (!supported) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
      if (sub) await api("/push/subscribe", { method: "POST", body: JSON.stringify(sub.toJSON()) });
    } catch {
      /* non-critical, keep whatever we had */
    }
  }, [supported]);

  useEffect(() => {
    if (token) refresh();
    else setSubscribed(false);
  }, [token, refresh]);

  const subscribe = useCallback(async () => {
    if (!supported) return { error: "Nettleseren støtter ikke push-varsler" };
    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return { error: "Tillatelse til varsler ble ikke gitt" };

      const { publicKey } = await api("/push/vapid-public-key");
      if (!publicKey) return { error: "Push-varsler er ikke satt opp på serveren ennå" };

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await api("/push/subscribe", { method: "POST", body: JSON.stringify(sub.toJSON()) });
      setSubscribed(true);
      return { error: null };
    } catch {
      return { error: "Kunne ikke aktivere varsler" };
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api("/push/subscribe", { method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return (
    <PushContext.Provider value={{ supported, permission, subscribed, loading, subscribe, unsubscribe }}>
      {children}
    </PushContext.Provider>
  );
}

export function usePush() {
  const ctx = useContext(PushContext);
  if (!ctx) throw new Error("usePush must be used within PushProvider");
  return ctx;
}
