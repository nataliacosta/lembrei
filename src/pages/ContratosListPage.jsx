import { useState } from "react";
import { Link } from "react-router-dom";
import { useDados } from "../contexts/DadosContext";
import { CONTRATO_STATUS, PENDENTE_EM_OPCOES } from "../lib/constants";
import { alertaVencimento, descreverVencimento, formatarData, paraDate } from "../lib/datas";
import { situacaoDoContrato } from "../lib/agenda";

const GRUPOS_CONTRATO = [
  { key: "atencao", label: "Pedem atenção", alerta: true },
  { key: "em-dia", label: "Em dia" },
  { key: "encerrado", label: "Encerrados" },
];

export default function ContratosListPage() {
  const { contratos, erroContratos: erro } = useDados();
  const [filtroPendente, setFiltroPendente] = useState("");

  const contratosFiltrados = (
    filtroPendente ? contratos.filter((c) => c.status === "aditivo" && c.aditivoAtivoPendenteEm === filtroPendente) : contratos
  )
    .slice()
    .sort((a, b) => (paraDate(a.vencimento)?.getTime() ?? Infinity) - (paraDate(b.vencimento)?.getTime() ?? Infinity));

  const porGrupo = Object.fromEntries(GRUPOS_CONTRATO.map((g) => [g.key, []]));
  contratosFiltrados.forEach((c) => porGrupo[situacaoDoContrato(c)].push(c));

  return (
    <div className="page-shell" style={{ paddingTop: 28, paddingBottom: 60, maxWidth: 1180 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ margin: "0 0 4px 0", fontSize: 26, fontWeight: 700 }}>Contratos</h1>
          <p style={{ margin: 0, color: "var(--color-gray)", fontSize: 14 }}>Fornecedores, vencimentos, aditivos e cancelamentos.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--color-gray)", fontWeight: 600 }}>Pendente em:</span>
          <div className="seg" role="group" aria-label="Pendente em">
            <button type="button" aria-pressed={filtroPendente === ""} onClick={() => setFiltroPendente("")}>
              Todos
            </button>
            {PENDENTE_EM_OPCOES.map((o) => (
              <button key={o} type="button" aria-pressed={filtroPendente === o} onClick={() => setFiltroPendente(o)}>
                {o}
              </button>
            ))}
          </div>
          <Link to="/contratos/novo" className="btn btn-primary">
            + Novo contrato
          </Link>
        </div>
      </div>

      {erro ? (
        <div className="empty-state" style={{ color: "var(--color-orange)" }}>Não deu pra carregar: {erro}</div>
      ) : contratosFiltrados.length === 0 ? (
        <div className="empty-state">
          {filtroPendente ? `Nenhum contrato pendente em ${filtroPendente}.` : "Nenhum contrato cadastrado ainda."}
        </div>
      ) : (
        GRUPOS_CONTRATO.map((g) =>
          porGrupo[g.key].length === 0 ? null : (
            <section key={g.key}>
              <h2 className={`grupo-titulo ${g.alerta ? "grupo-alerta" : ""}`}>
                {g.label} · {porGrupo[g.key].length}
              </h2>
              <div className={`lista-card ${g.alerta ? "alerta" : ""}`} style={g.key === "encerrado" ? { opacity: 0.85 } : undefined}>
                {porGrupo[g.key].map((c) => (
                  <ContratoLinha key={c.id} contrato={c} />
                ))}
              </div>
            </section>
          )
        )
      )}
    </div>
  );
}

function ContratoLinha({ contrato: c }) {
  const { ehSoMedicao } = useDados();
  const alerta = alertaVencimento(c.vencimento, c.status === "aditivo");
  const statusInfo = CONTRATO_STATUS[c.status] || CONTRATO_STATUS.ativo;
  const encerrado = c.status === "cancelado";
  return (
    <Link
      to={`/contratos/${c.id}`}
      className="secao-lateral"
      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "14px 18px" }}
    >
      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{c.titulo}</div>
        <div style={{ fontSize: 13, color: "var(--color-gray)", marginTop: 2 }}>
          {c.numero && `Nº ${c.numero} · `}
          {c.fornecedor}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {ehSoMedicao(c.id) && (
            <span className="pill" style={{ background: "#eceeee", color: "var(--color-dark)" }}>
              Só medição
            </span>
          )}
          {alerta === "vencido" && (
            <span className="pill" style={{ background: "var(--color-accent)", color: "var(--color-dark)" }}>
              Vencido
            </span>
          )}
          {alerta === "proximo" && (
            <span className="pill" style={{ background: "var(--color-orange-soft)", color: "var(--color-orange)" }}>
              Vence em breve
            </span>
          )}
          <span
            className="pill"
            style={
              encerrado
                ? { background: "#eceeee", color: "var(--color-gray)" }
                : { background: "rgba(0,212,192,0.18)", color: "var(--color-dark)" }
            }
          >
            {statusInfo.label}
            {c.status === "aditivo" && c.aditivoAtivoPendenteEm && ` · pendente em ${c.aditivoAtivoPendenteEm}`}
          </span>
        </div>
      </div>
      <div style={{ textAlign: "right", flex: "0 0 auto" }}>
        <div style={{ fontSize: 12, color: "var(--color-gray)" }}>
          {c.vencimento && !encerrado ? descreverVencimento(c.vencimento) : "Vencimento"}
        </div>
        <div className={alerta ? "texto-alerta" : ""} style={{ fontSize: 15, fontWeight: 700 }}>
          {c.vencimento ? formatarData(c.vencimento) : "—"}
        </div>
      </div>
    </Link>
  );
}
