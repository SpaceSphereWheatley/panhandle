import { useAuth } from "../context/AuthContext.jsx";

export function SettingsTabStub() {
  const { user, logout } = useAuth();
  return (
    <section>
      <div className="setrow">
        <div className="k">Innlogget som</div>
        <div className="v">{user}</div>
      </div>
      <div className="empty-state">
        Resten av Innstillinger (profil, medlemmer, administrasjon) er ikke
        portert til React ennå.
      </div>
      <button className="logout" onClick={() => logout()}>Logg ut</button>
    </section>
  );
}
