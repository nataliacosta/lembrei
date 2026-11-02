import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useDados } from "../contexts/DadosContext";
import { useVoltar } from "../contexts/HistoricoContext";
import { atualizarDemanda, concluirDemanda, criarDemanda, excluirDemanda, reabrirDemanda, watchDemandas, watchFila } from "../lib/filas";
import { deInputDate, formatarData, formatarDataRelativa, inicioDoDia, paraDate, paraInputDate } from "../lib/datas";
import { calcularPrevisao, formatarHoras, ordenarFila, paraHoras } from "../lib/previsao";

function Rotulo({ children }) {
  return (
    <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--color-gray)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
      {children}
    </span>
  );
}

export default function DemandaFormPage() {
  const { donoId: donoParam, demandaId } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { frentes } = useDados();
  const donoId = donoParam || params.get("fila") || user.uid;
  const editando = Boolean(demandaId);
  const { voltar } = useVoltar(donoId === user.uid ? "/demandas" : `/demandas?fila=${donoId}`);

  const [fila, setFila] = useState(undefined);
  const [demandas, setDemandas] = useState(undefined);
  const [carregado, setCarregado] = useState(!editando);
  const [titulo, setTitulo] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [frenteId, setFrenteId] = useState("");
  const [valor, setValor] = useState("");
  const [unidade, setUnidade] = useState("h");
  const [prazo, setPrazo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [horasFeitas, setHorasFeitas] = useState("0");
  const [posicao, setPosicao] = useState("fim"); // "fim" | "topo" | número (índice)
  const [salvando, setSalvando] = useState(false);

  useEffect(() => watchFila(donoId, setFila), [donoId]);
  useEffect(() => watchDemandas(donoId, setDemandas), [donoId]);

  const original = editando && demandas ? demandas.find((d) => d.id === demandaId) : null;

  useEffect(() => {
    if (!editando || carregado || !original) return;
    setTitulo(original.titulo || "");
    setSolicitante(original.solicitante || "");
    setFrenteId(original.frenteId || "");
    setValor(String(original.estimativaValor ?? ""));
    setUnidade(original.estimativaUnidade || "h");
    setPrazo(original.prazoPedido ? paraInputDate(original.prazoPedido) : "");
    setDescricao(original.descricao || "");
    setHorasFeitas(String(original.horasFeitas || 0));
    setCarregado(true);
  }, [editando, carregado, original]);

  const capacidade = fila?.capacidadeHoras || 6;
  const filaAtual = useMemo(() => ordenarFila(fila?.ordem, demandas || []), [fila?.ordem, demandas]);
  const horas = paraHoras(valor, unidade, capacidade);
  const prazoData = prazo ? inicioDoDia(deInputDate(prazo)) : null;

  // Previsão da demanda em cada posição possível (só ao criar).
  const simulacao = useMemo(() => {
    if (editando || !horas) return null;
    const nova = { id: "__nova__", titulo, estimativaHoras: horas, horasFeitas: 0 };
    const fimEm = (i) => {
      const lista = [...filaAtual];
      lista.splice(i, 0, nova);
      const p = calcularPrevisao(lista, capacidade);
      return { fim: p.itens[i].fim, atrasa: p.itens.slice(i + 1).length };
    };
    const indice = posicao === "fim" ? filaAtual.length : posicao === "topo" ? 0 : Number(posicao);
    const escolhida = fimEm(indice);
    let posicaoMaxima = null;
    if (prazoData && escolhida.fim > prazoData) {
      for (let i = indice; i >= 0; i--) {
        if (fimEm(i).fim <= prazoData) {
          posicaoMaxima = i;
          break;
        }
      }
    }
    return { indice, ...escolhida, posicaoMaxima, atrasariam: posicaoMaxima !== null ? filaAtual.length - posicaoMaxima : 0 };
  }, [editando, horas, titulo, filaAtual, capacidade, posicao, prazoData]);

  if (fila === undefined || demandas === undefined || (editando && !carregado && original !== null)) {
    return <div className="spinner-wrap">Carregando...</div>;
  }
  if (editando && !original) return <div className="spinner-wrap">Demanda não encontrada.</div>;
  if (!fila) return <div className="spinner-wrap">Fila não encontrada.</div>;

  const papel = donoId === user.uid ? "proprietario" : fila.membros?.[user.uid];
  const podeEditar = papel === "proprietario" || papel === "editor";
  const ordem = fila.ordem || filaAtual.map((d) => d.id);

  async function salvar(e) {
    e?.preventDefault();
    if (!titulo.trim() || !horas || salvando || !podeEditar) return;
    setSalvando(true);
    const dados = {
      titulo: titulo.trim(),
      solicitante: solicitante.trim(),
      frenteId: frenteId || null,
      estimativaValor: Number(String(valor).replace(",", ".")),
      estimativaUnidade: unidade,
      estimativaHoras: horas,
      prazoPedido: prazo ? deInputDate(prazo) : null,
      descricao,
    };
    try {
      if (editando) {
        await atualizarDemanda(donoId, demandaId, { ...dados, horasFeitas: Math.min(horas, Math.max(0, Number(String(horasFeitas).replace(",", ".")) || 0)) });
      } else {
        await criarDemanda(donoId, ordem, dados, simulacao?.indice ?? null, user.uid);
      }
      voltar();
    } catch (erro) {
      console.error("Erro ao salvar demanda:", erro);
      window.alert("Não deu pra salvar a demanda. Tente de novo.");
      setSalvando(false);
    }
  }

  async function concluirOuReabrir() {
    if (original.concluida) await reabrirDemanda(donoId, demandaId, ordem);
    else await concluirDemanda(donoId, demandaId, ordem);
    voltar();
  }

  async function excluir() {
    if (!window.confirm(`Excluir a demanda “${original.titulo}”?`)) return;
    await excluirDemanda(donoId, demandaId, ordem);
    voltar();
  }

  const nomeFila = donoId === user.uid ? "Minha fila" : `Fila de ${fila.donoNome || "outra pessoa"}`;
  const posicaoNaFila = editando ? filaAtual.findIndex((d) => d.id === demandaId) : -1;
  const previsaoEdicao = editando && posicaoNaFila >= 0 ? calcularPrevisao(filaAtual, capacidade).itens[posicaoNaFila] : null;

  return (
    <div className="modal-overlay" style={{ width: "100%", minHeight: "100vh", background: "rgba(0,51,45,0.55)", display: "flex", justifyContent: "center" }}>
      <form
        onSubmit={salvar}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) salvar(e);
          if (e.key === "Escape") voltar();
        }}
        className="card"
        style={{ width: "100%", maxWidth: 680, boxShadow: "0 20px 60px rgba(0,51,45,0.25)", overflow: "hidden", alignSelf: "flex-start" }}
      >
        <div className="modal-body-pad" style={{ paddingTop: 18, paddingBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-gray)" }}>
            {editando ? "Demanda" : "Nova demanda"} · {nomeFila}
          </div>
          <button type="button" onClick={voltar} style={{ fontSize: 22, color: "var(--color-gray)", background: "none", border: "none", width: 44, height: 44 }} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-body-pad" style={{ paddingBottom: 8 }}>
          <label style={{ margin: 0 }}>
            <span style={{ position: "absolute", left: -9999 }}>Título</span>
            <input
              autoFocus={!editando}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Qual é a demanda?"
              required
              disabled={!podeEditar}
              style={{ fontSize: 22, fontWeight: 600, border: "none", borderBottom: "1px solid var(--color-border)", borderRadius: 0, padding: "4px 0 12px" }}
            />
          </label>

          {editando && previsaoEdicao && (
            <div style={{ marginTop: 14, fontSize: 14 }}>
              <b>{posicaoNaFila + 1}º da fila</b> · {posicaoNaFila === 0 ? "em andamento" : `começa ${formatarDataRelativa(previsaoEdicao.inicio).toLowerCase()}`} · pronta{" "}
              <b>{formatarDataRelativa(previsaoEdicao.fim).toLowerCase()}</b>
            </div>
          )}
          {editando && original.concluida && (
            <div style={{ marginTop: 14, fontSize: 14, color: "var(--color-gray)" }}>Concluída{original.concluidaEm ? ` em ${formatarData(original.concluidaEm)}` : ""}.</div>
          )}

          <div className="field-row" style={{ marginTop: 20 }}>
            <label style={{ margin: 0 }}>
              <Rotulo>Quem pediu</Rotulo>
              <input value={solicitante} onChange={(e) => setSolicitante(e.target.value)} placeholder="Ex: Marina (Comercial)" disabled={!podeEditar} />
            </label>
            <label style={{ margin: 0 }}>
              <Rotulo>Frente (opcional)</Rotulo>
              <select value={frenteId} onChange={(e) => setFrenteId(e.target.value)} disabled={!podeEditar}>
                <option value="">— nenhuma —</option>
                {frentes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginTop: 20 }}>
            <Rotulo>Estimativa</Rotulo>
            <div className="chips-row">
              <input
                type="number"
                min="0"
                step="0.5"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                aria-label="Quanto tempo"
                required
                disabled={!podeEditar}
                style={{ width: 96 }}
              />
              <button type="button" className="chip" aria-pressed={unidade === "h"} onClick={() => setUnidade("h")} disabled={!podeEditar}>
                horas
              </button>
              <button type="button" className="chip" aria-pressed={unidade === "d"} onClick={() => setUnidade("d")} disabled={!podeEditar}>
                dias
              </button>
              {unidade === "d" && horas > 0 && (
                <span style={{ fontSize: 13, color: "var(--color-gray)" }}>
                  = {formatarHoras(horas)} (1 dia = {formatarHoras(capacidade)}, a capacidade diária)
                </span>
              )}
            </div>
          </div>

          {editando && !original.concluida && (
            <label style={{ display: "block", marginTop: 16 }}>
              <Rotulo>Horas já feitas</Rotulo>
              <input
                type="number"
                min="0"
                step="0.5"
                value={horasFeitas}
                onChange={(e) => setHorasFeitas(e.target.value)}
                disabled={!podeEditar}
                style={{ width: 120 }}
              />
            </label>
          )}

          <label style={{ display: "block", marginTop: 20 }}>
            <Rotulo>Prazo pedido (opcional)</Rotulo>
            <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} disabled={!podeEditar} style={{ maxWidth: 200 }} />
          </label>

          {!editando && (
            <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 12, background: "rgba(0,212,192,0.08)", border: "1px solid rgba(0,212,192,0.4)" }}>
              <Rotulo>Onde entra na fila</Rotulo>
              <div className="chips-row">
                <button type="button" className="chip" aria-pressed={posicao === "fim"} onClick={() => setPosicao("fim")}>
                  No fim da fila
                </button>
                <button type="button" className="chip" aria-pressed={posicao === "topo"} onClick={() => setPosicao("topo")}>
                  Em 1º (agora)
                </button>
                {filaAtual.length > 1 && (
                  <select
                    value={typeof posicao === "string" && /^\d+$/.test(posicao) ? posicao : ""}
                    onChange={(e) => e.target.value && setPosicao(e.target.value)}
                    aria-label="Depois de qual demanda"
                    style={{ width: "auto", borderRadius: 17, padding: "7px 12px", fontSize: 13 }}
                  >
                    <option value="">Depois de…</option>
                    {filaAtual.slice(0, -1).map((d, i) => (
                      <option key={d.id} value={String(i + 1)}>
                        {i + 1}. {d.titulo}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {simulacao ? (
                <>
                  <div style={{ fontSize: 14, marginTop: 12 }}>
                    <b>Previsão: pronta {formatarDataRelativa(simulacao.fim).toLowerCase()}</b>
                    {prazoData &&
                      (simulacao.fim > prazoData ? (
                        <span className="texto-alerta" style={{ fontWeight: 600 }}>
                          {" "}
                          · depois do prazo pedido ({formatarData(prazoData)})
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-primary-dark)", fontWeight: 600 }}> · dentro do prazo pedido</span>
                      ))}
                    {simulacao.indice < filaAtual.length && (
                      <span style={{ color: "var(--color-gray)" }}>
                        {" "}
                        · atrasa {filaAtual.length - simulacao.indice} {filaAtual.length - simulacao.indice === 1 ? "demanda" : "demandas"}
                      </span>
                    )}
                  </div>
                  {simulacao.posicaoMaxima !== null && (
                    <div style={{ fontSize: 13, color: "var(--color-gray)", marginTop: 4 }}>
                      Para ficar pronta até {formatarData(prazoData)}, ela precisaria entrar até a {simulacao.posicaoMaxima + 1}ª posição — o que atrasa{" "}
                      {simulacao.atrasariam} {simulacao.atrasariam === 1 ? "demanda" : "demandas"}.{" "}
                      <button
                        type="button"
                        onClick={() => setPosicao(simulacao.posicaoMaxima === 0 ? "topo" : String(simulacao.posicaoMaxima))}
                        style={{ background: "none", border: "none", padding: 0, color: "var(--color-primary)", fontWeight: 600, fontSize: 13 }}
                      >
                        Usar essa posição
                      </button>
                    </div>
                  )}
                  {simulacao.posicaoMaxima === null && prazoData && simulacao.fim > prazoData && (
                    <div style={{ fontSize: 13, color: "var(--color-gray)", marginTop: 4 }}>Nem em 1º lugar dá para entregar até {formatarData(prazoData)}.</div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: "var(--color-gray)", marginTop: 12 }}>Informe a estimativa para ver a previsão.</div>
              )}
            </div>
          )}

          <details open={Boolean(descricao)} style={{ marginTop: 18, borderTop: "1px solid var(--color-border)", paddingTop: 14 }}>
            <summary style={{ fontSize: 14, fontWeight: 600, color: "var(--color-primary)", cursor: "pointer", minHeight: 32 }}>Descrição</summary>
            <textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              aria-label="Descrição"
              disabled={!podeEditar}
              style={{ marginTop: 10, resize: "vertical" }}
            />
          </details>
        </div>

        <div
          className="modal-body-pad"
          style={{ paddingTop: 16, paddingBottom: 16, marginTop: 12, borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}
        >
          <span style={{ display: "flex", gap: 8 }}>
            {editando && podeEditar && (
              <>
                <button type="button" className="btn btn-ghost" onClick={concluirOuReabrir}>
                  {original.concluida ? "Reabrir" : "Concluir"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={excluir} style={{ color: "var(--color-orange)", borderColor: "var(--color-orange-border)" }}>
                  Excluir
                </button>
              </>
            )}
          </span>
          <span style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={voltar} className="btn btn-ghost">
              {podeEditar ? "Cancelar" : "Fechar"}
            </button>
            {podeEditar && (
              <button type="submit" disabled={salvando || !titulo.trim() || !horas} className="btn btn-primary">
                {salvando ? "Salvando..." : editando ? "Salvar" : "Adicionar à fila"}
              </button>
            )}
          </span>
        </div>
      </form>
    </div>
  );
}
