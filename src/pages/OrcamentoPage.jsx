import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { formatarNumero, formatarReais, lerNumero } from "../lib/alocacoes";
import {
  anualDe,
  camposPendentes,
  chaveGrupo,
  CLASSIFICACOES,
  linhasCondensadas,
  MESES,
  novoIdLinha,
  RESPONSAVEIS,
  TIPOS,
  totaisPorMes,
  versaoVigente,
} from "../lib/orcamentos";
import { baixarOrcamento } from "../lib/orcamentosExcel";
import { atualizarVersao, excluirVersao, salvarConteudo, watchConteudo, watchPlanejamento, watchVersao, watchVersoes } from "../lib/orcamentosDb";
import { dataBr, PillSituacao } from "./OrcamentosPage";

const rotulo = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--color-gray)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" };
const n2 = (v) => (v ? formatarNumero(v) : "—");

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
  const aba = !ehCompleta || params.get("visao") === "condensada" ? "condensada" : "completa";
  const vigente = versaoVigente(versoes);
  const substituida = versao.situacao === "efetivada" && vigente && vigente.id !== versao.id;
  const pendentes = condensadas.filter((l) => camposPendentes(l).length).length;

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

  // Visão condensada: campos extras (na completa ficam em "extras"; na condensada, na própria linha).
  const mudarExtra = (linhaCond, campo, valor) => {
    if (ehCompleta) {
      const extras = { ...(conteudo.extras || {}) };
      extras[linhaCond.chave] = { ...(extras[linhaCond.chave] || {}), [campo]: valor };
      return salvar({ extras });
    }
    return salvar({ condensada: (conteudo.condensada || []).map((l) => (l.id === linhaCond.id ? { ...l, [campo]: valor } : l)) });
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
      </nav>

      {aba === "completa" ? (
        <TabelaCompleta linhas={conteudo.completa || []} podeEditar={podeEditar} onSalvar={salvarLinhaCompleta} onExcluir={excluirLinhaCompleta} />
      ) : (
        <TabelaCondensada
          linhas={condensadas}
          pendentes={pendentes}
          daCompleta={ehCompleta}
          podeEditar={podeEditar}
          onMudarExtra={mudarExtra}
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

// ---------- Visão completa ----------

function TabelaCompleta({ linhas, podeEditar, onSalvar, onExcluir }) {
  const [busca, setBusca] = useState("");
  const [mostrarMeses, setMostrarMeses] = useState(true);
  const [agrupamento, setAgrupamento] = useState("");
  const [tiPaga, setTiPaga] = useState("");
  const [editando, setEditando] = useState(null);
  const agrupamentos = [...new Set(linhas.map((l) => l.agrupamento).filter(Boolean))].sort();
  const termo = busca.trim().toLowerCase();
  const visiveis = linhas.filter(
    (l) =>
      (!termo || [l.item, l.pessoa, l.projeto, l.fornecedor, l.linha, l.agrupamento, l.tipo].some((x) => String(x || "").toLowerCase().includes(termo))) &&
      (!agrupamento || l.agrupamento === agrupamento) &&
      (!tiPaga || (tiPaga === "sim" ? l.tiPaga : !l.tiPaga))
  );
  const tot = totaisPorMes(visiveis);
  const colunas = 11 + (mostrarMeses ? 12 : 0) + (podeEditar ? 1 : 0);
  const sugestoes = {
    projeto: [...new Set(linhas.map((l) => l.projeto).filter(Boolean))],
    fornecedor: [...new Set(linhas.map((l) => l.fornecedor).filter(Boolean))],
    linha: [...new Set(linhas.map((l) => l.linha).filter(Boolean))],
    agrupamento: agrupamentos,
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", margin: "14px 0 8px", flexWrap: "wrap" }}>
        <div className="chips-row" style={{ alignItems: "center" }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item, pessoa, projeto…" aria-label="Buscar" style={{ width: 240, padding: "7px 12px" }} />
          <button type="button" className="chip" aria-pressed={mostrarMeses} onClick={() => setMostrarMeses(!mostrarMeses)}>
            Meses: {mostrarMeses ? "mostrando" : "ocultos"}
          </button>
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
        {podeEditar && (
          <button type="button" className="link-botao" onClick={() => setEditando("nova")}>
            + Nova linha
          </button>
        )}
      </div>
      <div className="lista-card tabela-rolagem">
        <table className="tabela-med tabela-orc">
          <thead>
            <tr>
              <th className="fixa" />
              <th className="grupo" colSpan={4}>
                Dados básicos
              </th>
              <th className="grupo" colSpan={3 + (mostrarMeses ? 12 : 0)}>
                Valores
              </th>
              <th className="grupo" colSpan={3}>
                Planilha governança
              </th>
              {podeEditar && <th />}
            </tr>
            <tr>
              <th className="fixa">Item</th>
              <th>Pessoa</th>
              <th>TI paga?</th>
              <th>Quem paga</th>
              <th>Quem se beneficia</th>
              <th className="num">Valor unit.</th>
              <th className="num">Qtd</th>
              {mostrarMeses && MESES.map((m) => <th key={m} className="num">{m}</th>)}
              <th className="num">Anual</th>
              <th>Projeto</th>
              <th>Fornecedor</th>
              <th>Linha</th>
              {podeEditar && <th />}
            </tr>
          </thead>
          <tbody>
            {editando === "nova" && (
              <tr>
                <td colSpan={colunas} className="editor">
                  <EditorLinhaCompleta linha={null} sugestoes={sugestoes} onCancelar={() => setEditando(null)} onSalvar={async (l) => (await onSalvar(l), setEditando(null))} />
                </td>
              </tr>
            )}
            {visiveis.length === 0 && editando !== "nova" && (
              <tr>
                <td colSpan={colunas} style={{ color: "var(--color-gray)" }}>
                  {linhas.length ? "Nenhuma linha com esses filtros." : "Nenhuma linha ainda."}
                </td>
              </tr>
            )}
            {visiveis.map((l) =>
              editando === l.id ? (
                <tr key={l.id}>
                  <td colSpan={colunas} className="editor">
                    <EditorLinhaCompleta
                      linha={l}
                      sugestoes={sugestoes}
                      onCancelar={() => setEditando(null)}
                      onSalvar={async (nova) => (await onSalvar(nova), setEditando(null))}
                      onExcluir={async () => {
                        if (!window.confirm(`Excluir a linha “${l.item || "sem nome"}”?`)) return;
                        await onExcluir(l.id);
                        setEditando(null);
                      }}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={l.id}>
                  <td className="fixa">
                    <b>{l.item || "—"}</b>
                    <div style={{ fontSize: 12, color: "var(--color-gray)" }}>{[l.agrupamento, l.tipo].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td>{l.pessoa || "—"}</td>
                  <td>{l.tiPaga ? "Sim" : "Não"}</td>
                  <td>{l.quemPaga || "—"}</td>
                  <td>{l.quemSeBeneficia || "—"}</td>
                  <td className="num">{l.valorUnitario != null ? formatarNumero(l.valorUnitario) : "—"}</td>
                  <td className="num">{l.quantidade != null ? formatarNumero(l.quantidade, l.quantidade % 1 ? 2 : 0) : "—"}</td>
                  {mostrarMeses && l.meses?.map((v, i) => <td key={i} className="num">{n2(v)}</td>)}
                  <td className="num">
                    <b>{formatarNumero(anualDe(l))}</b>
                  </td>
                  <td>{l.projeto || "—"}</td>
                  <td>{l.fornecedor || "—"}</td>
                  <td>{l.linha || "—"}</td>
                  {podeEditar && (
                    <td>
                      <button type="button" className="link-botao" style={{ fontSize: 12 }} onClick={() => setEditando(l.id)}>
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              )
            )}
            {visiveis.length > 0 && (
              <tr className="total">
                <td className="fixa">Total{visiveis.length !== linhas.length ? " (filtrado)" : ""}</td>
                <td colSpan={6} />
                {mostrarMeses && tot.meses.map((v, i) => <td key={i} className="num">{formatarNumero(v)}</td>)}
                <td className="num">{formatarNumero(tot.anual)}</td>
                <td colSpan={3 + (podeEditar ? 1 : 0)} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="texto-ajuda">A tabela rola para o lado; o item fica fixo à esquerda. Mudar uma linha aqui atualiza a visão condensada na hora.</div>
    </>
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

// Campo que salva ao sair (texto) ou ao escolher (lista).
function CampoInline({ valor, opcoes, numero, onSalvar, desabilitado, rotuloAcessivel }) {
  const inicial = numero ? (valor == null || valor === "" ? "" : formatarNumero(valor)) : valor || "";
  const [v, setV] = useState(inicial);
  useEffect(() => setV(inicial), [inicial]);
  const vazio = !String(v).trim();
  if (opcoes) {
    return (
      <select className={`campo ${vazio ? "vazio" : ""}`} value={v} disabled={desabilitado} aria-label={rotuloAcessivel} onChange={(e) => (setV(e.target.value), onSalvar(e.target.value))}>
        <option value="">Escolher…</option>
        {opcoes.map((o) => (
          <option key={o}>{o}</option>
        ))}
        {v && !opcoes.includes(v) && <option>{v}</option>}
      </select>
    );
  }
  return (
    <input
      className={`campo ${vazio && !numero ? "vazio" : ""}`}
      value={v}
      disabled={desabilitado}
      aria-label={rotuloAcessivel}
      inputMode={numero ? "decimal" : undefined}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v === inicial) return;
        onSalvar(numero ? lerNumero(v) : v.trim());
      }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

function TabelaCondensada({ linhas, pendentes, daCompleta, podeEditar, onMudarExtra, onSalvar, onExcluir }) {
  const [editando, setEditando] = useState(null);
  const tot = totaisPorMes(linhas);
  const colunas = 9 + 12 + (!daCompleta && podeEditar ? 1 : 0);
  const extra = (l, campo, props = {}) => (
    <CampoInline valor={l[campo]} desabilitado={!podeEditar} onSalvar={(v) => onMudarExtra(l, campo, v).catch(() => {})} rotuloAcessivel={`${campo} de ${l.projeto}`} {...props} />
  );
  return (
    <>
      {pendentes > 0 && (
        <div style={{ margin: "14px 0 8px", padding: "10px 14px", borderRadius: 10, background: "var(--color-orange-soft)", border: "1px solid var(--color-orange-border)", fontSize: 13 }}>
          <b>
            {pendentes} {pendentes === 1 ? "linha com campos" : "linhas com campos"} a preencher
          </b>{" "}
          (em laranja).{daCompleta ? " Os valores mensais vêm da visão completa, somando por Projeto + Fornecedor + Linha." : ""}
        </div>
      )}
      {!daCompleta && podeEditar && (
        <div style={{ display: "flex", justifyContent: "flex-end", margin: "12px 0 6px" }}>
          <button type="button" className="link-botao" onClick={() => setEditando("nova")}>
            + Nova linha
          </button>
        </div>
      )}
      <div className="lista-card tabela-rolagem" style={{ marginTop: pendentes > 0 || (!daCompleta && podeEditar) ? 0 : 14 }}>
        <table className="tabela-med tabela-orc">
          <thead>
            <tr>
              <th className="fixa">Projeto · Fornecedor · Linha</th>
              <th>ODI</th>
              <th>Capex ano anterior</th>
              <th>Tipo</th>
              <th>Classificação</th>
              <th>Diretoria</th>
              <th>Área atendida</th>
              <th>Resp. orçamento</th>
              {MESES.map((m) => (
                <th key={m} className="num">
                  {m}
                </th>
              ))}
              <th className="num">Anual</th>
              {!daCompleta && podeEditar && <th />}
            </tr>
          </thead>
          <tbody>
            {editando === "nova" && (
              <tr>
                <td colSpan={colunas} className="editor">
                  <EditorLinhaCondensada linha={null} onCancelar={() => setEditando(null)} onSalvar={async (l) => (await onSalvar(l), setEditando(null))} />
                </td>
              </tr>
            )}
            {linhas.length === 0 && editando !== "nova" && (
              <tr>
                <td colSpan={colunas} style={{ color: "var(--color-gray)" }}>
                  Nenhuma linha ainda.
                </td>
              </tr>
            )}
            {linhas.map((l) =>
              editando === l.id ? (
                <tr key={l.id}>
                  <td colSpan={colunas} className="editor">
                    <EditorLinhaCondensada
                      linha={l}
                      onCancelar={() => setEditando(null)}
                      onSalvar={async (nova) => (await onSalvar(nova), setEditando(null))}
                      onExcluir={async () => {
                        if (!window.confirm(`Excluir a linha ${l.projeto} · ${l.fornecedor} · ${l.linha}?`)) return;
                        await onExcluir(l.id);
                        setEditando(null);
                      }}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={l.id || l.chave} className={camposPendentes(l).length ? "pendente" : ""}>
                  <td className="fixa">
                    <b>{l.projeto || "—"}</b>
                    <div style={{ fontSize: 12, color: "var(--color-gray)" }}>
                      {[l.fornecedor, l.linha].filter(Boolean).join(" · ") || "—"}
                      {daCompleta && l.qtdRecursos ? ` · ${l.qtdRecursos} ${l.qtdRecursos === 1 ? "recurso" : "recursos"}` : ""}
                    </div>
                  </td>
                  <td>{extra(l, "odi")}</td>
                  <td>{extra(l, "capexAnoAnterior", { numero: true })}</td>
                  <td>{extra(l, "tipo", { opcoes: TIPOS })}</td>
                  <td>{extra(l, "classificacao", { opcoes: CLASSIFICACOES })}</td>
                  <td>{extra(l, "diretoria")}</td>
                  <td>{extra(l, "area")}</td>
                  <td>{extra(l, "responsavel", { opcoes: RESPONSAVEIS })}</td>
                  {(l.meses || []).map((v, i) => (
                    <td key={i} className="num">
                      {n2(v)}
                    </td>
                  ))}
                  <td className="num">
                    <b>{formatarNumero(l.anual ?? anualDe(l))}</b>
                  </td>
                  {!daCompleta && podeEditar && (
                    <td>
                      <button type="button" className="link-botao" style={{ fontSize: 12 }} onClick={() => setEditando(l.id)}>
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              )
            )}
            {linhas.length > 0 && (
              <tr className="total">
                <td className="fixa">Total</td>
                <td colSpan={7} />
                {tot.meses.map((v, i) => (
                  <td key={i} className="num">
                    {formatarNumero(v)}
                  </td>
                ))}
                <td className="num">{formatarNumero(tot.anual)}</td>
                {!daCompleta && podeEditar && <td />}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="texto-ajuda">
        Tipo: Projeto, Licenciamento, MOP, Serviço/sustentação ou N/A. Classificação: Obrigatório, Mandatório, Desejável ou N/A. Responsável: TI ou Cliente. Os campos salvam ao sair de cada um.
      </div>
    </>
  );
}

function EditorLinhaCondensada({ linha, onSalvar, onCancelar, onExcluir }) {
  const [l, setL] = useState(() => ({ projeto: "", fornecedor: "", linha: "", ...(linha || {}), meses: (linha?.meses || Array(12).fill(0)).map(textoMes) }));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const meses = l.meses.map((v) => lerNumero(v) || 0);
  const anual = meses.reduce((s, v) => s + Math.round(v * 100), 0) / 100;
  async function salvar() {
    if (!String(l.projeto).trim()) return setErro("Escreva o projeto.");
    setSalvando(true);
    const { chave, anual: _a, qtdRecursos, ...resto } = l;
    void chave;
    void _a;
    void qtdRecursos;
    const nova = { ...resto, id: linha?.id || novoIdLinha(), projeto: l.projeto.trim(), fornecedor: l.fornecedor.trim(), linha: l.linha.trim(), meses };
    try {
      await onSalvar({ ...nova, chave: chaveGrupo(nova) });
    } catch {
      setSalvando(false);
    }
  }
  return (
    <div role="group" aria-label={linha ? `Editar linha ${linha.projeto}` : "Nova linha condensada"}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{linha ? `Editar linha · ${linha.projeto}` : "Nova linha"}</div>
      <div className="grade-campos">
        {["projeto", "fornecedor", "linha"].map((c) => (
          <label key={c}>
            <span style={rotulo}>{c === "projeto" ? "Projeto" : c === "fornecedor" ? "Fornecedor" : "Linha"}</span>
            <input value={l[c]} onChange={(e) => setL({ ...l, [c]: e.target.value })} />
          </label>
        ))}
      </div>
      <div className="grade-meses" style={{ marginTop: 10 }}>
        {MESES.map((m, i) => (
          <label key={m}>
            <span style={{ ...rotulo, fontSize: 10 }}>{m}</span>
            <input value={l.meses[i]} onChange={(e) => setL({ ...l, meses: l.meses.map((x, j) => (j === i ? e.target.value : x)) })} inputMode="decimal" aria-label={`Valor de ${m}`} />
          </label>
        ))}
      </div>
      <div className="texto-ajuda">
        Valor anual: <b>{formatarReais(anual)}</b>. ODI, tipo, classificação e os outros campos você preenche direto na tabela.
      </div>
      {erro && (
        <div className="texto-alerta" role="alert" style={{ fontSize: 13, marginTop: 8 }}>
          {erro}
        </div>
      )}
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
            Salvar linha
          </button>
        </span>
      </div>
    </div>
  );
}
