import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [erro, setErro] = useState("");

  if (loading) return <div className="spinner-wrap">Carregando...</div>;
  if (user) return <Navigate to="/dashboard" replace />;

  async function entrar() {
    try {
      setErro("");
      await signInWithGoogle();
    } catch (e) {
      setErro("Não foi possível entrar. Tente novamente.");
      console.error(e);
    }
  }

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", flexWrap: "wrap" }}>
      <div
        style={{
          flex: "1 1 420px",
          minWidth: 320,
          background: "var(--color-brand)",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: "var(--color-dark)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "var(--color-accent)", fontWeight: 700, fontSize: 18 }}>L</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 20 }}>Lembrei!</span>
        </div>
        <div style={{ maxWidth: 420 }}>
          <div style={{ width: 40, height: 4, background: "var(--color-accent)", borderRadius: 2, marginBottom: 24 }} />
          <h1 style={{ margin: "0 0 16px 0", fontSize: 34, lineHeight: 1.25, fontWeight: 700 }}>
            Nunca mais perca o fio da meada.
          </h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "var(--color-gray-light)" }}>
            Cadastre suas frentes, acompanhe tarefas, cobranças e consultas em um só lugar — e seja lembrado de
            voltar a cada assunto no momento certo.
          </p>
        </div>
        <div style={{ fontSize: 13, color: "var(--color-gray-light)" }}>© 2026 Lembrei!</div>
      </div>

      <div
        style={{
          flex: "1 1 480px",
          minWidth: 320,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 56,
        }}
      >
        <div style={{ width: "100%", maxWidth: 380 }}>
          <h2 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 700 }}>Entrar na sua conta</h2>
          <p style={{ margin: "0 0 32px 0", fontSize: 14, color: "var(--color-gray)" }}>
            Acesse suas frentes e continue de onde parou.
          </p>

          <button
            onClick={entrar}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: "12px 16px",
              border: "1px solid var(--color-gray-light)",
              borderRadius: 8,
              background: "#fff",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "var(--color-dark)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              G
            </span>
            Continuar com Google
          </button>

          {erro && <p style={{ color: "var(--color-orange)", fontSize: 13, marginTop: 12 }}>{erro}</p>}
        </div>
      </div>
    </div>
  );
}
