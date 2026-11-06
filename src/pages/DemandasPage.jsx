import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AguardandoPriorizacao from "../components/AguardandoPriorizacao";
import ExportarFila from "../components/ExportarFila";
import { descreverPassoDaEspera, diasDesde } from "../lib/passos";
import { notificar, notificarFila } from "../lib/notificacoes";
import { IconeCheck } from "../components/Icones";
import { useAuth } from "../contexts/AuthContext";
import { useDados } from "../contexts/DadosContext";
import { alterarCapacidade, atualizarDemanda, concluirDemanda, priorizarDemanda, salvarOrdem, watchDemandas, watchFila } from "../lib/filas";
import { diasAte, formatarData, formatarDataRelativa, inicioDoDia, paraDate } from "../lib/datas";
import {
  calcularPrevisao,
  compararPrevisoes,
  demandasAguardando,
  temEstimativa,
  formatarEstimativa,
  formatarHoras,
  horasRestantes,
  diasUteisEntre,
  ordenarFila,
  proximosDiasUteis,
} from "../lib/previsao";

const DIAS_LINHA_TEMPO = 20;

function mover(lista, de, para) {
  const nova = [...lista];
  const [item] = nova.splice(de, 1);
  nova.splice(para, 0, item);
  return nova;
}

function textoDias(n) {
  const abs = Math.abs(n);
  return `${abs} ${abs === 1 ? "dia útil" : "dias úteis"}`;
}

// Resumo em uma frase do impacto de uma nova ordem.
function resumirImpacto(diferencas) {
  if (diferencas.length === 0) return "Nenhuma data muda com essa ordem.";
  const antes = diferencas.filter((d) => d.diferenca < 0);
  const depois = diferencas.filter((d) => d.diferenca > 0);
  const partes = [];
  if (antes.length === 1) partes.push(`“${antes[0].demanda.titulo}” fica pronta ${textoDias(antes[0].diferenca)} antes`);
  else if (antes.length > 1) partes.push(`${antes.length} demandas ficam prontas antes`);
  if (depois.length === 1) partes.push(`“${depois[0].demanda.titulo}” atrasa ${textoDias(depois[0].diferenca)}`);
  else if (depois.length > 1) {
    const max = Math.max(...depois.map((d) => d.diferenca));
    partes.push(`${depois.length} demandas atrasam até ${textoDias(max)}`);
  }
  const estouram = depois.filter((d) => d.demanda.prazoPedido && d.fim > inicioDoDia(paraDate(d.demanda.prazoPedido)));
  if (estouram.length) partes.push(`${estouram.map((d) => `“${d.demanda.titulo}”`).join(", ")} passa do prazo pedido`);
  return partes.join("; ") + ".";
}

export default function DemandasPage() {
  const { user } = useAuth();
  const { filasCompartilhadas } = useDados();
  const [params, setParams] = useSearchParams();
  const donoId = params.get("fila") || user.uid;
  const ehMinha = donoId === user.uid;

  const [fila, setFila] = useState(undefined);
  const [demandas, setDemandas] = useState([]);
  const [erro, setErro] = useState("");
  const [ordemSimulada, setOrdemSimulada] = useState(null);
  const [arrastando, setArrastando] = useState(null);
  const [arrastandoNova, setArrastandoNova] = useState(null);
  const [alvo, setAlvo] = useState(null);
  const [aviso, setAviso] = useState("");
  const [exportando, setExportando] = useState(false);
  const [editandoCapacidade, setEditandoCapacidade] = useState(false);

  useEffect(() => {
    setOrdemSimulada(null);
    return watchFila(donoId, setFila, (e) => setErro(e.message || String(e)));
  }, [donoId]);
  useEffect(() => watchDemandas(donoId, setDemandas, (e) => setErro(e.message || String(e))), [donoId]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(""), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const papel = ehMinha ? "proprietario" : fila?.membros?.[user.uid];
  const podeEditar = papel === "proprietario" || papel === "editor";
  const capacidade = fila?.capacidadeHoras || 6;

  const filaSalva = useMemo(() => ordenarFila(fila?.ordem, demandas), [fila?.ordem, demandas]);
  const aguardando = useMemo(() => demandasAguardando(fila?.ordem, demandas), [fila?.ordem, demandas]);
  const ordemAtual = ordemSimulada || filaSalva.map((d) => d.id);
  const porId = Object.fromEntries(filaSalva.map((d) => [d.id, d]));
  const filaExibida = ordemAtual.map((id) => porId[id]).filter(Boolean);

  const previsaoSalva = useMemo(() => calcularPrevisao(filaSalva, capacidade), [filaSalva, capacidade]);
  const previsao = useMemo(() => calcularPrevisao(filaExibida, capacidade), [filaExibida, capacidade]);
  const diferencas = ordemSimulada ? compararPrevisoes(previsaoSalva, previsao) : [];
  const difPorId = Object.fromEntries(diferencas.map((d) => [d.demanda.id, d.diferenca]));

  const diasTempo = useMemo(() => proximosDiasUteis(DIAS_LINHA_TEMPO), []);
  const semanas = [0, 5, 10, 15].map((i) => diasTempo[i]).filter(Boolean);

  if (fila === undefined) return <div className="spinner-wrap">Carregando...</div>;
  if (fila === null) {
    return <div className="spinner-wrap">{ehMinha ? "Preparando sua fila..." : "Fila não encontrada (ou você não tem acesso)."}</div>;
  }

  const depoisDoPrazo = previsao.itens.filter((r) => r.demanda.prazoPedido && r.fim > inicioDoDia(paraDate(r.demanda.prazoPedido)));
  const fimDaFila = previsao.itens.reduce((max, r) => (r.fim && (!max || r.fim > max) ? r.fim : max), null);
  const paradas = previsao.itens.filter((r) => r.esperando);
  const concluidas = demandas
    .filter((d) => d.concluida)
    .sort((a, b) => (b.concluidaEm?.seconds || 0) - (a.concluidaEm?.seconds || 0))
    .slice(0, 5);

  // Avisos para quem acompanha a fila.
  function avisarPriorizada(d, posicao, fim) {
    notificarFila(donoId, fila, {
      tipo: "demanda_priorizada",
      alvo: d.titulo,
      trecho: `Entrou na ${posicao + 1}ª posição${fim ? ` · previsão ${formatarData(fim)}` : ""}`,
      link: `/demandas/${donoId}/${d.id}`,
    });
  }

  function avisarRepriorizada(texto) {
    if (ehMinha) return;
    notificar([donoId], { tipo: "fila_repriorizada", alvo: "sua fila", trecho: texto, link: "/demandas" });
  }

  async function reordenar(de, para) {
    if (de === para || para < 0 || para >= ordemAtual.length) return;
    const nova = mover(ordemAtual, de, para);
    if (ordemSimulada) {
      setOrdemSimulada(nova);
      return;
    }
    const novaPrevisao = calcularPrevisao(nova.map((id) => porId[id]), capacidade);
    const difs = compararPrevisoes(previsaoSalva, novaPrevisao);
    await salvarOrdem(donoId, nova);
    setAviso(resumirImpacto(difs));
    avisarRepriorizada(resumirImpacto(difs));
  }

  // Cartão de "Aguardando priorização" solto numa posição da fila.
  async function soltarNova(posicao) {
    const id = arrastandoNova;
    setArrastandoNova(null);
    setAlvo(null);
    if (!id) return;
    const d = demandas.find((x) => x.id === id);
    if (!d || !temEstimativa(d)) {
      setAviso("Informe a estimativa da demanda antes de priorizá-la.");
      return;
    }
    await priorizarDemanda(donoId, fila.ordem || [], id, posicao);
    setAviso(`“${d?.titulo || "Demanda"}” entrou na ${posicao + 1}ª posição da fila.`);
    avisarPriorizada(d, posicao);
  }

  async function salvarSimulacao() {
    await salvarOrdem(donoId, ordemSimulada);
    setOrdemSimulada(null);
    setAviso("Nova ordem salva.");
    avisarRepriorizada(diferencas.length ? resumirImpacto(diferencas) : "A ordem das demandas mudou.");
  }

  async function concluir(demanda) {
    await concluirDemanda(donoId, demanda.id, fila.ordem || filaSalva.map((d) => d.id));
    setAviso(`“${demanda.titulo}” concluída. A próxima da fila já está em andamento.`);
  }

  async function atualizarRestante(demanda) {
    const atual = horasRestantes(demanda);
    const resposta = window.prompt(`Quantas horas ainda faltam para “${demanda.titulo}”?`, String(atual).replace(".", ","));
    if (resposta === null) return;
    const restante = Number(resposta.replace(",", "."));
    if (Number.isNaN(restante) || restante < 0) return;
    const estimativa = Number(demanda.estimativaHoras) || 0;
    await atualizarDemanda(donoId, demanda.id, {
      horasFeitas: Math.max(0, estimativa - restante),
      // Se faltar mais do que o estimado, a estimativa cresce junto.
      ...(restante > estimativa ? { estimativaHoras: restante, estimativaValor: restante, estimativaUnidade: "h", horasFeitas: 0 } : {}),
    });
  }

  async function salvarCapacidade(e) {
    e.preventDefault();
    const valor = Number(new FormData(e.target).get("capacidade").toString().replace(",", "."));
    if (valor > 0 && valor <= 24) await alterarCapacidade(donoId, valor);
    setEditandoCapacidade(false);
  }

  function colunasBarra(r) {
    if (r.iDiaInicio == null) return null;
    const ini = r.iDiaInicio;
    const fim = r.iDiaFim;
    if (ini >= DIAS_LINHA_TEMPO) return null;
    return `${ini + 1} / ${Math.min(fim, DIAS_LINHA_TEMPO - 1) + 2}`;
  }

  const abas = [{ id: user.uid, nome: "Minha fila" }, ...filasCompartilhadas.map((f) => ({ id: f.id, nome: `Fila de ${f.donoNome || "outra pessoa"}` }))];

  return (
    <div className="page-shell" style={{ paddingTop: 28, paddingBottom: 60, maxWidth: 1480 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Demandas</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--color-gray)" }}>
            A ordem da fila é a prioridade. As datas se recalculam quando a ordem muda.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ordemSimulada ? (
            <button type="button" className="btn btn-ghost" onClick={() => setOrdemSimulada(null)}>
              Sair da simulação
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setExportando(true)} disabled={filaSalva.length === 0}>
                Exportar
              </button>
              {ehMinha && (
                <Link to="/demandas/compartilhar" className="btn btn-ghost">
                  Compartilhar fila
                </Link>
              )}
              {podeEditar && filaSalva.length > 1 && (
                <button type="button" className="btn btn-ghost" onClick={() => setOrdemSimulada(filaSalva.map((d) => d.id))}>
                  Simular nova ordem
                </button>
              )}
              {podeEditar && (
                <Link to={`/demandas/nova${ehMinha ? "" : `?fila=${donoId}`}`} className="btn btn-primary">
                  + Nova demanda
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
        {abas.length > 1 ? (
          <div className="seg" role="group" aria-label="Filas">
            {abas.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={a.id === donoId}
                onClick={() => setParams(a.id === user.uid ? {} : { fila: a.id })}
              >
                {a.nome}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        {editandoCapacidade ? (
          <form onSubmit={salvarCapacidade} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <label htmlFor="capacidade" style={{ margin: 0, fontWeight: 500 }}>
              Horas por dia útil:
            </label>
            <input id="capacidade" name="capacidade" type="number" step="0.5" min="0.5" max="24" defaultValue={capacidade} style={{ width: 80 }} autoFocus />
            <button type="submit" className="btn btn-primary btn-sm">
              Salvar
            </button>
          </form>
        ) : (
          <div style={{ fontSize: 13, color: "var(--color-gray)" }}>
            Capacidade: <b style={{ color: "var(--color-dark)" }}>{formatarHoras(capacidade)} por dia útil</b> · seg a sex · feriados nacionais descontados
            {podeEditar && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => setEditandoCapacidade(true)}
                  style={{ background: "none", border: "none", padding: 0, color: "var(--color-primary)", fontWeight: 600, fontSize: 13 }}
                >
                  alterar
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {ordemSimulada && (
        <div className="caixa-reuniao" style={{ marginTop: 16, padding: "14px 18px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 360px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#1f4f8f" }}>
              Modo simulação · nada foi salvo
            </div>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              {diferencas.length ? resumirImpacto(diferencas) : "Arraste as demandas (ou use as setas) para testar outra ordem."}
            </div>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setExportando(true)}>
            Exportar comparação
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setOrdemSimulada(null)}>
            Descartar
          </button>
          <button type="button" className="btn btn-primary" onClick={salvarSimulacao} disabled={!diferencas.length}>
            Salvar nova ordem
          </button>
        </div>
      )}

      <div className="demandas-colunas">
      <div className="demandas-principal">
      {!ordemSimulada && filaSalva.length > 0 && (
        <div className="tiles" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
          <div className="tile">
            <div className="tile-valor">{filaSalva.length}</div>
            <div className="tile-label">{filaSalva.length === 1 ? "demanda na fila" : "demandas na fila"}</div>
          </div>
          <div className="tile">
            <div className="tile-valor">{textoDias(previsao.diasUteisTotais)}</div>
            <div className="tile-label">para zerar a fila{fimDaFila ? ` · até ${formatarData(fimDaFila)}` : ""}</div>
          </div>
          <div className={`tile ${depoisDoPrazo.length ? "tile-alerta" : ""}`}>
            <div className="tile-valor">{depoisDoPrazo.length}</div>
            <div className="tile-label">previsão depois do prazo pedido</div>
          </div>
          {paradas.length > 0 && (
            <div className="tile tile-espera">
              <div className="tile-valor">{paradas.length}</div>
              <div className="tile-label">
                {paradas.length === 1 ? "parada aguardando retorno" : "paradas aguardando retorno"}
                {paradas.length === 1 ? ` · ${paradas[0].demanda.espera.de} ${(() => {
                  const n = diasDesde(paradas[0].demanda.espera.desde);
                  return n === 0 ? "desde hoje" : n === 1 ? "há 1 dia" : `há ${n} dias`;
                })()}` : ""}
              </div>
            </div>
          )}
        </div>
      )}

      {erro ? (
        <div className="empty-state" style={{ color: "var(--color-orange)" }}>Não deu pra carregar: {erro}</div>
      ) : filaExibida.length === 0 ? (
        <div className="lista-card empty-state" style={{ marginTop: 16 }}>
          {aguardando.length > 0 ? "Nenhuma demanda priorizada ainda. Priorize as que estão aguardando, ao lado." : "Nenhuma demanda na fila."}
          {podeEditar && (
            <div style={{ marginTop: 12 }}>
              <Link to={`/demandas/nova${ehMinha ? "" : `?fila=${donoId}`}`} className="btn btn-primary">
                + Nova demanda
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="lista-card" style={{ marginTop: 16, overflowX: "auto", borderColor: ordemSimulada ? "#c9dbf3" : undefined }}>
          <div className="fila-linha cabecalho">
            <span />
            <span>#</span>
            <span>Demanda</span>
            <span className="col-estimativa">Estimativa</span>
            <span>Pronta em</span>
            <span className="col-tempo semanas-tempo">
              {semanas.map((d) => (
                <span key={d.getTime()}>sem. {formatarData(d)}</span>
              ))}
            </span>
          </div>
          {previsao.itens.map((r, i) => {
            const d = r.demanda;
            // Em andamento: a primeira da fila que não está parada aguardando retorno.
            const andamento = i === previsao.itens.findIndex((x) => !x.esperando);
            const esperando = Boolean(r.esperando);
            const pausada = !andamento && !esperando && Number(d.horasFeitas) > 0;
            const prazo = d.prazoPedido ? inicioDoDia(paraDate(d.prazoPedido)) : null;
            const estoura = prazo && r.fim > prazo;
            const diasAlem = estoura ? Math.max(1, diasUteisEntre(prazo, r.fim)) : 0;
            const dif = difPorId[d.id];
            const colunas = colunasBarra(r);
            const classeBarra = andamento ? "andamento" : pausada ? "pausada" : estoura ? "risco" : "";
            const linkEditar = `/demandas/${donoId}/${d.id}`;
            return (
              <div
                key={d.id}
                className={`fila-linha ${andamento ? "andamento" : ""} ${esperando ? "esperando" : ""} ${arrastando === i ? "arrastando" : ""} ${alvo === i && (arrastandoNova || arrastando !== i) ? "alvo" : ""}`}
                draggable={podeEditar}
                onDragStart={(e) => {
                  setArrastando(i);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (arrastando === null && !arrastandoNova) return;
                  e.preventDefault();
                  setAlvo(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (arrastandoNova) {
                    soltarNova(i);
                    return;
                  }
                  if (arrastando !== null) reordenar(arrastando, i);
                  setArrastando(null);
                  setAlvo(null);
                }}
                onDragEnd={() => {
                  setArrastando(null);
                  setAlvo(null);
                }}
              >
                {podeEditar ? (
                  <>
                    <span className="alca-arrastar" title="Arraste para mudar a prioridade" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="9" cy="5" r="1.6" />
                        <circle cx="15" cy="5" r="1.6" />
                        <circle cx="9" cy="12" r="1.6" />
                        <circle cx="15" cy="12" r="1.6" />
                        <circle cx="9" cy="19" r="1.6" />
                        <circle cx="15" cy="19" r="1.6" />
                      </svg>
                    </span>
                    <span className="mover-setas">
                      <button type="button" onClick={() => reordenar(i, i - 1)} disabled={i === 0} aria-label={`Subir “${d.titulo}”`}>
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => reordenar(i, i + 1)}
                        disabled={i === previsao.itens.length - 1}
                        aria-label={`Descer “${d.titulo}”`}
                      >
                        ▼
                      </button>
                    </span>
                  </>
                ) : (
                  <span />
                )}
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-gray)", textAlign: "center" }}>{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <Link to={linkEditar} style={{ color: "inherit", display: "block" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>
                      {andamento && (
                        <span className="pill" style={{ background: "var(--color-primary)", color: "#fff", marginRight: 6 }}>
                          Em andamento
                        </span>
                      )}
                      {esperando && (
                        <span className="pill pill-espera" style={{ marginRight: 6 }}>
                          ⏸ Aguardando {d.espera.de} · {(() => {
                            const n = diasDesde(d.espera.desde);
                            return n === 0 ? "desde hoje" : n === 1 ? "há 1 dia" : `há ${n} dias`;
                          })()}
                        </span>
                      )}
                      {pausada && (
                        <span className="pill" style={{ background: "#eceeee", color: "var(--color-gray)", marginRight: 6 }}>
                          Pausada
                        </span>
                      )}
                      {d.titulo}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 2 }}>
                      {[
                        esperando && descreverPassoDaEspera(d),
                        esperando && d.espera.retornoPrevisto && `retorno previsto ${formatarData(d.espera.retornoPrevisto)}`,
                        d.solicitante && `Pedido por ${d.solicitante}`,
                        Number(d.horasFeitas) > 0 && `${formatarHoras(Number(d.horasFeitas))} feitas`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                  </Link>
                  {andamento && podeEditar && !ordemSimulada && (
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => concluir(d)}>
                        <IconeCheck size={14} /> Concluir
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => atualizarRestante(d)}>
                        Atualizar quanto falta
                      </button>
                    </div>
                  )}
                </div>
                <span className="col-estimativa" style={{ fontSize: 13, fontWeight: 600 }}>
                  {Number(d.horasFeitas) > 0 ? formatarHoras(horasRestantes(d)) : formatarEstimativa(d)}
                  <small style={{ display: "block", fontSize: 11, color: "var(--color-gray)", fontWeight: 500 }}>
                    {Number(d.horasFeitas) > 0 ? `restam de ${formatarEstimativa(d)}` : d.estimativaUnidade === "d" ? formatarHoras(Number(d.estimativaHoras)) : ""}
                  </small>
                </span>
                <span className="col-pronta" style={{ fontSize: 13, fontWeight: 700 }}>
                  {esperando ? (
                    <>
                      <span style={{ whiteSpace: "nowrap" }}>{r.fim ? `≈ ${formatarData(r.fim)}` : "—"}</span>
                      <small style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#8a5a00" }}>depende do retorno</small>
                    </>
                  ) : (
                  <>
                  <span style={{ whiteSpace: "nowrap" }}>{diasAte(r.fim) === 0 ? "Hoje" : formatarDataRelativa(r.fim)}</span>
                  {dif ? <span className={`impacto ${dif < 0 ? "antes" : "depois"}`}>{dif < 0 ? `${textoDias(dif)} antes` : `+${textoDias(dif)}`}</span> : null}
                  <small style={{ display: "block", fontSize: 11, fontWeight: 600, color: estoura ? "var(--color-orange)" : "var(--color-gray)" }}>
                    {prazo ? `pedido p/ ${formatarData(prazo)}${estoura ? ` · ${textoDias(diasAlem)} depois` : " · ok"}` : "sem prazo pedido"}
                  </small>
                  </>
                  )}
                </span>
                <span className="col-tempo linha-tempo" aria-hidden="true">
                  {esperando && (
                    <span
                      className="barra espera"
                      style={{ gridColumn: `1 / ${Math.min(r.iDiaRetorno ?? DIAS_LINHA_TEMPO, DIAS_LINHA_TEMPO) + 1}` }}
                      title={`Aguardando ${d.espera.de}`}
                    />
                  )}
                  {colunas && <span className={`barra ${classeBarra}`} style={{ gridColumn: colunas }} title={`${formatarData(r.inicio)} a ${formatarData(r.fim)}`} />}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {filaExibida.length > 0 && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 12, color: "var(--color-gray)" }}>
          <span>
            <span style={{ display: "inline-block", width: 14, height: 8, borderRadius: 3, background: "var(--color-primary)", verticalAlign: "middle" }} /> em andamento
          </span>
          <span>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 8,
                borderRadius: 3,
                background: "repeating-linear-gradient(45deg,#c9d6d4,#c9d6d4 3px,#e6eeed 3px,#e6eeed 6px)",
                verticalAlign: "middle",
              }}
            />{" "}
            pausada
          </span>
          <span>
            <span style={{ display: "inline-block", width: 14, height: 8, borderRadius: 3, background: "#f0a46a", verticalAlign: "middle" }} /> passa do
            prazo pedido
          </span>
          {paradas.length > 0 && (
            <span>
              <span className="barra-legenda-espera" /> aguardando retorno
            </span>
          )}
          <span>A linha do tempo mostra só dias úteis (sem fins de semana e feriados).</span>
        </div>
      )}

      {concluidas.length > 0 && !ordemSimulada && (
        <div className="lista-card" style={{ marginTop: 20, padding: "14px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Concluídas recentemente</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--color-gray)" }}>
            {concluidas.map((d) => (
              <Link key={d.id} to={`/demandas/${donoId}/${d.id}`} style={{ color: "inherit" }}>
                {d.titulo}
                {d.concluidaEm && ` · ${formatarData(d.concluidaEm)}`}
              </Link>
            ))}
          </div>
        </div>
      )}

      {arrastandoNova && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setAlvo("fim");
          }}
          onDrop={(e) => {
            e.preventDefault();
            soltarNova(filaSalva.length);
          }}
          style={{
            marginTop: 10,
            padding: 16,
            borderRadius: 12,
            border: `2px dashed ${alvo === "fim" ? "var(--color-primary)" : "var(--color-gray-light)"}`,
            textAlign: "center",
            fontSize: 13,
            color: "var(--color-gray)",
          }}
        >
          Solte aqui para colocar no fim da fila (ou sobre uma demanda para entrar no lugar dela)
        </div>
      )}
      </div>

      <AguardandoPriorizacao
        aguardando={aguardando}
        fila={filaSalva}
        capacidade={capacidade}
        podeEditar={podeEditar && !ordemSimulada}
        donoId={donoId}
        ordem={fila.ordem || []}
        onPriorizado={(msg, d, posicao, fim) => {
          setAviso(msg);
          avisarPriorizada(d, posicao, fim);
        }}
        onArrastar={setArrastandoNova}
      />
      </div>

      {exportando && (
        <ExportarFila
          fila={fila}
          previsao={previsao}
          comparacao={ordemSimulada ? { previsaoSalva, diferencas } : null}
          aguardando={aguardando}
          onFechar={() => setExportando(false)}
        />
      )}

      {aviso && (
        <div className="aviso-flutuante" role="status">
          {aviso}
        </div>
      )}
    </div>
  );
}
