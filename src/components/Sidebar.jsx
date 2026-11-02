import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import NovaFrenteModal from "./NovaFrenteModal";
import { useAuth } from "../contexts/AuthContext";
import { useDados } from "../contexts/DadosContext";
import { CONTRATO_STATUS } from "../lib/constants";
import { situacaoDoContrato } from "../lib/agenda";
import { IconeFila, IconeLista } from "./Icones";

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
  const { frentes, contratos, contagemPorFrente, minhaFila, minhasDemandas } = useDados();
  const naFila = minhaFila ? minhasDemandas.filter((d) => !d.concluida).length : 0;
  const [mostrarNovaFrente, setMostrarNovaFrente] = useState(false);
  const [frentesAbertas, setFrentesAbertas] = useState(() => lerPreferencia("lembrei:sidebarFrentes", true));
  const [contratosAbertos, setContratosAbertos] = useState(() => lerPreferencia("lembrei:sidebarContratos", true));

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

  const totalAtrasados = Object.values(contagemPorFrente).reduce((soma, c) => soma + c.atrasados, 0);
  const classeLink = ({ isActive }) => (isActive ? "sidebar-link-ativo" : "");

  return (
    <div className="dashboard-sidebar" style={{ background: "var(--color-dark)", padding: "24px 0" }}>
      <NavLink
        to="/dashboard"
        className={classeLink}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 24px",
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        <IconeLista size={16} />
        O que fazer
        {totalAtrasados > 0 && (
          <span className="sidebar-badge alerta" title={`${totalAtrasados} atrasados`}>
            {totalAtrasados}
          </span>
        )}
      </NavLink>
      <NavLink
        to="/demandas"
        className={classeLink}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 24px", color: "#fff", fontSize: 14, fontWeight: 700 }}
      >
        <IconeFila size={16} />
        Demandas
        {naFila > 0 && (
          <span className="sidebar-badge" title={`${naFila} na fila`}>
            {naFila}
          </span>
        )}
      </NavLink>

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
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
            {frentes.map((f) => {
              const contagem = contagemPorFrente[f.id];
              return (
                <NavLink
                  key={f.id}
                  to={`/frentes/${f.id}`}
                  className={classeLink}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 24px", color: "#fff", fontSize: 13 }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: f.cor, flex: "0 0 auto" }} />
                  {f.nome}
                  {contagem?.atrasados > 0 ? (
                    <span className="sidebar-badge alerta" title={`${contagem.atrasados} atrasados`}>
                      {contagem.atrasados}
                    </span>
                  ) : contagem?.abertos > 0 ? (
                    <span className="sidebar-badge" title={`${contagem.abertos} abertos`}>
                      {contagem.abertos}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
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
              <NavLink
                key={c.id}
                to={`/contratos/${c.id}`}
                className={classeLink}
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
                {situacaoDoContrato(c) === "atencao" && (
                  <span className="sidebar-badge alerta" title="Pede atenção (vencimento)">
                    !
                  </span>
                )}
              </NavLink>
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
