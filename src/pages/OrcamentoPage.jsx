import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { formatarNumero, formatarReais, lerNumero } from "../lib/alocacoes";
import {
  anualDe,
  chaveGrupo,
  CLASSIFICACOES,
  linhasCondensadas,
  MESES,
  novoIdLinha,
  RESPONSAVEIS,
  TIPOS,
  totaisPorMes,
  agruparPorProjeto,
  agruparPor,
  atributosDaVersao,
  linhasParaAgrupar,
  versaoVigente,
} from "../lib/orcamentos";
import { baixarOrcamento } from "../lib/orcamentosExcel";
import { atualizarVersao, excluirVersao, salvarConteudo, watchConteudo, watchPlanejamento, watchVersao, watchVersoes } from "../lib/orcamentosDb";
import { dataBr, PillSituacao } from "./OrcamentosPage";

const rotulo = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--color-gray)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" };

export default function OrcamentoPage() {
  const { planejamentoId: pid, versaoId: vid } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [planejamento, setPlanejamento] = useState(undefined);
  const [versao, setVersao] = useState(undefined);
  const [versoes, setVersoes] = useState([]);
  const [conteudo, setConteudo] = useState(undefined);
  const [editandoDados, setEditandoDados] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");

  useEffect(() => watchPlanejamento(pid, setPlanejamento), [pid]);
  useEffect(() => watchVersao(pid, vid, setVersao), [pid, vid]);
  useEffect(() => watchVersoes(pid, setVersoes), [pid]);
  useEffect(() => watchConteudo(pid, vid, setConteudo), [pid, vid]);

  const condensadas = useMemo(() => (versao && conteudo ? linhasCondensadas(versao, conteudo) : []), [versao, conteudo]);

  if (planejamento === undefined || versao === undefined || conteudo === undefined) return <div className="spinner-wrap">Carregando...</div>;
  if (!planejamento || !versao || !conteudo) return <div className="spinner-wrap">Orçamento não encontrado (ou você não tem acesso).</div>;

  const podeEditar = ["proprietario", "editor"].includes(planejamento.membros?.[user.uid]);
  const ehCompleta = versao.visao === "completa";
  const aba = params.get("visao") === "agrupamentos" ? "agrupamentos" : !ehCompleta || params.get("visao") === "condensada" ? "condensada" : "completa";
  const vigente = versaoVigente(versoes);
  const substituida = versao.situacao === "efetivada" && vigente && vigente.id !== versao.id;

  async function salvar(novo) {
    setErroSalvar("");
    try {
      await salvarConteudo(pid, vid, versao, { ...conteudo, ...novo });
    } catch (e) {
      console.error(e);
      setErroSalvar("Não deu pra salvar a alteração. Confira a conexão e tente de novo.");
      throw e;
    }
  }

  // Visão completa: linhas por recurso.
  const salvarLinhaCompleta = (linha) => {
    const lista = conteudo.completa || [];
    const existe = lista.some((l) => l.id === linha.id);
    return salvar({ completa: existe ? lista.map((l) => (l.id === linha.id ? linha : l)) : [...lista, linha] });
  };
  const excluirLinhaCompleta = (id) => salvar({ completa: (conteudo.completa || []).filter((l) => l.id !== id) });

  // Visão condensada montada da completa: os campos extras ficam em "extras", pela chave do grupo.
  const salvarExtras = (linhaCond, valores) => {
    const extras = { ...(conteudo.extras || {}) };
    extras[linhaCond.chave] = { ...(extras[linhaCond.chave] || {}), ...valores };
    return salvar({ extras });
  };
  const salvarLinhaCondensada = (linha) => {
    const lista = conteudo.condensada || [];
    const existe = lista.some((l) => l.id === linha.id);
    return salvar({ condensada: existe ? lista.map((l) => (l.id === linha.id ? linha : l)) : [...lista, linha] });
  };
  const excluirLinhaCondensada = (id) => salvar({ condensada: (conteudo.condensada || []).filter((l) => l.id !== id) });

  return (
    <div className="page-shell" style={{ paddingTop: 24, paddingBottom: 80, maxWidth: 1280 }}>
      <Link to={`/orcamentos/${pid}`} style={{ fontSize: 13, fontWeight: 600 }}>
        ← Orçamento {planejamento.ano}
      </Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginTop: 14 }}>
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
            <PillSituacao situacao={versao.situacao} />
            {substituida && <span style={{ fontSize: 12, color: "var(--color-gray)" }}>(substituída pela {vigente.versao})</span>}
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>
            Orçamento {versao.ano} · {versao.versao}
          </h1>
          <div style={{ fontSize: 14, color: "var(--color-gray)", marginTop: 4 }}>
            Criado em {dataBr(versao.dataCriacao)} · cadastrado na visão {ehCompleta ? "completa" : "condensada"} ·{" "}
            {ehCompleta
              ? `${(conteudo.completa || []).length} ${(conteudo.completa || []).length === 1 ? "recurso" : "recursos"} → ${condensadas.length} ${condensadas.length === 1 ? "linha condensada" : "linhas condensadas"}`
              : `${condensadas.length} ${condensadas.length === 1 ? "linha" : "linhas"}`}
            {versao.observacao && ` · ${versao.observacao}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {podeEditar && (
            <button type="button" className="btn btn-ghost" onClick={() => setEditandoDados(!editandoDados)} aria-expanded={editandoDados}>
              Editar dados
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            disabled={baixando}
            onClick={async () => {
              setBaixando(true);
              try {
                await baixarOrcamento(versao, conteudo);
              } catch (e) {
                console.error(e);
                window.alert("Não deu pra gerar o Excel.");
              }
              setBaixando(false);
            }}
          >
            Baixar Excel
          </button>
          {podeEditar && (
            <Link to={`/orcamentos/novo?de=${pid}:${vid}`} className="btn btn-ghost">
              Nova versão a partir desta
            </Link>
          )}
        </div>
      </div>

      {editandoDados && (
        <EditorDados
          versao={versao}
          onCancelar={() => setEditandoDados(false)}
          onSalvar={async (dados) => {
            await atualizarVersao(pid, vid, dados);
            setEditandoDados(false);
          }}
          onExcluir={async () => {
            if (!window.confirm(`Excluir a versão ${versao.versao} do orçamento ${versao.ano}? Essa ação não pode ser desfeita.`)) return;
            await excluirVersao(pid, vid);
            navigate(`/orcamentos/${pid}`, { replace: true });
          }}
        />
      )}

      <div className="medicao-numeros">
        <div className="lista-card">
          <span style={{ fontSize: 12, color: "var(--color-gray)" }}>Total anual</span>
          <b>{formatarReais(versao.totalAnual || 0)}</b>
        </div>
        <div className="lista-card">
          <span style={{ fontSize: 12, color: "var(--color-gray)" }}>TI paga</span>
          <b>{formatarReais(versao.totalTI || 0)}</b>
        </div>
        <div className="lista-card">
          <span style={{ fontSize: 12, color: "var(--color-gray)" }}>Cliente paga</span>
          <b>{formatarReais(versao.totalCliente || 0)}</b>
        </div>
      </div>
      <div className="texto-ajuda">
        O “Baixar Excel” traz a aba Condensada{ehCompleta ? " e, como este orçamento foi cadastrado na completa, também a aba Completa" : ""}.
        {!ehCompleta && " Em “TI paga” e “Cliente paga” conta o Responsável orçamento de cada linha."}
      </div>
      {erroSalvar && (
        <div className="texto-alerta" role="alert" style={{ fontSize: 13, marginTop: 10 }}>
          {erroSalvar}
        </div>
      )}

      <nav className="abas-contrato" aria-label="Visões do orçamento">
        {ehCompleta && (
          <Link to="?" replace aria-current={aba === "completa" ? "page" : undefined} onClick={(e) => (e.preventDefault(), setParams({}, { replace: true }))}>
            Visão completa · {(conteudo.completa || []).length}
          </Link>
        )}
        <Link to="?visao=condensada" replace aria-current={aba === "condensada" ? "page" : undefined} onClick={(e) => (e.preventDefault(), setParams({ visao: "condensada" }, { replace: true }))}>
          Visão condensada · {condensadas.length}
        </Link>
        <Link to="?visao=agrupamentos" replace aria-current={aba === "agrupamentos" ? "page" : undefined} onClick={(e) => (e.preventDefault(), setParams({ visao: "agrupamentos" }, { replace: true }))}>
          Agrupamentos
        </Link>
      </nav>

      {aba === "agrupamentos" ? (
        <AbaAgrupamentos versao={versao} conteudo={conteudo} />
      ) : aba === "completa" ? (
        <TabelaCompleta linhas={conteudo.completa || []} podeEditar={podeEditar} onSalvar={salvarLinhaCompleta} onExcluir={excluirLinhaCompleta} />
      ) : (
        <TabelaCondensada
          linhas={condensadas}
          daCompleta={ehCompleta}
          podeEditar={podeEditar}
          onSalvarExtras={salvarExtras}
          onSalvar={salvarLinhaCondensada}
          onExcluir={excluirLinhaCondensada}
        />
      )}
    </div>
  );
}

function EditorDados({ versao, onSalvar, onCancelar, onExcluir }) {
  const [nome, setNome] = useState(versao.versao);
  const [data, setData] = useState(versao.dataCriacao || "");
  const [situacao, setSituacao] = useState(versao.situacao);
  const [obs, setObs] = useState(versao.observacao || "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  async function salvar(e) {
    e.preventDefault();
    if (!nome.trim()) return setErro("Dê um nome para a versão.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro("Escolha a data de criação.");
    setSalvando(true);
    try {
      await onSalvar({ versao: nome.trim(), dataCriacao: data, situacao, observacao: obs.trim() });
    } catch (err) {
      console.error(err);
      setErro("Não deu pra salvar.");
      setSalvando(false);
    }
  }
  return (
    <form className="lista-card" style={{ marginTop: 14, padding: "16px 18px" }} onSubmit={salvar} aria-label="Editar dados da versão">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ flex: "0 1 150px", margin: 0 }}>
          <span style={rotulo}>Versão</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} />
        </label>
        <label style={{ flex: "0 1 180px", margin: 0 }}>
          <span style={rotulo}>Data de criação</span>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <div>
          <span style={rotulo}>Situação</span>
          <div className="chips-row" role="group" aria-label="Situação" style={{ minHeight: 40, alignItems: "center" }}>
            <button type="button" className="chip" aria-pressed={situacao === "planejamento"} onClick={() => setSituacao("planejamento")}>
              Planejamento
            </button>
            <button type="button" className="chip" aria-pressed={situacao === "efetivada"} onClick={() => setSituacao("efetivada")}>
              Efetivada
            </button>
          </div>
        </div>
        <label style={{ flex: "1 1 220px", margin: 0 }}>
          <span style={rotulo}>Observação</span>
          <input value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} />
        </label>
      </div>
      {erro && (
        <div className="texto-alerta" role="alert" style={{ fontSize: 13, marginTop: 8 }}>
          {erro}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--color-orange)", borderColor: "var(--color-orange-border)" }} onClick={onExcluir}>
          Excluir versão
        </button>
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
            Salvar
          </button>
        </span>
      </div>
    </form>
  );
}

// ---------- Pedaços comuns das duas visões ----------

// Barrinhas de jan a dez (só para ver em que meses o valor cai).
function MiniGrafico({ meses }) {
  const mx = Math.max(...(meses || []).map((v) => Number(v) || 0), 0) || 1;
  return (
    <span className="mini-grafico" aria-hidden="true">
      {(meses || []).map((v, i) => (
        <span key={i} style={{ height: Math.max(2, Math.round(((Number(v) || 0) / mx) * 22)), background: v ? "var(--color-brand)" : "var(--color-border)" }} />
      ))}
    </span>
  );
}

const mil = (v) => (v ? `${formatarNumero(v / 1000, (v / 1000) % 1 ? 2 : 0)}k` : "—");

function SeletorVisualizacao({ modo, onModo }) {
  return (
    <>
      <span style={{ fontSize: 13, color: "var(--color-gray)" }}>Ver:</span>
      <button type="button" className="chip" aria-pressed={modo === "resumo"} onClick={() => onModo("resumo")}>
        Resumo
      </button>
      <button type="button" className="chip" aria-pressed={modo === "mes"} onClick={() => onModo("mes")}>
        Por mês
      </button>
    </>
  );
}

// Lista só com os valores: meses em milhares (para caber) e o anual completo.
function LinhaPorMes({ l, titulo, sub, recuo }) {
  return (
    <tr>
      <td className={recuo ? "recuo-grupo" : undefined}>
        <div style={{ fontWeight: 700 }}>{titulo(l) || "—"}</div>
        <div className="sub">{sub(l)}</div>
      </td>
      {(l.meses || []).map((v, j) => (
        <td key={j} className="num mes">
          {mil(v)}
        </td>
      ))}
      <td className="num">
        <b>{formatarReais(anualDe(l))}</b>
      </td>
    </tr>
  );
}

// Linha de título do projeto: clica para recolher/abrir.
function BotaoGrupo({ g, aberto, onAlternar }) {
  return (
    <button type="button" className="botao-grupo" onClick={onAlternar} aria-expanded={aberto}>
      <span className="seta">{aberto ? "▾" : "▸"}</span>
      {g.semProjeto ? <i>Sem projeto</i> : <b>{g.nome}</b>}
      <span className="qtd">
        {g.linhas.length} {g.linhas.length === 1 ? "linha" : "linhas"}
      </span>
    </button>
  );
}

function TabelaPorMes({ linhas, titulo, sub, rotuloPrimeira, grupos, recolhidos, onAlternar }) {
  const tot = totaisPorMes(linhas);
  return (
    <div className="lista-card">
      <table className="tabela-med tabela-orc2">
        <thead>
          <tr>
            <th>{rotuloPrimeira}</th>
            {MESES.map((m) => (
              <th key={m} className="num mes">
                {m}
              </th>
            ))}
            <th className="num">Anual</th>
          </tr>
        </thead>
        <tbody>
          {grupos
            ? grupos.map((g) => {
                const aberto = !recolhidos.has(g.chave);
                return [
                  <tr key={`g-${g.chave}`} className="linha-grupo">
                    <td>
                      <BotaoGrupo g={g} aberto={aberto} onAlternar={() => onAlternar(g.chave)} />
                    </td>
                    {g.meses.map((v, j) => (
                      <td key={j} className="num mes">
                        <b>{mil(v)}</b>
                      </td>
                    ))}
                    <td className="num">
                      <b>{formatarReais(g.anual)}</b>
                    </td>
                  </tr>,
                  ...(aberto ? g.linhas.map((l, i) => <LinhaPorMes key={l.id || l.chave || `${g.chave}-${i}`} l={l} titulo={titulo} sub={sub} recuo />) : []),
                ];
              })
            : linhas.map((l, i) => <LinhaPorMes key={l.id || l.chave || i} l={l} titulo={titulo} sub={sub} />)}
          {linhas.length > 0 && (
            <tr className="total">
              <td>Total</td>
              {tot.meses.map((v, j) => (
                <td key={j} className="num mes">
                  {mil(v)}
                </td>
              ))}
              <td className="num">{formatarReais(tot.anual)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Visão completa ----------

function TabelaCompleta({ linhas, podeEditar, onSalvar, onExcluir }) {
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState("resumo");
  const [agrupamento, setAgrupamento] = useState("");
  const [tiPaga, setTiPaga] = useState("");
  const [aberta, setAberta] = useState(null); // id da linha aberta ou "nova"
  const agrupamentos = [...new Set(linhas.map((l) => l.agrupamento).filter(Boolean))].sort();
  const termo = busca.trim().toLowerCase();
  const visiveis = linhas.filter(
    (l) =>
      (!termo || [l.item, l.pessoa, l.projeto, l.fornecedor, l.linha, l.agrupamento, l.tipo].some((x) => String(x || "").toLowerCase().includes(termo))) &&
      (!agrupamento || l.agrupamento === agrupamento) &&
      (!tiPaga || (tiPaga === "sim" ? l.tiPaga : !l.tiPaga))
  );
  const tot = totaisPorMes(visiveis);
  const sugestoes = {
    projeto: [...new Set(linhas.map((l) => l.projeto).filter(Boolean))],
    fornecedor: [...new Set(linhas.map((l) => l.fornecedor).filter(Boolean))],
    linha: [...new Set(linhas.map((l) => l.linha).filter(Boolean))],
    agrupamento: agrupamentos,
  };
  const COLS = 8;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", margin: "14px 0 8px", flexWrap: "wrap" }}>
        <div className="chips-row" style={{ alignItems: "center" }}>
          <SeletorVisualizacao modo={modo} onModo={setModo} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item, pessoa, linha…" aria-label="Buscar" style={{ width: 220, padding: "7px 12px" }} />
          <select value={agrupamento} onChange={(e) => setAgrupamento(e.target.value)} aria-label="Filtrar por agrupamento" style={{ width: "auto", borderRadius: 17, padding: "7px 12px", fontSize: 13 }}>
            <option value="">Todos os agrupamentos</option>
            {agrupamentos.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select value={tiPaga} onChange={(e) => setTiPaga(e.target.value)} aria-label="Filtrar por TI paga" style={{ width: "auto", borderRadius: 17, padding: "7px 12px", fontSize: 13 }}>
            <option value="">TI paga: todos</option>
            <option value="sim">TI paga: sim</option>
            <option value="nao">TI paga: não</option>
          </select>
        </div>
        {podeEditar && modo === "resumo" && (
          <button type="button" className="link-botao" onClick={() => setAberta("nova")}>
            + Nova linha
          </button>
        )}
      </div>

      {modo === "mes" ? (
        <TabelaPorMes linhas={visiveis} rotuloPrimeira="Item · Linha" titulo={(l) => l.item} sub={(l) => [l.linha, l.projeto].filter(Boolean).join(" · ")} />
      ) : (
        <div className="lista-card">
          <table className="tabela-med tabela-orc2">
            <thead>
              <tr>
                <th>Item · Pessoa</th>
                <th>Linha · Projeto · Fornecedor</th>
                <th>TI paga?</th>
                <th>Quem paga → se beneficia</th>
                <th className="num">Unitário × qtd</th>
                <th className="so-largo">Jan → Dez</th>
                <th className="num">Anual</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {aberta === "nova" && (
                <tr>
                  <td colSpan={COLS} className="editor">
                    <EditorLinhaCompleta linha={null} sugestoes={sugestoes} onCancelar={() => setAberta(null)} onSalvar={async (l) => (await onSalvar(l), setAberta(null))} />
                  </td>
                </tr>
              )}
              {visiveis.length === 0 && aberta !== "nova" && (
                <tr>
                  <td colSpan={COLS} style={{ color: "var(--color-gray)" }}>
                    {linhas.length ? "Nenhuma linha com esses filtros." : "Nenhuma linha ainda."}
                  </td>
                </tr>
              )}
              {visiveis.map((l) => {
                const estaAberta = aberta === l.id;
                return [
                  <tr key={l.id} className={estaAberta ? "aberta" : ""}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{l.item || "—"}</div>
                      <div className="sub">{[l.pessoa, l.agrupamento, l.tipo].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{l.linha || "—"}</div>
                      <div className="sub">{[l.projeto, l.fornecedor].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td>
                      {l.tiPaga ? (
                        <span className="pill" style={{ background: "#e0f5ef", color: "var(--color-primary-dark)" }}>
                          TI paga
                        </span>
                      ) : (
                        <span className="pill" style={{ background: "#eceeee", color: "var(--color-gray)" }}>
                          Não
                        </span>
                      )}
                    </td>
                    <td>{[l.quemPaga, l.quemSeBeneficia].some(Boolean) ? `${l.quemPaga || "—"} → ${l.quemSeBeneficia || "—"}` : "—"}</td>
                    <td className="num">
                      <div>{l.valorUnitario != null ? formatarNumero(l.valorUnitario) : "—"}</div>
                      {l.quantidade != null && <div className="sub">× {formatarNumero(l.quantidade, l.quantidade % 1 ? 2 : 0)}</div>}
                    </td>
                    <td className="so-largo">
                      <MiniGrafico meses={l.meses} />
                    </td>
                    <td className="num">
                      <b style={{ fontSize: 14 }}>{formatarReais(anualDe(l))}</b>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button type="button" className="link-botao" onClick={() => setAberta(estaAberta ? null : l.id)} aria-expanded={estaAberta}>
                        {estaAberta ? "Fechar ▴" : "Abrir ▾"}
                      </button>
                    </td>
                  </tr>,
                  estaAberta && (
                    <tr key={`${l.id}-aberta`}>
                      <td colSpan={COLS} className="editor">
                        {podeEditar ? (
                          <EditorLinhaCompleta
                            linha={l}
                            sugestoes={sugestoes}
                            onCancelar={() => setAberta(null)}
                            onSalvar={async (nova) => (await onSalvar(nova), setAberta(null))}
                            onExcluir={async () => {
                              if (!window.confirm(`Excluir a linha “${l.item || "sem nome"}”?`)) return;
                              await onExcluir(l.id);
                              setAberta(null);
                            }}
                          />
                        ) : (
                          <MesesSoLeitura meses={l.meses} />
                        )}
                      </td>
                    </tr>
                  ),
                ];
              })}
              {visiveis.length > 0 && (
                <tr className="total">
                  <td colSpan={6}>Total{visiveis.length !== linhas.length ? " (filtrado)" : ""}</td>
                  <td className="num">
                    <b style={{ fontSize: 14 }}>{formatarReais(tot.anual)}</b>
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="texto-ajuda">
        {modo === "mes" ? "Os meses estão em milhares (k) para caber; o anual vem completo." : "“Abrir” mostra e edita todos os campos, inclusive os 12 meses. Mudar uma linha aqui atualiza a visão condensada."}
      </div>
    </>
  );
}

function MesesSoLeitura({ meses }) {
  return (
    <div className="grade-meses">
      {MESES.map((m, i) => (
        <div key={m} className="mes-cartao">
          <span>{m}</span>
          <b>{meses?.[i] ? formatarNumero(meses[i]) : "—"}</b>
        </div>
      ))}
    </div>
  );
}

const textoMes = (v) => (v ? formatarNumero(v) : "");

function EditorLinhaCompleta({ linha, sugestoes, onSalvar, onCancelar, onExcluir }) {
  const [l, setL] = useState(() => ({
    agrupamento: "",
    tipo: "",
    item: "",
    pessoa: "",
    tiPaga: true,
    quemPaga: "",
    quemSeBeneficia: "",
    projeto: "",
    fornecedor: "",
    linha: "",
    ...(linha || {}),
    valorUnitario: linha?.valorUnitario != null ? formatarNumero(linha.valorUnitario) : "",
    quantidade: linha?.quantidade != null ? String(linha.quantidade).replace(".", ",") : "",
    meses: (linha?.meses || Array(12).fill(0)).map(textoMes),
  }));
  const [de, setDe] = useState(0);
  const [ate, setAte] = useState(11);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const mudar = (m) => setL({ ...l, ...m });
  const meses = l.meses.map((v) => lerNumero(v) || 0);
  const anual = meses.reduce((s, v) => s + Math.round(v * 100), 0) / 100;
  const id = (c) => `ed-${linha?.id || "nova"}-${c}`;

  function preencher() {
    const v = (lerNumero(l.valorUnitario) || 0) * (lerNumero(l.quantidade) || 0);
    const r = Math.round(v * 100) / 100;
    mudar({ meses: l.meses.map((x, i) => (i >= de && i <= ate ? textoMes(r) : x)) });
  }

  async function salvar() {
    setErro("");
    if (!String(l.item).trim()) return setErro("Escreva o item.");
    setSalvando(true);
    try {
      await onSalvar({
        id: linha?.id || novoIdLinha(),
        agrupamento: l.agrupamento.trim(),
        tipo: l.tipo.trim(),
        item: l.item.trim(),
        pessoa: l.pessoa.trim(),
        tiPaga: Boolean(l.tiPaga),
        quemPaga: l.quemPaga.trim(),
        quemSeBeneficia: l.quemSeBeneficia.trim(),
        valorUnitario: lerNumero(l.valorUnitario),
        quantidade: lerNumero(l.quantidade),
        meses,
        projeto: l.projeto.trim(),
        fornecedor: l.fornecedor.trim(),
        linha: l.linha.trim(),
      });
    } catch {
      setSalvando(false);
    }
  }

  const campo = (chave, titulo, lista) => (
    <label>
      <span style={rotulo}>{titulo}</span>
      <input value={l[chave]} onChange={(e) => mudar({ [chave]: e.target.value })} list={lista ? id(chave) : undefined} />
      {lista && (
        <datalist id={id(chave)}>
          {lista.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </label>
  );

  return (
    <div role="group" aria-label={linha ? `Editar linha ${linha.item}` : "Nova linha"}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{linha ? `Editar linha · ${linha.item}` : "Nova linha"}</div>
      <div className="grade-campos">
        {campo("agrupamento", "Agrupamento", sugestoes.agrupamento)}
        {campo("tipo", "Tipo")}
        {campo("item", "Item")}
        {campo("pessoa", "Pessoa")}
        <label>
          <span style={rotulo}>TI paga?</span>
          <select value={l.tiPaga ? "sim" : "nao"} onChange={(e) => mudar({ tiPaga: e.target.value === "sim" })}>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </label>
        {campo("quemPaga", "Quem paga")}
        {campo("quemSeBeneficia", "Quem se beneficia")}
        <span />
        <label>
          <span style={rotulo}>Valor unitário</span>
          <input value={l.valorUnitario} onChange={(e) => mudar({ valorUnitario: e.target.value })} inputMode="decimal" />
        </label>
        <label>
          <span style={rotulo}>Quantidade</span>
          <input value={l.quantidade} onChange={(e) => mudar({ quantidade: e.target.value })} inputMode="decimal" />
        </label>
        <div style={{ gridColumn: "span 2" }}>
          <span style={rotulo}>Preencher meses</span>
          <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <select value={de} onChange={(e) => setDe(Number(e.target.value))} aria-label="De" style={{ width: "auto" }}>
              {MESES.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
            até
            <select value={ate} onChange={(e) => setAte(Number(e.target.value))} aria-label="Até" style={{ width: "auto" }}>
              {MESES.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-ghost btn-sm" onClick={preencher}>
              = unitário × quantidade
            </button>
          </span>
        </div>
      </div>
      <div className="grade-meses" style={{ marginTop: 10 }}>
        {MESES.map((m, i) => (
          <label key={m}>
            <span style={{ ...rotulo, fontSize: 10 }}>{m}</span>
            <input value={l.meses[i]} onChange={(e) => mudar({ meses: l.meses.map((x, j) => (j === i ? e.target.value : x)) })} inputMode="decimal" aria-label={`Valor de ${m}`} />
          </label>
        ))}
      </div>
      <div className="texto-ajuda">
        Valor anual: <b>{formatarReais(anual)}</b> (soma dos meses).
      </div>
      <div className="grade-campos" style={{ marginTop: 10 }}>
        {campo("projeto", "Projeto", sugestoes.projeto)}
        {campo("fornecedor", "Fornecedor", sugestoes.fornecedor)}
        {campo("linha", "Linha", sugestoes.linha)}
      </div>
      {erro && (
        <div className="texto-alerta" role="alert" style={{ fontSize: 13, marginTop: 8 }}>
          {erro}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 12, maxWidth: 1000, flexWrap: "wrap" }}>
        <span>
          {onExcluir && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--color-orange)", borderColor: "var(--color-orange-border)" }} onClick={onExcluir}>
              Excluir linha
            </button>
          )}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar linha"}
          </button>
        </span>
      </div>
    </div>
  );
}

// ---------- Visão condensada ----------

const CORES_TIPO = { Projeto: "#e3eefc", Licenciamento: "#f1e8fb", "Serviço/sustentação": "#e0f5ef", MOP: "#fdf1d8" };

function Etiqueta({ texto, cor }) {
  if (!texto) return <span style={{ color: "var(--color-gray)" }}>—</span>;
  return (
    <span className="pill" style={{ background: cor || "#eceeee", color: "var(--color-dark)" }}>
      {texto}
    </span>
  );
}

function TabelaCondensada({ linhas, daCompleta, podeEditar, onSalvarExtras, onSalvar, onExcluir }) {
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState("resumo");
  const [aberta, setAberta] = useState(null); // chave/id da linha aberta ou "nova"
  const termo = busca.trim().toLowerCase();
  const visiveis = linhas.filter((l) => !termo || [l.linha, l.projeto, l.fornecedor, l.odi, l.diretoria, l.area].some((x) => String(x || "").toLowerCase().includes(termo)));
  const tot = totaisPorMes(visiveis);
  const idDe = (l) => l.id || l.chave;
  const COLS = 8;
  const grupos = useMemo(() => agruparPorProjeto(visiveis), [visiveis]);
  const [recolhidos, setRecolhidos] = useState(() => new Set());
  // Na busca, mostra tudo o que achou, mesmo nos projetos recolhidos.
  const estaRecolhido = (chave) => !termo && recolhidos.has(chave);
  const alternar = (chave) =>
    setRecolhidos((r) => {
      const n = new Set(r);
      if (n.has(chave)) n.delete(chave);
      else n.add(chave);
      return n;
    });
  const todosRecolhidos = grupos.length > 0 && grupos.every((g) => recolhidos.has(g.chave));
  const subDaLinha = (l) =>
    [l.fornecedor, daCompleta && l.qtdRecursos ? `${l.qtdRecursos} ${l.qtdRecursos === 1 ? "recurso" : "recursos"}` : null].filter(Boolean).join(" · ");

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", margin: "14px 0 8px", flexWrap: "wrap" }}>
        <div className="chips-row" style={{ alignItems: "center" }}>
          <SeletorVisualizacao modo={modo} onModo={setModo} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar linha, projeto, ODI…" aria-label="Buscar" style={{ width: 240, padding: "7px 12px" }} />
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {grupos.length > 1 && !termo && (
            <button type="button" className="link-botao" onClick={() => setRecolhidos(todosRecolhidos ? new Set() : new Set(grupos.map((g) => g.chave)))}>
              {todosRecolhidos ? "Abrir todos" : "Recolher todos"}
            </button>
          )}
          {!daCompleta && podeEditar && modo === "resumo" && (
            <button type="button" className="link-botao" onClick={() => setAberta("nova")}>
              + Nova linha
            </button>
          )}
        </div>
      </div>

      {modo === "mes" ? (
        <TabelaPorMes
          linhas={visiveis}
          rotuloPrimeira="Projeto › Linha · Fornecedor"
          titulo={(l) => l.linha}
          sub={subDaLinha}
          grupos={grupos}
          recolhidos={termo ? new Set() : recolhidos}
          onAlternar={alternar}
        />
      ) : (
        <div className="lista-card">
          <table className="tabela-med tabela-orc2">
            <thead>
              <tr>
                <th>Projeto › Linha · Fornecedor</th>
                <th>ODI</th>
                <th>Tipo</th>
                <th>Classificação</th>
                <th>Resp.</th>
                <th className="so-largo">Jan → Dez</th>
                <th className="num">Anual</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {aberta === "nova" && (
                <tr>
                  <td colSpan={COLS} className="editor">
                    <EditorCondensada linha={null} daCompleta={false} onCancelar={() => setAberta(null)} onSalvar={async (l) => (await onSalvar(l), setAberta(null))} />
                  </td>
                </tr>
              )}
              {visiveis.length === 0 && aberta !== "nova" && (
                <tr>
                  <td colSpan={COLS} style={{ color: "var(--color-gray)" }}>
                    {linhas.length ? "Nenhuma linha com essa busca." : "Nenhuma linha ainda."}
                  </td>
                </tr>
              )}
              {grupos.map((g) => {
                const aberto = !estaRecolhido(g.chave);
                return [
                  <tr key={`g-${g.chave}`} className="linha-grupo">
                    <td colSpan={5}>
                      <BotaoGrupo g={g} aberto={aberto} onAlternar={() => alternar(g.chave)} />
                    </td>
                    <td className="so-largo">
                      <MiniGrafico meses={g.meses} />
                    </td>
                    <td className="num">
                      <b style={{ fontSize: 14 }}>{formatarReais(g.anual)}</b>
                    </td>
                    <td />
                  </tr>,
                  ...(aberto ? g.linhas : []).map((l) => {
                const estaAberta = aberta === idDe(l);
                return [
                  <tr key={idDe(l)} className={estaAberta ? "aberta" : ""}>
                    <td className="recuo-grupo">
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{l.linha || "—"}</div>
                      <div className="sub">{subDaLinha(l)}</div>
                    </td>
                    <td>{l.odi || <span style={{ color: "var(--color-gray)" }}>—</span>}</td>
                    <td>
                      <Etiqueta texto={l.tipo} cor={CORES_TIPO[l.tipo]} />
                    </td>
                    <td>
                      <Etiqueta texto={l.classificacao} />
                    </td>
                    <td>{l.responsavel || "—"}</td>
                    <td className="so-largo">
                      <MiniGrafico meses={l.meses} />
                    </td>
                    <td className="num">
                      <b style={{ fontSize: 14 }}>{formatarReais(l.anual ?? anualDe(l))}</b>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button type="button" className="link-botao" onClick={() => setAberta(estaAberta ? null : idDe(l))} aria-expanded={estaAberta}>
                        {estaAberta ? "Fechar ▴" : "Abrir ▾"}
                      </button>
                    </td>
                  </tr>,
                  estaAberta && (
                    <tr key={`${idDe(l)}-aberta`}>
                      <td colSpan={COLS} className="editor">
                        <EditorCondensada
                          linha={l}
                          daCompleta={daCompleta}
                          somenteLeitura={!podeEditar}
                          onCancelar={() => setAberta(null)}
                          onSalvar={async (nova) => {
                            if (daCompleta) await onSalvarExtras(l, nova);
                            else await onSalvar(nova);
                            setAberta(null);
                          }}
                          onExcluir={
                            daCompleta
                              ? null
                              : async () => {
                                  if (!window.confirm(`Excluir a linha ${l.linha || l.projeto}?`)) return;
                                  await onExcluir(l.id);
                                  setAberta(null);
                                }
                          }
                        />
                      </td>
                    </tr>
                  ),
                ];
                  }),
                ];
              })}
              {visiveis.length > 0 && (
                <tr className="total">
                  <td colSpan={6}>
                    Total · {visiveis.length} {visiveis.length === 1 ? "linha" : "linhas"}
                    {visiveis.length !== linhas.length ? " (filtrado)" : ""}
                  </td>
                  <td className="num">
                    <b style={{ fontSize: 14 }}>{formatarReais(tot.anual)}</b>
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="texto-ajuda">
        {modo === "mes"
          ? "Agrupado por projeto, com o subtotal de cada mês na linha do projeto. Os meses estão em milhares (k) para caber; o anual vem completo."
          : `Agrupado por projeto; clique no projeto para recolher ou abrir. “Abrir” mostra os 12 meses e os outros campos (capex, diretoria, área) para editar. Nenhum campo é obrigatório.${daCompleta ? " Os valores vêm da visão completa, somando por Projeto + Fornecedor + Linha." : ""}`}
      </div>
    </>
  );
}

// Meses (editáveis só na versão cadastrada direto na condensada) e campos da condensada.
function EditorCondensada({ linha, daCompleta, somenteLeitura, onSalvar, onCancelar, onExcluir }) {
  const [l, setL] = useState(() => ({
    projeto: "",
    fornecedor: "",
    linha: "",
    odi: "",
    tipo: "",
    classificacao: "",
    diretoria: "",
    area: "",
    responsavel: "",
    ...(linha || {}),
    capexAnoAnterior: linha?.capexAnoAnterior != null && linha.capexAnoAnterior !== "" ? formatarNumero(linha.capexAnoAnterior) : "",
    meses: (linha?.meses || Array(12).fill(0)).map(textoMes),
  }));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const mudar = (m) => setL({ ...l, ...m });
  const meses = l.meses.map((v) => lerNumero(v) || 0);
  const anual = meses.reduce((s, v) => s + Math.round(v * 100), 0) / 100;

  async function salvar() {
    setErro("");
    if (!daCompleta && !String(l.linha).trim() && !String(l.projeto).trim()) return setErro("Escreva ao menos a linha ou o projeto.");
    setSalvando(true);
    const extras = {
      odi: String(l.odi || "").trim(),
      capexAnoAnterior: lerNumero(l.capexAnoAnterior),
      tipo: l.tipo,
      classificacao: l.classificacao,
      diretoria: String(l.diretoria || "").trim(),
      area: String(l.area || "").trim(),
      responsavel: l.responsavel,
    };
    try {
      if (daCompleta) await onSalvar(extras);
      else {
        const nova = { id: linha?.id || novoIdLinha(), projeto: String(l.projeto).trim(), fornecedor: String(l.fornecedor).trim(), linha: String(l.linha).trim(), meses, ...extras };
        await onSalvar({ ...nova, chave: chaveGrupo(nova) });
      }
    } catch {
      setSalvando(false);
    }
  }

  const texto = (chave, titulo) => (
    <label>
      <span style={rotulo}>{titulo}</span>
      <input value={l[chave] ?? ""} onChange={(e) => mudar({ [chave]: e.target.value })} disabled={somenteLeitura} />
    </label>
  );
  const lista = (chave, titulo, opcoes) => (
    <label>
      <span style={rotulo}>{titulo}</span>
      <select value={l[chave] || ""} onChange={(e) => mudar({ [chave]: e.target.value })} disabled={somenteLeitura}>
        <option value="">—</option>
        {opcoes.map((o) => (
          <option key={o}>{o}</option>
        ))}
        {l[chave] && !opcoes.includes(l[chave]) && <option>{l[chave]}</option>}
      </select>
    </label>
  );

  return (
    <div role="group" aria-label={linha ? `Linha ${linha.linha || linha.projeto}` : "Nova linha condensada"}>
      {!daCompleta && (
        <div className="grade-campos" style={{ marginBottom: 10 }}>
          {texto("linha", "Linha")}
          {texto("projeto", "Projeto")}
          {texto("fornecedor", "Fornecedor")}
        </div>
      )}
      {daCompleta || somenteLeitura ? (
        <MesesSoLeitura meses={linha?.meses} />
      ) : (
        <>
          <div className="grade-meses">
            {MESES.map((m, i) => (
              <label key={m}>
                <span style={{ ...rotulo, fontSize: 10 }}>{m}</span>
                <input value={l.meses[i]} onChange={(e) => mudar({ meses: l.meses.map((x, j) => (j === i ? e.target.value : x)) })} inputMode="decimal" aria-label={`Valor de ${m}`} />
              </label>
            ))}
          </div>
          <div className="texto-ajuda">
            Valor anual: <b>{formatarReais(anual)}</b>.
          </div>
        </>
      )}
      <div className="grade-campos" style={{ marginTop: 12 }}>
        {texto("odi", "ODI")}
        <label>
          <span style={rotulo}>Capex ano anterior</span>
          <input value={l.capexAnoAnterior} onChange={(e) => mudar({ capexAnoAnterior: e.target.value })} inputMode="decimal" placeholder="R$ 0,00" disabled={somenteLeitura} />
        </label>
        {lista("tipo", "Tipo", TIPOS)}
        {lista("classificacao", "Classificação", CLASSIFICACOES)}
        {texto("diretoria", "Diretoria")}
        {texto("area", "Área atendida")}
        {lista("responsavel", "Responsável orçamento", RESPONSAVEIS)}
      </div>
      {daCompleta && <div className="texto-ajuda">Todos os campos são opcionais. Os valores por mês vêm da visão completa{linha?.qtdRecursos ? ` (${linha.qtdRecursos} ${linha.qtdRecursos === 1 ? "recurso" : "recursos"})` : ""}.</div>}
      {erro && (
        <div className="texto-alerta" role="alert" style={{ fontSize: 13, marginTop: 8 }}>
          {erro}
        </div>
      )}
      {!somenteLeitura && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 12, maxWidth: 1000 }}>
          <span>
            {onExcluir && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--color-orange)", borderColor: "var(--color-orange-border)" }} onClick={onExcluir}>
                Excluir linha
              </button>
            )}
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelar}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

// ---------- Agrupamentos ----------

const NOMES_GRUPO = {
  agrupamento: ["agrupamento", "agrupamentos"],
  tipoItem: ["tipo", "tipos"],
  item: ["item", "itens"],
  pessoa: ["pessoa", "pessoas"],
  tiPaga: ["resposta", "respostas"],
  quemPaga: ["pagador", "pagadores"],
  quemSeBeneficia: ["beneficiado", "beneficiados"],
  projeto: ["projeto", "projetos"],
  fornecedor: ["fornecedor", "fornecedores"],
  linha: ["linha", "linhas"],
  odi: ["ODI", "ODIs"],
  tipoLinha: ["tipo", "tipos"],
  classificacao: ["classificação", "classificações"],
  diretoria: ["diretoria", "diretorias"],
  area: ["área", "áreas"],
  responsavel: ["responsável", "responsáveis"],
};
const CHAVE_AGRUPAR = "lembrei:agrupamentos";

function lerEscolhidos() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_AGRUPAR) || "null");
    return Array.isArray(v) ? v : ["projeto"];
  } catch {
    return ["projeto"];
  }
}

function AbaAgrupamentos({ versao, conteudo }) {
  const atributos = atributosDaVersao(versao);
  const [escolhidosTodos, setEscolhidos] = useState(lerEscolhidos);
  const [modo, setModo] = useState("resumo");
  const [recolhidos, setRecolhidos] = useState(() => new Set());
  const escolhidos = escolhidosTodos.filter((k) => atributos.some((a) => a.chave === k));
  const linhas = useMemo(() => linhasParaAgrupar(versao, conteudo), [versao, conteudo]);
  const arvore = useMemo(() => agruparPor(linhas, escolhidos), [linhas, escolhidos.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const tot = totaisPorMes(linhas);
  const titulo = (k) => atributos.find((a) => a.chave === k)?.titulo || k;

  function mudar(lista) {
    setEscolhidos(lista);
    setRecolhidos(new Set());
    try {
      localStorage.setItem(CHAVE_AGRUPAR, JSON.stringify(lista));
    } catch {
      /* sem armazenamento: só não lembra da escolha */
    }
  }
  const alternarAtributo = (k) => mudar(escolhidos.includes(k) ? escolhidos.filter((x) => x !== k) : [...escolhidos, k]);
  const alternarGrupo = (id) =>
    setRecolhidos((r) => {
      const n = new Set(r);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Achata a árvore respeitando os grupos recolhidos.
  const visiveis = [];
  const comFilhos = [];
  (function andar(nos, nivel, pai) {
    for (const no of nos) {
      const id = `${pai}/${no.id}`;
      const temFilhos = no.filhos.length > 0;
      if (temFilhos) comFilhos.push(id);
      visiveis.push({ no, nivel, id, temFilhos, aberto: !recolhidos.has(id) });
      if (temFilhos && !recolhidos.has(id)) andar(no.filhos, nivel + 1, id);
    }
  })(arvore, 0, "");
  const todosRecolhidos = comFilhos.length > 0 && comFilhos.every((id) => recolhidos.has(id));
  const pct = (v) => (tot.anual ? (v / tot.anual) * 100 : 0);
  const fmtPct = (v) => `${formatarNumero(pct(v), 1)}%`;
  const grupoDe = [["completa", "Da visão completa"], ["condensada", "Da visão condensada"]].filter(([o]) => atributos.some((a) => a.origem === o));

  function Nome({ v }) {
    const { no, nivel, id, temFilhos, aberto } = v;
    const prox = escolhidos[nivel + 1];
    const estilo = { paddingLeft: 12 + nivel * 26 };
    const nome = no.vazio ? <i style={{ color: "var(--color-gray)" }}>{no.nome}</i> : no.nome;
    if (!temFilhos) return <td style={estilo}>{nome}</td>;
    const [um, varios] = NOMES_GRUPO[prox] || ["grupo", "grupos"];
    return (
      <td style={estilo}>
        <button type="button" className="botao-grupo" onClick={() => alternarGrupo(id)} aria-expanded={aberto}>
          <span className="seta">{aberto ? "▾" : "▸"}</span>
          {no.vazio ? nome : <b>{nome}</b>}
          <span className="qtd">
            {no.filhos.length} {no.filhos.length === 1 ? um : varios}
          </span>
        </button>
      </td>
    );
  }
  const classeLinha = (v) => (v.temFilhos ? (v.nivel === 0 ? "linha-grupo" : "linha-grupo-2") : undefined);
  const cabecalho = escolhidos.map(titulo).join(" › ");

  return (
    <>
      <div className="lista-card" style={{ padding: "14px 16px", marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ ...rotulo, margin: 0 }}>Agrupar por</span>
            {escolhidos.length === 0 && <span style={{ fontSize: 13, color: "var(--color-gray)" }}>escolha um ou mais atributos abaixo</span>}
            {escolhidos.map((k, i) => (
              <span key={k} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                {i > 0 && <span style={{ color: "var(--color-gray)" }}>›</span>}
                <button type="button" className="pill pill-botao-agrupar" onClick={() => alternarAtributo(k)} aria-label={`Tirar ${titulo(k)}`}>
                  {i + 1} · {titulo(k)} ×
                </button>
              </span>
            ))}
          </div>
          {escolhidos.length > 0 && (
            <button type="button" className="link-botao" onClick={() => mudar([])}>
              Limpar
            </button>
          )}
        </div>
        {grupoDe.map(([origem, rot]) => (
          <div key={origem} style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: "var(--color-gray)", marginBottom: 6 }}>{rot}</div>
            <div className="chips-row" role="group" aria-label={rot}>
              {atributos
                .filter((a) => a.origem === origem)
                .map((a) => {
                  const pos = escolhidos.indexOf(a.chave);
                  return (
                    <button key={a.chave} type="button" className="chip" aria-pressed={pos >= 0} onClick={() => alternarAtributo(a.chave)}>
                      {pos >= 0 && <span className="chip-ordem">{pos + 1}</span>}
                      {a.titulo}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
        <div className="texto-ajuda">
          Clique nos atributos na ordem em que quer agrupar: o primeiro divide o total, o segundo divide cada grupo do primeiro, e assim por diante. Clique de novo para tirar.
        </div>
      </div>

      {escolhidos.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", margin: "16px 0 8px", flexWrap: "wrap" }}>
            <div className="chips-row" style={{ alignItems: "center" }}>
              <SeletorVisualizacao modo={modo} onModo={setModo} />
            </div>
            {comFilhos.length > 0 && (
              <button type="button" className="link-botao" onClick={() => setRecolhidos(todosRecolhidos ? new Set() : new Set(comFilhos))}>
                {todosRecolhidos ? "Abrir todos" : "Recolher todos"}
              </button>
            )}
          </div>
          <div className="lista-card">
            <table className="tabela-med tabela-orc2">
              <thead>
                <tr>
                  <th>{cabecalho}</th>
                  {modo === "mes" ? (
                    MESES.map((m) => (
                      <th key={m} className="num mes">
                        {m}
                      </th>
                    ))
                  ) : (
                    <>
                      <th className="num">Itens</th>
                      <th className="so-largo">Jan → Dez</th>
                    </>
                  )}
                  <th className="num">Anual</th>
                  {modo !== "mes" && <th className="num">% do total</th>}
                </tr>
              </thead>
              <tbody>
                {visiveis.length === 0 && (
                  <tr>
                    <td colSpan={modo === "mes" ? 14 : 5} style={{ color: "var(--color-gray)" }}>
                      Este orçamento ainda não tem linhas.
                    </td>
                  </tr>
                )}
                {visiveis.map((v) => (
                  <tr key={v.id} className={classeLinha(v)}>
                    <Nome v={v} />
                    {modo === "mes" ? (
                      v.no.meses.map((x, j) => (
                        <td key={j} className="num mes">
                          {v.temFilhos ? <b>{mil(x)}</b> : mil(x)}
                        </td>
                      ))
                    ) : (
                      <>
                        <td className="num">{v.no.itens}</td>
                        <td className="so-largo">
                          <MiniGrafico meses={v.no.meses} />
                        </td>
                      </>
                    )}
                    <td className="num">{v.temFilhos || v.nivel === 0 ? <b>{formatarReais(v.no.anual)}</b> : formatarReais(v.no.anual)}</td>
                    {modo !== "mes" && (
                      <td className="num" style={{ minWidth: 110 }}>
                        {v.temFilhos ? <b>{fmtPct(v.no.anual)}</b> : fmtPct(v.no.anual)}
                        <div className="barra-uso" style={{ width: 100, marginLeft: "auto" }}>
                          <span style={{ width: `${Math.min(pct(v.no.anual), 100)}%` }} />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {visiveis.length > 0 && (
                  <tr className="total">
                    <td>Total</td>
                    {modo === "mes" ? (
                      tot.meses.map((x, j) => (
                        <td key={j} className="num mes">
                          {mil(x)}
                        </td>
                      ))
                    ) : (
                      <>
                        <td className="num">{linhas.length}</td>
                        <td className="so-largo" />
                      </>
                    )}
                    <td className="num">{formatarReais(tot.anual)}</td>
                    {modo !== "mes" && <td className="num">100%</td>}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="texto-ajuda">
            Do maior valor para o menor em cada nível; o que não tem o atributo preenchido aparece entre parênteses, no fim. “Itens” conta as linhas da visão {versao.visao === "condensada" ? "condensada" : "completa"}.
            {modo === "mes" && " Os meses estão em milhares (k); o anual vem completo."}
          </div>
        </>
      )}
    </>
  );
}
