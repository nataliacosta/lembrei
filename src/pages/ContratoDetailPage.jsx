import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Avatar from "../components/Avatar";

import { BotaoVoltar } from "../contexts/HistoricoContext";

import { useUsuarios } from "../hooks/useUsuarios";
import ItensDoContrato from "../components/ItensDoContrato";
import { CONTRATO_STATUS, PAPEIS, TIPO_POR_KEY } from "../lib/constants";
import { alertaVencimento, descreverVencimento, diasAte, formatarData, formatarDataRelativa, inicioDoDia } from "../lib/datas";
import { chaveDoMes, nomeDoMes, proximaMedicao } from "../lib/medicao";
import { marcarMedicaoFeita } from "../lib/contratos";
import { IconeCheck } from "../components/Icones";
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

  useEffect(() => watchItensDoContrato(contratoId, setItensVinculados), [contratoId]);

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
    navigate("/contratos", { replace: true });
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

  const proximoPasso = calcularProximoPasso({ contrato, alerta, aditivoAtivo, cancelamentoAtivo });

  return (
    <div className="page-shell" style={{ paddingTop: 24, paddingBottom: 80, maxWidth: 1180 }}>
      <BotaoVoltar destinoPadrao="/contratos" />

      <div className="detalhe-layout" style={{ marginTop: 16 }}>
        <div className="detalhe-principal">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {alerta === "vencido" && (
              <span className="pill" style={{ background: "var(--color-accent)", color: "var(--color-dark)" }}>
                Vencido
              </span>
            )}
            {alerta === "proximo" && (
              <span className="pill" style={{ background: "var(--color-orange-soft)", color: "var(--color-orange)" }}>
                {descreverVencimento(contrato.vencimento)}
              </span>
            )}
            <span className="pill" style={{ background: "rgba(0,212,192,0.18)", color: "var(--color-dark)" }}>
              {statusInfo.label}
              {contrato.status === "aditivo" && (aditivoAtivo?.pendenteEm || contrato.aditivoAtivoPendenteEm) &&
                ` · pendente em ${aditivoAtivo?.pendenteEm || contrato.aditivoAtivoPendenteEm}`}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>{contrato.titulo}</h1>
          <div style={{ fontSize: 14, color: "var(--color-gray)", marginTop: 4 }}>
            {[contrato.fornecedor, contrato.numero && `Nº ${contrato.numero}`].filter(Boolean).join(" · ")}
          </div>

          {proximoPasso && (
            <div
              className="lista-card"
              style={{
                marginTop: 18,
                padding: "16px 18px",
                borderColor: proximoPasso.alerta ? "var(--color-orange-border)" : "#00d4c0",
                background: proximoPasso.alerta ? "var(--color-orange-soft)" : "var(--color-white)",
                display: "flex",
                gap: 16,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: "1 1 300px" }}>
                <div
                  className={proximoPasso.alerta ? "texto-alerta" : ""}
                  style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-primary-dark)" }}
                >
                  Próximo passo
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{proximoPasso.titulo}</div>
                {proximoPasso.detalhe && <div style={{ fontSize: 13, color: "var(--color-gray)", marginTop: 2 }}>{proximoPasso.detalhe}</div>}
              </div>
              {podeEditar && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {aditivoAtivo && (
                    <Link to={`/contratos/${contratoId}/aditivos/${aditivoAtivo.id}`} className="btn btn-ghost">
                      Ver aditivo
                    </Link>
                  )}
                  {contrato.status === "aditivo" && (
                    <button onClick={concluirAditivo} className="btn btn-primary">
                      Finalizar aditivo
                    </button>
                  )}
                  {contrato.status === "cancelamento" && (
                    <button onClick={concluirCancelamento} className="btn btn-primary">
                      Finalizar cancelamento
                    </button>
                  )}
                  {contrato.status === "ativo" && (
                    <>
                      <Link to={`/contratos/${contratoId}/aditivos/novo`} className="btn btn-primary">
                        + Novo aditivo
                      </Link>
                      <Link to={`/contratos/${contratoId}/cancelamentos/novo`} className="btn btn-ghost">
                        Solicitar cancelamento
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {aditivos.length > 0 && (
            <>
              <SecaoCabecalho titulo={`Aditivos · ${aditivos.length}`} />
              <div className="lista-card">
                {aditivos.map((a) => (
                  <Link
                    key={a.id}
                    to={`/contratos/${contratoId}/aditivos/${a.id}`}
                    className="secao-lateral"
                    style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", opacity: a.finalizado ? 0.7 : 1 }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{(a.tipo || []).join(", ") || "Aditivo"}</div>
                      <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 2 }}>
                        Pendente em {a.pendenteEm} · solicitado em {a.dataSolicitacao ? formatarData(a.dataSolicitacao) : "—"}
                        {a.numeroRQS && ` · RQS ${a.numeroRQS}`}
                        {(() => {
                          const abertos = itensVinculados.filter((i) => i.aditivoId === a.id && !i.concluido).length;
                          return abertos ? ` · ${abertos} ${abertos === 1 ? "item aberto" : "itens abertos"}` : "";
                        })()}
                        {a.motivo && ` · ${a.motivo}`}
                      </div>
                    </div>
                    <span
                      className="pill"
                      style={{
                        flex: "0 0 auto",
                        background: a.finalizado ? "#eceeee" : "rgba(0,212,192,0.22)",
                        color: a.finalizado ? "var(--color-gray)" : "var(--color-dark)",
                      }}
                    >
                      {a.finalizado ? "Finalizado" : "Em andamento"}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}

          <SecaoCabecalho
            titulo={`Itens · ${itensVinculados.length}`}
            acao={
              podeEditar && (
                <Link to={`/contratos/${contratoId}/itens/novo`} style={{ fontSize: 13, fontWeight: 600 }}>
                  + Novo item
                </Link>
              )
            }
          />
          <ItensDoContrato contratoId={contratoId} itens={itensVinculados} aditivos={aditivos} />

          {cancelamentos.length > 0 && (
            <>
              <SecaoCabecalho titulo={`Cancelamentos · ${cancelamentos.length}`} />
              <div className="lista-card">
                {cancelamentos.map((c) => (
                  <div
                    key={c.id}
                    className="secao-lateral"
                    style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", opacity: c.finalizado ? 0.7 : 1 }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{c.motivo || "Cancelamento"}</div>
                      <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 2 }}>
                        Solicitado em {c.dataSolicitacao ? formatarData(c.dataSolicitacao) : "—"}
                      </div>
                    </div>
                    <span
                      className="pill"
                      style={{
                        flex: "0 0 auto",
                        background: c.finalizado ? "#eceeee" : "var(--color-orange-soft)",
                        color: c.finalizado ? "var(--color-gray)" : "var(--color-orange)",
                      }}
                    >
                      {c.finalizado ? "Concluído" : "Em andamento"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {contrato.escopo && (
            <>
              <SecaoCabecalho titulo="Escopo" />
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, maxWidth: 640, whiteSpace: "pre-wrap" }}>{contrato.escopo}</p>
            </>
          )}
        </div>

        <aside className="detalhe-lateral">
          <div className="lista-card">
            <div className="info-linha">
              <span>Vencimento</span>
              <span className={alerta ? "texto-alerta" : ""}>{contrato.vencimento ? formatarData(contrato.vencimento) : "—"}</span>
            </div>
            <div className="info-linha">
              <span>Fornecedor</span>
              <span>{contrato.fornecedor || "—"}</span>
            </div>
            <div className="info-linha">
              <span>Número</span>
              <span>{contrato.numero || "—"}</span>
            </div>
          </div>

          {contrato.medicao?.ativa && <CartaoMedicao contrato={contrato} podeEditar={podeEditar} />}

          <div className="lista-card" style={{ padding: "14px 16px" }}>
            <SectionTitle>Ações</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {podeEditar && (
                <Link to={`/contratos/${contratoId}/editar`} className="btn btn-ghost">
                  Editar contrato
                </Link>
              )}
              <Link to={`/contratos/${contratoId}/compartilhar`} className="btn btn-ghost">
                Compartilhar
              </Link>
              {podeEditar && contrato.status === "ativo" && (
                <Link to={`/contratos/${contratoId}/cancelamentos/novo`} className="btn btn-ghost">
                  Solicitar cancelamento
                </Link>
              )}
              {souProprietario && (
                <button onClick={excluir} className="btn btn-ghost" style={{ color: "var(--color-orange)", borderColor: "var(--color-orange-border)" }}>
                  Excluir contrato
                </button>
              )}
              {!podeEditar && (
                <div style={{ fontSize: 12, color: "var(--color-gray)" }}>
                  Seu acesso: <b style={{ color: "var(--color-dark)" }}>{PAPEIS[papel] || "Sem acesso"}</b>
                </div>
              )}
            </div>
          </div>

          <div className="lista-card" style={{ padding: "14px 16px" }}>
            <SectionTitle>Membros</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(contrato.membrosUids || []).map((uid) => (
                <div key={uid} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <Avatar nome={membros[uid]?.nome} url={membros[uid]?.avatarUrl} tamanho={28} decorativo />
                  {membros[uid]?.nome || "..."} · {PAPEIS[contrato.membros?.[uid]]?.toLowerCase()}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// O que está travando o contrato agora, em uma frase.
function calcularProximoPasso({ contrato, alerta, aditivoAtivo, cancelamentoAtivo }) {
  const avisoVencimento = alerta ? `${descreverVencimento(contrato.vencimento)} (${formatarData(contrato.vencimento)}).` : "";
  if (contrato.status === "cancelamento") {
    const desde = cancelamentoAtivo?.dataSolicitacao ? ` desde ${formatarData(cancelamentoAtivo.dataSolicitacao)}` : "";
    return {
      titulo: `Cancelamento em andamento${desde}`,
      detalhe: "Quando o fornecedor confirmar, finalize o cancelamento.",
      alerta: alerta === "vencido",
    };
  }
  if (contrato.status === "aditivo" && aditivoAtivo) {
    const parado = aditivoAtivo.dataSolicitacao ? -diasAte(aditivoAtivo.dataSolicitacao) : null;
    const tipos = (aditivoAtivo.tipo || []).join(" e ").toLowerCase();
    return {
      titulo: `Aditivo${tipos ? ` de ${tipos}` : ""} aguardando ${aditivoAtivo.pendenteEm}${parado !== null ? ` há ${parado} ${parado === 1 ? "dia" : "dias"}` : ""}`,
      detalhe: alerta ? `${avisoVencimento} Se o aditivo não sair antes, o contrato fica vencido.` : "",
      alerta: alerta === "vencido",
    };
  }
  if (contrato.status === "ativo" && alerta === "vencido") {
    return { titulo: "Contrato vencido", detalhe: `${avisoVencimento} Abra um aditivo ou solicite o cancelamento.`, alerta: true };
  }
  if (contrato.status === "ativo" && alerta === "proximo") {
    return { titulo: "Decidir: renovar ou encerrar", detalhe: `${avisoVencimento} Abra um aditivo ou solicite o cancelamento.`, alerta: false };
  }
  return null;
}

function SecaoCabecalho({ titulo, acao }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        margin: "24px 0 8px",
        fontSize: 12,
        fontWeight: 700,
        color: "var(--color-gray)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      <span>{titulo}</span>
      {acao && <span style={{ textTransform: "none", letterSpacing: 0 }}>{acao}</span>}
    </div>
  );
}

function CartaoMedicao({ contrato, podeEditar }) {
  const m = contrato.medicao;
  const proxima = proximaMedicao(contrato);
  const hoje = inicioDoDia();
  const mesAtual = chaveDoMes(hoje.getFullYear(), hoje.getMonth());
  const feitaEsteMes = Boolean(m.feitas?.[mesAtual]);
  const atrasada = proxima && proxima.prazo < hoje;
  const [salvando, setSalvando] = useState(false);

  async function marcar(chave, feita) {
    setSalvando(true);
    try {
      await marcarMedicaoFeita(contrato.id, chave, feita);
    } catch (e) {
      console.error("Erro ao marcar medição:", e);
      window.alert("Não deu pra atualizar a medição. Tente de novo.");
    }
    setSalvando(false);
  }

  return (
    <div className="lista-card">
      <div style={{ padding: "12px 16px 2px" }}>
        <SectionTitle>Medição mensal</SectionTitle>
      </div>
      <div className="info-linha">
        <span>Quem realiza</span>
        <span>{[m.quem, m.responsavelNome].filter(Boolean).join(" · ") || "—"}</span>
      </div>
      <div className="info-linha">
        <span>Light+</span>
        <span>{m.lightPlus ? <span className="pill pill-tipo">No processo</span> : "Não"}</span>
      </div>
      <div className="info-linha">
        <span>Prazo</span>
        <span>
          dia {m.diaPrazo || 10} · lembrar {m.diasAntes ?? 0} {Number(m.diasAntes) === 1 ? "dia" : "dias"} antes
        </span>
      </div>
      {proxima && (
        <div className="info-linha">
          <span style={{ textTransform: "capitalize" }}>{proxima.nomeMes}</span>
          <span className={atrasada ? "texto-alerta" : ""}>
            {atrasada ? "atrasada · " : "até "}
            {formatarDataRelativa(proxima.prazo).toLowerCase()}
            {!atrasada && proxima.lembrarEm > hoje ? ` · aparece ${formatarDataRelativa(proxima.lembrarEm).toLowerCase()}` : ""}
          </span>
        </div>
      )}
      {podeEditar && (
        <div style={{ padding: "6px 16px 14px" }}>
          {feitaEsteMes ? (
            <div style={{ fontSize: 13, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <span>
                <IconeCheck size={14} /> Medição de {nomeDoMes(hoje.getMonth())} feita
              </span>
              <button type="button" className="link-botao" disabled={salvando} onClick={() => marcar(mesAtual, false)}>
                Desfazer
              </button>
            </div>
          ) : (
            proxima && (
              <button type="button" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={salvando} onClick={() => marcar(proxima.chave, true)}>
                Medição de {proxima.nomeMes} feita
              </button>
            )
          )}
        </div>
      )}
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
