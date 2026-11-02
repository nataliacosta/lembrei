import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useUsuarios } from "../hooks/useUsuarios";
import { CONTRATO_STATUS, FRENTE_CONTRATOS_ID, PAPEIS, TIPO_POR_KEY } from "../lib/constants";
import { alertaVencimento, formatarData } from "../lib/datas";
import { watchItensDoContrato } from "../lib/firestore";
import {
  atualizarContrato,
  excluirContrato,
  finalizarAditivo,
  finalizarCancelamento,
  watchAditivos,
  watchCancelamentos,
  watchContrato,
} from "../lib/contratos";

export default function ContratoDetailPage() {
  const { contratoId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contrato, setContrato] = useState(undefined);
  const [aditivos, setAditivos] = useState([]);
  const [cancelamentos, setCancelamentos] = useState([]);
  const [itensVinculados, setItensVinculados] = useState([]);

  useEffect(() => {
    const unsub = watchContrato(contratoId, setContrato);
    return unsub;
  }, [contratoId]);

  useEffect(() => {
    const unsub = watchAditivos(contratoId, setAditivos);
    return unsub;
  }, [contratoId]);

  useEffect(() => {
    const unsub = watchCancelamentos(contratoId, setCancelamentos);
    return unsub;
  }, [contratoId]);

  useEffect(() => {
    const unsub = watchItensDoContrato(contratoId, setItensVinculados);
    return unsub;
  }, [contratoId]);

  const membros = useUsuarios(contrato?.membrosUids || []);

  const aditivoAtivo = aditivos.find((a) => !a.finalizado);
  const papel = contrato?.membros?.[user.uid];
  const podeEditar = papel === "proprietario" || papel === "editor";

  // Autocorrige o "pendente em" copiado no contrato caso esteja desatualizado
  // ou ausente (ex: aditivos criados antes dessa cópia existir).
  useEffect(() => {
    if (!contrato || !podeEditar) return;
    if (contrato.status === "aditivo" && aditivoAtivo && contrato.aditivoAtivoPendenteEm !== aditivoAtivo.pendenteEm) {
      atualizarContrato(contratoId, { aditivoAtivoPendenteEm: aditivoAtivo.pendenteEm });
    } else if (contrato.status !== "aditivo" && contrato.aditivoAtivoPendenteEm) {
      atualizarContrato(contratoId, { aditivoAtivoPendenteEm: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrato?.status, contrato?.aditivoAtivoPendenteEm, aditivoAtivo?.pendenteEm, podeEditar]);

  if (contrato === undefined) return <div className="spinner-wrap">Carregando...</div>;
  if (!contrato) return <div className="spinner-wrap">Contrato não encontrado (ou você não tem acesso).</div>;

  const souProprietario = papel === "proprietario";
  const statusInfo = CONTRATO_STATUS[contrato.status] || CONTRATO_STATUS.ativo;
  const alerta = alertaVencimento(contrato.vencimento, contrato.status === "aditivo");
  const cancelamentoAtivo = cancelamentos.find((c) => !c.finalizado);

  async function excluir() {
    if (!window.confirm(`Excluir o contrato "${contrato.titulo}"? Essa ação não pode ser desfeita.`)) return;
    await excluirContrato(contratoId);
    navigate("/contratos");
  }

  async function concluirAditivo() {
    if (!aditivoAtivo) return;
    if (!window.confirm("Finalizar este aditivo e voltar o contrato para Ativo?")) return;
    await finalizarAditivo(contratoId, aditivoAtivo.id);
  }

  async function concluirCancelamento() {
    if (!cancelamentoAtivo) return;
    if (!window.confirm("Finalizar o cancelamento? O contrato vai passar para Cancelado.")) return;
    await finalizarCancelamento(contratoId, cancelamentoAtivo.id);
  }

  return (
    <div className="page-shell" style={{ maxWidth: 780, margin: "0 auto", paddingTop: 32, paddingBottom: 80 }}>
        <Link to="/contratos" style={{ fontSize: 13, fontWeight: 600 }}>
          ← Voltar para Contratos
        </Link>

        <div style={{ marginTop: 20, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <span className="pill" style={{ background: "rgba(0,0,0,0.06)", color: statusInfo.cor }}>
              {statusInfo.label}
              {contrato.status === "aditivo" && (aditivoAtivo?.pendenteEm || contrato.aditivoAtivoPendenteEm) &&
                ` · Pendente em ${aditivoAtivo?.pendenteEm || contrato.aditivoAtivoPendenteEm}`}
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
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{contrato.titulo}</h1>
        </div>

        <div className="meta-grid" style={{ padding: "16px 0", borderTop: "1px solid var(--color-gray-light)", borderBottom: "1px solid var(--color-gray-light)", marginBottom: 20 }}>
          <Meta label="Número do contrato" valor={contrato.numero || "—"} />
          <Meta label="Fornecedor" valor={contrato.fornecedor || "—"} />
          <Meta label="Vencimento" valor={contrato.vencimento ? formatarData(contrato.vencimento) : "—"} />
        </div>

        {contrato.escopo && (
          <div style={{ marginBottom: 24 }}>
            <SectionTitle>Escopo</SectionTitle>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, maxWidth: 620 }}>{contrato.escopo}</p>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 32 }}>
          {podeEditar && (
            <Link to={`/contratos/${contratoId}/itens/novo`} className="btn btn-primary">
              + Novo item
            </Link>
          )}
          {podeEditar && contrato.status === "ativo" && (
            <Link to={`/contratos/${contratoId}/aditivos/novo`} className="btn btn-primary">
              + Novo aditivo
            </Link>
          )}
          {podeEditar && contrato.status === "aditivo" && (
            <button onClick={concluirAditivo} className="btn btn-primary">
              Finalizar aditivo
            </button>
          )}
          {podeEditar && contrato.status === "ativo" && (
            <Link to={`/contratos/${contratoId}/cancelamentos/novo`} className="btn btn-outline">
              Solicitar cancelamento
            </Link>
          )}
          {podeEditar && contrato.status === "cancelamento" && (
            <button onClick={concluirCancelamento} className="btn btn-outline" style={{ borderColor: "var(--color-orange)", color: "var(--color-orange)" }}>
              Finalizar cancelamento
            </button>
          )}
          {podeEditar && (
            <Link to={`/contratos/${contratoId}/editar`} className="btn btn-ghost">
              Editar
            </Link>
          )}
          <Link to={`/contratos/${contratoId}/compartilhar`} className="btn btn-ghost">
            Compartilhar
          </Link>
          {souProprietario && (
            <button onClick={excluir} className="btn btn-ghost" style={{ color: "var(--color-orange)", borderColor: "var(--color-orange)" }}>
              Excluir contrato
            </button>
          )}
          {!podeEditar && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 4px", fontSize: 12, color: "var(--color-gray)" }}>
              Seu acesso: <b style={{ color: "var(--color-dark)" }}>{PAPEIS[papel] || "Sem acesso"}</b>
            </div>
          )}
        </div>

        {aditivos.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionTitle>Aditivos</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 620 }}>
              {aditivos.map((a) => (
                <Link
                  key={a.id}
                  to={`/contratos/${contratoId}/aditivos/${a.id}`}
                  className="card"
                  style={{ padding: "12px 16px", opacity: a.finalizado ? 0.75 : 1, color: "inherit", display: "block" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span className="pill" style={{ background: a.finalizado ? "#F3F3F3" : "rgba(0,212,192,0.2)", color: a.finalizado ? "var(--color-gray)" : "var(--color-dark)" }}>
                      {a.finalizado ? "Finalizado" : "Em andamento"}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--color-gray)" }}>
                      Solicitado em {a.dataSolicitacao ? formatarData(a.dataSolicitacao) : "—"}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                    <span>Pendente em: <b>{a.pendenteEm}</b></span>
                    <span>Tipo: {(a.tipo || []).join(", ") || "—"}</span>
                    {a.numeroRQS && <span>RQS: {a.numeroRQS}</span>}
                  </div>
                  {a.motivo && <div style={{ fontSize: 13, color: "var(--color-gray)" }}>{a.motivo}</div>}
                </Link>
              ))}
            </div>
          </div>
        )}

        {itensVinculados.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionTitle>Itens</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 620 }}>
              {itensVinculados.map((item) => (
                <Link
                  key={item.id}
                  to={`/frentes/${FRENTE_CONTRATOS_ID}/itens/${item.id}`}
                  state={{ from: "contrato", contratoId }}
                  className="card"
                  style={{ padding: "12px 16px", opacity: item.concluido ? 0.75 : 1, color: "inherit", display: "block" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span className="pill" style={{ background: "rgba(0,153,146,0.12)", color: "var(--color-primary)" }}>
                      {TIPO_POR_KEY[item.tipo]?.label}
                    </span>
                    {item.concluido ? (
                      <span style={{ fontSize: 12, color: "var(--color-gray)" }}>Concluído</span>
                    ) : (
                      item.prazo && <span style={{ fontSize: 12, color: "var(--color-gray)" }}>Prazo: {formatarData(item.prazo)}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{item.titulo}</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {cancelamentos.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionTitle>Cancelamentos</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 620 }}>
              {cancelamentos.map((c) => (
                <div key={c.id} className="card" style={{ padding: "12px 16px", opacity: c.finalizado ? 0.75 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span className="pill" style={{ background: c.finalizado ? "#F3F3F3" : "rgba(238,115,27,0.14)", color: c.finalizado ? "var(--color-gray)" : "var(--color-orange)" }}>
                      {c.finalizado ? "Concluído" : "Em andamento"}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--color-gray)" }}>
                      Solicitado em {c.dataSolicitacao ? formatarData(c.dataSolicitacao) : "—"}
                    </span>
                  </div>
                  {c.motivo && <div style={{ fontSize: 13, color: "var(--color-gray)" }}>{c.motivo}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <SectionTitle>Membros</SectionTitle>
          <div style={{ display: "flex", marginLeft: -6 }}>
            {(contrato.membrosUids || []).map((uid) => (
              <div key={uid} className="avatar" style={{ width: 28, height: 28, fontSize: 11, border: "2px solid #fff", marginLeft: -6 }} title={membros[uid]?.nome}>
                {(membros[uid]?.nome || "?").slice(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </div>
  );
}

function Meta({ label, valor }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--color-gray)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{valor}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-gray)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
      {children}
    </div>
  );
}
