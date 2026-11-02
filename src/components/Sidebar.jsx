import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import NovaFrenteModal from "./NovaFrenteModal";
import { useAuth } from "../contexts/AuthContext";
import { watchFrentes } from "../lib/firestore";
import { watchContratos } from "../lib/contratos";
import { CONTRATO_STATUS } from "../lib/constants";

function lerPreferencia(chave, padrao) {
  try {
    const v = localStorage.getItem(chave);
    return v === null ? padrao : v === "true";
  } catch {
    return padrao;
  }
}

function salvarPreferencia(chave, valor) {
  try {
    localStorage.setItem(chave, String(valor));
  } catch {
    // localStorage pode estar bloqueado (modo privado etc.) — sem problema, só não persiste.
  }
}

export default function Sidebar() {
  const { user } = useAuth();
  const [frentes, setFrentes] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [mostrarNovaFrente, setMostrarNovaFrente] = useState(false);
  const [frentesAbertas, setFrentesAbertas] = useState(() => lerPreferencia("lembrei:sidebarFrentes", true));
  const [contratosAbertos, setContratosAbertos] = useState(() => lerPreferencia("lembrei:sidebarContratos", true));

  useEffect(() => {
    if (!user) return;
    const unsub = watchFrentes(user.uid, setFrentes);
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = watchContratos(user.uid, setContratos, () => {});
    return unsub;
  }, [user]);

  function alternarFrentes() {
    setFrentesAbertas((atual) => {
      const novo = !atual;
      salvarPreferencia("lembrei:sidebarFrentes", novo);
      return novo;
    });
  }

  function alternarContratos() {
    setContratosAbertos((atual) => {
      const novo = !atual;
      salvarPreferencia("lembrei:sidebarContratos", novo);
      return novo;
    });
  }

  if (!user) return null;

  return (
    <div className="dashboard-sidebar" style={{ background: "var(--color-dark)", padding: "24px 0" }}>
      <Link
        to="/dashboard"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 24px 20px 24px",
          marginBottom: 8,
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          borderBottom: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "0 0 auto" }}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        Painel geral
      </Link>

      <div style={{ marginTop: 20 }}>
        <SectionHeader aberto={frentesAbertas} onToggle={alternarFrentes}>
          Minhas frentes
        </SectionHeader>
        {frentesAbertas && (
          <>
            {frentes.length === 0 && (
              <div style={{ padding: "0 24px", color: "var(--color-gray-light)", fontSize: 13 }}>
                Nenhuma frente ainda.
              </div>
            )}
            {frentes.map((f) => (
              <Link
                key={f.id}
                to={`/frentes/${f.id}`}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 24px", color: "#fff", fontSize: 13 }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: f.cor, flex: "0 0 auto" }} />
                {f.nome}
              </Link>
            ))}
            <button
              onClick={() => setMostrarNovaFrente(true)}
              className="btn btn-primary"
              style={{ margin: "16px 24px 0 24px", fontSize: 13 }}
            >
              + Nova frente
            </button>
          </>
        )}
      </div>

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
        <SectionHeader aberto={contratosAbertos} onToggle={alternarContratos}>
          Contratos
        </SectionHeader>
        {contratosAbertos && (
          <>
            {contratos.length === 0 && (
              <div style={{ padding: "0 24px 8px 24px", color: "var(--color-gray-light)", fontSize: 13 }}>
                Nenhum contrato ainda.
              </div>
            )}
            {contratos.map((c) => (
              <Link
                key={c.id}
                to={`/contratos/${c.id}`}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 24px", color: "#fff", fontSize: 13 }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: (CONTRATO_STATUS[c.status] || CONTRATO_STATUS.ativo).cor,
                    flex: "0 0 auto",
                  }}
                />
                {c.titulo}
              </Link>
            ))}
            <Link
              to="/contratos"
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 24px", color: "#fff", fontSize: 13 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "0 0 auto" }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              Ver todos os contratos
            </Link>
            <Link to="/contratos/novo" className="btn btn-primary" style={{ margin: "12px 24px 0 24px", fontSize: 13 }}>
              + Novo contrato
            </Link>
          </>
        )}
      </div>

      {mostrarNovaFrente && <NovaFrenteModal onClose={() => setMostrarNovaFrente(false)} />}
    </div>
  );
}

function SectionHeader({ children, aberto, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: "0 24px 12px 24px",
        background: "none",
        border: "none",
        color: "var(--color-gray-light)",
        fontSize: 12,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        cursor: "pointer",
      }}
    >
      {children}
      <span style={{ fontSize: 10, transition: "transform 0.15s", transform: aberto ? "rotate(0deg)" : "rotate(-90deg)" }}>
        ▾
      </span>
    </button>
  );
}
