import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "./AuthContext.jsx";

const ListUsersContext = createContext(null);

// Members of the current list — drives both the meal-responsible dropdown and
// the owner's "Brukere på listen" panel. Loaded once on login, refreshed
// after membership/flag mutations.
export function ListUsersProvider({ children }) {
  const { token } = useAuth();
  const [listUsers, setListUsers] = useState([]);

  const refresh = useCallback(async () => {
    try {
      setListUsers(await api("/list-users"));
    } catch {
      /* non-critical, keep whatever we had */
    }
  }, []);

  useEffect(() => {
    if (token) refresh();
    else setListUsers([]);
  }, [token, refresh]);

  const people = listUsers.map((u) => u.username);

  return (
    <ListUsersContext.Provider value={{ listUsers, people, refresh }}>
      {children}
    </ListUsersContext.Provider>
  );
}

export function useListUsers() {
  const ctx = useContext(ListUsersContext);
  if (!ctx) throw new Error("useListUsers must be used within ListUsersProvider");
  return ctx;
}
