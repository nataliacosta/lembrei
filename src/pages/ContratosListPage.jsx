import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { watchContratos } from "../lib/contratos";
import { CONTRATO_STATUS, PENDENTE_EM_OPCOES } from "../lib/constants";
import { alertaVencimento, formatarData } from "../lib/datas";

export default function ContratosListPage() {
  const { user } = useAuth();
  const [contratos, setContratos] = useState([]);
  const [erro, setErro] = useState("");
  const [filtroPendente, setFiltroPendente] = useState("");

  useEffect(() => {
    setErro("");
    const unsub = watchContratos(user.uid, setContratos, (e) => setErro(e.message || String(e)));
    return unsub;
  }, [user.uid]);

  const contratosFiltrados = filtroPendente
    ? contratos.filter((c) => c.status === "aditivo" && c.aditivoAtivoPendenteEm === filtroPendente)
    : contratos;

  return (
    <div className="page-shell" style={{ paddingTop: 32, paddingBottom: 60, maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: "0 0 4px 0", fontSize: 24, fontWeight: 700 }}>Contratos</h1>
            <p style={{ margin: 0, color: "var(--color-gray)", fontSize: 14 }}>Fornecedores, vencimentos, aditivos e cancelamentos.</p>
          </div>
          <Link to="/contratos/novo" className="btn btn-primary">
            + Novo contrato
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: "var(--color-gray)", fontWeight: 600 }}>Pendente em:</span>
          <button
            onClick={() => setFiltroPendente("")}
            style={{
              background: filtroPendente === "" ? "var(--color-primary)" : "#fff",
              color: filtroPendente === "" ? "#fff" : "var(--color-gray)",
              border: `1px solid ${filtroPendente === "" ? "var(--color-primary)" : "var(--color-gray-light)"}`,
              padding: "6px 14px",
              borderRadius: 16,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Todos
          </button>
          {PENDENTE_EM_OPCOES.map((o) => (
            <button
              key={o}
              onClick={() => setFiltroPendente(o)}
              style={{
                background: filtroPendente === o ? "var(--color-primary)" : "#fff",
                color: filtroPendente === o ? "#fff" : "var(--color-gray)",
                border: `1px solid ${filtroPendente === o ? "var(--color-primary)" : "var(--color-gray-light)"}`,
                padding: "6px 14px",
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {o}
            </button>
          ))}
        </div>

        {erro ? (
          <div className="empty-state" style={{ color: "var(--color-orange)" }}>Não deu pra carregar: {erro}</div>
        ) : contratosFiltrados.length === 0 ? (
          <div className="empty-state">
            {filtroPendente ? `Nenhum contrato pendente em ${filtroPendente}.` : "Nenhum contrato cadastrado ainda."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {contratosFiltrados.map((c) => {
              const alerta = alertaVencimento(c.vencimento, c.status === "aditivo");
              const statusInfo = CONTRATO_STATUS[c.status] || CONTRATO_STATUS.ativo;
              return (
                <Link key={c.id} to={`/contratos/${c.id}`} className="card" style={{ padding: "16px 20px", color: "inherit" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                        <span className="pill" style={{ background: "rgba(0,0,0,0.06)", color: statusInfo.cor }}>
                          {statusInfo.label}
                          {c.status === "aditivo" && c.aditivoAtivoPendenteEm && ` · Pendente em ${c.aditivoAtivoPendenteEm}`}
                        </span>
                        {alerta === "vencido" && (
                          <span className="pill" style={{ background: "var(--color-accent)", color: "var(--color-dark)" }}>
                            Vencido
                          </span>
                        )}
                        {alerta === "proximo" && (
                          <span className="pill" style={{ background: "rgba(238,115,27,0.14)", color: "var(--color-orange)" }}>
                            Vence em breve
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{c.titulo}</div>
                      <div style={{ fontSize: 13, color: "var(--color-gray)", marginTop: 2 }}>
                        {c.numero && `Nº ${c.numero} · `}
                        {c.fornecedor}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                      <div style={{ fontSize: 12, color: "var(--color-gray)" }}>Vencimento</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: alerta ? "var(--color-orange)" : "var(--color-dark)" }}>
                        {c.vencimento ? formatarData(c.vencimento) : "—"}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
  );
}
