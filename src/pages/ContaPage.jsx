import { useAuth } from "../contexts/AuthContext";
import { iniciais } from "../components/TopBar";

export default function ContaPage() {
  const { user, signOut } = useAuth();
  return (
    <div className="page-shell" style={{ paddingTop: 24, paddingBottom: 48, maxWidth: 640 }}>
      <h1 style={{ margin: "0 0 16px", fontSize: 24, fontWeight: 700 }}>Conta</h1>
      <div className="lista-card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <span className="avatar" style={{ width: 44, height: 44, fontSize: 15 }}>
          {iniciais(user?.displayName || user?.email)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{user?.displayName || "—"}</div>
          <div style={{ fontSize: 13, color: "var(--color-gray)", overflowWrap: "anywhere" }}>{user?.email}</div>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--color-gray)", lineHeight: 1.5 }}>
        Dica: no celular, use “Adicionar à tela inicial” no navegador para abrir o Lembrei! como um app.
      </p>
      <button type="button" onClick={signOut} className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }}>
        Sair
      </button>
    </div>
  );
}
