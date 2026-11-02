import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useDados } from "../contexts/DadosContext";
import { useVoltar } from "../contexts/HistoricoContext";
import {
  atualizarDemanda,
  concluirDemanda,
  criarDemanda,
  despriorizarDemanda,
  excluirDemanda,
  reabrirDemanda,
  watchDemandas,
  watchFila,
} from "../lib/filas";
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

  // Só para informar: quando ficaria pronta se entrasse no fim da fila hoje.
  const previsaoNoFim = useMemo(() => {
    if (!horas) return null;
    const lista = [...filaAtual.filter((d) => d.id !== demandaId), { id: "__nova__", estimativaHoras: horas, horasFeitas: 0 }];
    return calcularPrevisao(lista, capacidade).itens.at(-1).fim;
  }, [horas, filaAtual, capacidade, demandaId]);

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
    if (!titulo.trim() || salvando || !podeEditar) return;
    setSalvando(true);
    const dados = {
      titulo: titulo.trim(),
      solicitante: solicitante.trim(),
      frenteId: frenteId || null,
      estimativaValor: horas ? Number(String(valor).replace(",", ".")) : null,
      estimativaUnidade: unidade,
      estimativaHoras: horas,
      prazoPedido: prazo ? deInputDate(prazo) : null,
      descricao,
    };
    try {
      if (editando) {
        await atualizarDemanda(donoId, demandaId, { ...dados, horasFeitas: Math.min(horas, Math.max(0, Number(String(horasFeitas).replace(",", ".")) || 0)) });
      } else {
        await criarDemanda(donoId, dados, user.uid);
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

  async function tirarDaFila() {
    await despriorizarDemanda(donoId, ordem, demandaId);
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

          {editando && !original.concluida && posicaoNaFila < 0 && (
            <div style={{ marginTop: 14, fontSize: 14 }}>
              <b>Aguardando priorização.</b>{" "}
              <span style={{ color: "var(--color-gray)" }}>
                {horas ? "Priorize na tela da fila, escolhendo onde ela entra." : "Informe a estimativa para poder priorizar."}
              </span>
            </div>
          )}
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
            <Rotulo>Estimativa{editando ? "" : " (pode deixar para depois)"}</Rotulo>
            <div className="chips-row">
              <input
                type="number"
                min="0"
                step="0.5"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                aria-label="Quanto tempo"
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

          {editando && !original.concluida && posicaoNaFila >= 0 && (
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
            <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: 12, background: "var(--color-bg-soft)", border: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: 14 }}>
                <b>Vai para “Aguardando priorização”.</b> Você (ou quem pode editar a fila) escolhe depois onde ela entra.
              </div>
              {previsaoNoFim && (
                <div style={{ fontSize: 13, color: "var(--color-gray)", marginTop: 4 }}>
                  Se entrar no fim da fila hoje, ficaria pronta {formatarDataRelativa(previsaoNoFim).toLowerCase()}
                  {prazoData && (previsaoNoFim > prazoData ? " — depois do prazo pedido." : " — dentro do prazo pedido.")}
                </div>
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
                {posicaoNaFila >= 0 && (
                  <button type="button" className="btn btn-ghost" onClick={tirarDaFila} title="Volta para Aguardando priorização">
                    Tirar da fila
                  </button>
                )}
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
              <button type="submit" disabled={salvando || !titulo.trim()} className="btn btn-primary">
                {salvando ? "Salvando..." : editando ? "Salvar" : "Criar demanda"}
              </button>
            )}
          </span>
        </div>
      </form>
    </div>
  );
}
