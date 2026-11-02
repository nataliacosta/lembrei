import { useState } from "react";
import { Link } from "react-router-dom";
import NovaFrenteModal from "../components/NovaFrenteModal";
import { useDados } from "../contexts/DadosContext";

// Lista de frentes — no celular faz o papel do menu lateral.
export default function FrentesListPage() {
  const { frentes, contagemPorFrente } = useDados();
  const [mostrarNovaFrente, setMostrarNovaFrente] = useState(false);

  return (
    <div className="page-shell" style={{ paddingTop: 24, paddingBottom: 48, maxWidth: 820 }}>
      <h1 style={{ margin: "0 0 16px", fontSize: 24, fontWeight: 700 }}>Frentes</h1>
      <Link to="/buscar" className="so-mobile" style={{ marginBottom: 16 }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minHeight: 48,
            padding: "0 14px",
            borderRadius: 12,
            border: "1px solid var(--color-gray-light)",
            background: "var(--color-white)",
            color: "var(--color-gray)",
            fontSize: 15,
          }}
        >
          Buscar em todas as frentes…
        </span>
      </Link>

      {frentes.length === 0 ? (
        <div className="empty-state">Nenhuma frente ainda.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {frentes.map((f) => {
            const c = contagemPorFrente[f.id] || { abertos: 0, atrasados: 0 };
            return (
              <Link key={f.id} to={`/frentes/${f.id}`} className="lista-card" style={{ display: "block", padding: 14, color: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: f.cor, flex: "0 0 auto" }} />
                  <span style={{ flex: 1, fontSize: 16, fontWeight: 700 }}>{f.nome}</span>
                  <span aria-hidden="true" style={{ color: "var(--color-gray)" }}>›</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {c.atrasados > 0 && (
                    <span className="pill" style={{ background: "var(--color-orange-soft)", color: "var(--color-orange)", fontSize: 12 }}>
                      {c.atrasados} {c.atrasados === 1 ? "atrasado" : "atrasados"}
                    </span>
                  )}
                  <span className="pill" style={{ background: "#eceeee", color: "var(--color-dark)", fontSize: 12 }}>
                    {c.abertos} {c.abertos === 1 ? "aberto" : "abertos"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setMostrarNovaFrente(true)}
        style={{
          marginTop: 14,
          width: "100%",
          minHeight: 48,
          borderRadius: 12,
          border: "1px dashed #9aa5a4",
          background: "none",
          color: "var(--color-primary)",
          fontSize: 15,
          fontWeight: 700,
        }}
      >
        + Nova frente
      </button>
      {mostrarNovaFrente && <NovaFrenteModal onClose={() => setMostrarNovaFrente(false)} />}
    </div>
  );
}
