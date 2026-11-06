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
  const { frentes, contratos, contagemPorFrente, minhaFila, minhasDemandas, funcionalidades } = useDados();
  const naFila = minhaFila ? minhasDemandas.filter((d) => !d.concluida && (minhaFila.ordem || []).includes(d.id)).length : 0;
  const aguardandoPriorizacao = minhaFila ? minhasDemandas.filter((d) => !d.concluida && !(minhaFila.ordem || []).includes(d.id)).length : 0;
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
      {funcionalidades.demandas && (
      <NavLink
        to="/demandas"
        className={classeLink}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 24px", color: "#fff", fontSize: 14, fontWeight: 700 }}
      >
        <IconeFila size={16} />
        Demandas
        {aguardandoPriorizacao > 0 ? (
          <span className="sidebar-badge alerta" title={`${aguardandoPriorizacao} aguardando priorização`}>
            {aguardandoPriorizacao}
          </span>
        ) : naFila > 0 ? (
          <span className="sidebar-badge" title={`${naFila} na fila`}>
            {naFila}
          </span>
        ) : null}
      </NavLink>
      )}

      {funcionalidades.frentes && (
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
            <NavLink to="/frentes" end className={classeLink} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 24px", color: "#fff", fontSize: 13, fontWeight: 600 }}>
              Ver todas as frentes
            </NavLink>
            <button type="button" onClick={() => setMostrarNovaFrente(true)} className="sidebar-acao">
              + Nova frente
            </button>
          </>
        )}
      </div>
      )}

      {funcionalidades.contratos && (
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
                style={{ display: "flex", alignItems: c.fornecedor ? "flex-start" : "center", gap: 10, padding: "8px 24px", color: "#fff", fontSize: 13 }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: (CONTRATO_STATUS[c.status] || CONTRATO_STATUS.ativo).cor,
                    flex: "0 0 auto",
                    marginTop: c.fornecedor ? 5 : 0,
                  }}
                />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block" }}>{c.titulo}</span>
                  {c.fornecedor && (
                    <span style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 1 }}>{c.fornecedor}</span>
                  )}
                </span>
                {situacaoDoContrato(c) === "atencao" && (
                  <span className="sidebar-badge alerta" title="Pede atenção (vencimento)">
                    !
                  </span>
                )}
              </NavLink>
            ))}
            <NavLink to="/contratos" end className={classeLink} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 24px", color: "#fff", fontSize: 13, fontWeight: 600 }}>
              Ver todos os contratos
            </NavLink>
            <Link to="/contratos/novo" className="sidebar-acao">
              + Novo contrato
            </Link>
          </>
        )}
      </div>
      )}

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
