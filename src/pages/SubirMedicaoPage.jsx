import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import CabecalhoContrato from "../components/CabecalhoContrato";
import { CentroTag, EquipeFrente } from "../components/AbaMedicoes";
import EditorDivisao, { EditorAlocacao, porIdDe, SeletoresParte } from "../components/EditorDivisao";
import { useCentrosDisponiveis } from "../hooks/useCentrosDisponiveis";
import { IconeDocumento } from "../components/Icones";
import { watchContrato } from "../lib/contratos";
import { proximaMedicao } from "../lib/medicao";
import {
  alocacaoNoMes,
  definirAlocacao,
  dividir,
  dividirPorHoras,
  formatarHoras,
  formatarNumero,
  formatarReais,
  lerNumero,
  lerPlanilha,
  mesDasLinhas,
  mesDe,
  normalizarNome,
  partesParaAlocacao,
  periodoCurto,
  preencherLinhas,
  rotuloMes,
  rotuloMesCurto,
  somarMeses,
  totaisDaMedicao,
  totaisPorCentro,
} from "../lib/alocacoes";
import { salvarMedicao, watchCentros, watchEquipes, watchMedicoes, watchRecursos } from "../lib/medicoesContrato";
import { idDaMedicao, nomesDoContrato, situacaoDoMes } from "../lib/medicoesDoMes";

const rotulo = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--color-gray)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" };

async function lerArquivo(arquivo) {
  // Carregado só aqui, para não pesar o resto do app.
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const folhas = await readXlsxFile(arquivo);
  let melhor = null;
  for (const folha of folhas) {
    const r = lerPlanilha(folha.data || []);
    if (r.linhas.length && (!melhor || r.linhas.length > melhor.linhas.length)) melhor = r;
    if (!melhor && r.faltando.length) melhor = melhor || r;
  }
  return melhor || { linhas: [], faltando: ["Nome do Recurso", "Quantidade de Horas", "Valor Total"] };
}

// Linha digitada → linha de medição (o período é o mês todo; valor total =
// horas × valor HH, a não ser que a pessoa tenha digitado outro).
function linhaManual(r, mes) {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  const horas = lerNumero(r.horas) || 0;
  const valorHH = lerNumero(r.valorHH);
  const digitado = lerNumero(r.valorTotal);
  const calculado = valorHH != null ? Math.round(horas * valorHH * 100) / 100 : 0;
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, "0")}`, recurso: String(r.recurso || "").trim(), perfil: String(r.perfil || "").trim(), valorHH: valorHH ?? null, horas, valorTotal: digitado != null && String(r.valorTotal).trim() ? digitado : calculado, justificativa: "" };
}

const EXTRA = "__extra__";

export default function SubirMedicaoPage() {
  const { contratoId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contrato, setContrato] = useState(undefined);
  const [centrosContrato, setCentros] = useState([]);
  const { opcoes: opcoesCentros } = useCentrosDisponiveis();
  const centros = useMemo(() => [...centrosContrato.map((c) => ({ ...c, origem: "contrato" })), ...opcoesCentros], [centrosContrato, opcoesCentros]);
  const [recursos, setRecursos] = useState([]);
  const [medicoes, setMedicoes] = useState([]);
  const [arquivoNome, setArquivoNome] = useState("");
  const [lidas, setLidas] = useState(null);
  // Preencher na mão: linhas digitadas (texto como a pessoa escreveu).
  const [modo, setModo] = useState("planilha");
  const [manuais, setManuais] = useState([]);
  const [erroArquivo, setErroArquivo] = useState("");
  const [lendo, setLendo] = useState(false);
  const [params] = useSearchParams();
  const mesDaUrl = /^\d{4}-\d{2}$/.test(params.get("mes") || "") ? params.get("mes") : null;
  const [mes, setMesBase] = useState(() => mesDaUrl || somarMeses(mesDe(new Date()), -1));
  const [qual, setQual] = useState(null); // nome da medição prevista, EXTRA, ou null (a primeira que falta)
  const [nomeExtra, setNomeExtra] = useState("");
  // Trocar de mês volta para a primeira medição que falta (ler a planilha
  // pode definir o mesmo mês de novo: aí a escolha fica).
  const setMes = (m) => {
    if (m !== mes) setQual(null);
    setMesBase(m);
  };
  const [escolhas, setEscolhas] = useState({}); // índice da linha → { centroId, equipeId, frenteId }
  const [guardar, setGuardar] = useState({}); // índice da linha → salvar como alocação
  const [equipes, setEquipes] = useState([]);
  const [divisoes, setDivisoes] = useState({}); // índice da linha → { partes, salvarAlocacao }
  const [dividindo, setDividindo] = useState(null);
  const [editandoAloc, setEditandoAloc] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const inputRef = useRef(null);

  useEffect(() => watchContrato(contratoId, setContrato), [contratoId]);
  useEffect(() => watchCentros(contratoId, setCentros), [contratoId]);
  useEffect(() => watchRecursos(contratoId, setRecursos), [contratoId]);
  useEffect(() => watchMedicoes(contratoId, setMedicoes), [contratoId]);
  useEffect(() => watchEquipes(contratoId, setEquipes), [contratoId]);

  // Sem planilha ainda: sugere o mês anterior ao ciclo de medição pendente.
  useEffect(() => {
    if (!contrato || lidas || mesDaUrl) return;
    const proxima = proximaMedicao(contrato);
    if (proxima) setMes(somarMeses(proxima.chave, -1));
  }, [contrato, lidas]);

  const centrosPorId = useMemo(() => porIdDe(centros), [centros]);
  const equipesPorId = useMemo(() => Object.fromEntries(equipes.map((e) => [e.id, e])), [equipes]);
  const lidasAtuais = useMemo(() => (modo === "manual" ? manuais.map((r) => linhaManual(r, mes)) : lidas), [modo, manuais, lidas, mes]);
  const linhas = useMemo(() => {
    if (!lidasAtuais) return [];
    return preencherLinhas(lidasAtuais, recursos, centros, mes, equipes).map((l, i) => {
      if (divisoes[i]) return { ...l, partes: divisoes[i].partes, dividida: true };
      // Alocação por horas fixas com horas a mais: o que passar vai para o CC/ODI escolhido aqui.
      if (l.horasAMais) {
        const e = escolhas[i];
        if (!e?.centroId) return { ...l, pendenteAMais: true };
        return { ...l, partes: dividirPorHoras(l, [...l.partes, { ...e, horas: l.horasAMais }], centrosPorId, equipesPorId), aMaisEscolhido: true };
      }
      if (l.horasAMenos) return { ...l, pendenteAMenos: true };
      const e = escolhas[i];
      if (l.partes.length || !e) return l;
      if (!e.centroId) return { ...l, escolhida: true };
      return { ...l, partes: dividir(l, [{ ...e, pct: 100 }], centrosPorId, equipesPorId), escolhida: true };
    });
  }, [lidasAtuais, recursos, centros, mes, equipes, escolhas, divisoes, centrosPorId, equipesPorId]);

  if (contrato === undefined) return <div className="spinner-wrap">Carregando...</div>;
  if (!contrato) return <div className="spinner-wrap">Contrato não encontrado (ou você não tem acesso).</div>;
  const papel = contrato.membros?.[user.uid];
  const podeEditar = papel === "proprietario" || papel === "editor";

  async function escolherArquivo(arquivo) {
    if (!arquivo) return;
    setErroArquivo("");
    setLendo(true);
    setEscolhas({});
    setGuardar({});
    setDivisoes({});
    setDividindo(null);
    try {
      const r = await lerArquivo(arquivo);
      if (r.faltando.length) {
        setLidas(null);
        setErroArquivo(`Não encontrei a(s) coluna(s): ${r.faltando.join(", ")}. Confira se é a planilha de medição do fornecedor.`);
      } else if (!r.linhas.length) {
        setLidas(null);
        setErroArquivo("A planilha não tem nenhuma linha com recurso.");
      } else {
        setLidas(r.linhas);
        setArquivoNome(arquivo.name);
        const m = mesDasLinhas(r.linhas);
        if (m) setMes(m);
      }
    } catch (e) {
      console.error(e);
      setLidas(null);
      setErroArquivo("Não deu pra ler o arquivo. Ele precisa ser um Excel (.xlsx).");
    }
    setLendo(false);
  }

  const pendentesHoras = linhas.filter((l) => l.pendenteAMais || l.pendenteAMenos).length;
  const semCentro = linhas.filter((l) => !l.partes.length).length + pendentesHoras;
  const preenchidas = linhas.filter((l) => l.partes.length && !l.escolhida && !l.dividida && !l.pendenteAMais && !l.pendenteAMenos).length;
  const totais = totaisDaMedicao(linhas);
  const porCentro = totaisPorCentro(linhas);
  // Qual medição do mês (contratos com várias) ou uma extra, com nome.
  const nomesPrevistos = nomesDoContrato(contrato);
  const doMes = medicoes.filter((m) => m.mes === mes);
  const situacao = situacaoDoMes(nomesPrevistos, doMes);
  const qualEfetiva = qual ?? (situacao.previstas.find((p) => !p.medicao) || situacao.previstas[0]).nome;
  const ehExtra = qualEfetiva === EXTRA;
  const prevista = ehExtra ? null : situacao.previstas.find((p) => p.nome === qualEfetiva) || situacao.previstas[0];
  const nomeEscolhido = ehExtra ? nomeExtra.trim() : prevista.nome;
  const idEscolhido = ehExtra ? idDaMedicao(mes, nomeExtra) : prevista.medicao?.id || idDaMedicao(mes, prevista.nome);
  const jaExiste = ehExtra ? medicoes.find((m) => m.id === idEscolhido) : prevista.medicao;
  const rotuloEscolhida = [rotuloMes(mes), nomeEscolhido].filter(Boolean).join(" · ");
  const opcoesMes = [];
  for (let i = -12; i <= 1; i++) opcoesMes.push(somarMeses(mesDe(new Date()), i));
  if (!opcoesMes.includes(mes)) opcoesMes.push(mes);
  opcoesMes.sort().reverse();

  function trocarModo(novo) {
    if (novo === modo) return;
    setModo(novo);
    setEscolhas({});
    setGuardar({});
    setDivisoes({});
    setDividindo(null);
    setEditandoAloc(null);
  }
  // Uma linha por recurso alocado no mês (sem repetir quem já está na lista).
  function trazerAlocados() {
    const ja = new Set(manuais.map((r) => normalizarNome(r.recurso)));
    const novos = recursos
      .filter((r) => alocacaoNoMes(r, mes)?.partes?.length && !ja.has(normalizarNome(r.nome)))
      .map((r) => ({ recurso: r.nome, perfil: r.perfil || "", valorHH: r.valorHH != null && r.valorHH !== "" ? formatarNumero(r.valorHH) : "", horas: "", valorTotal: "", cadastrado: true }));
    setManuais([...manuais, ...novos]);
  }
  const alocadosNoMes = recursos.filter((r) => alocacaoNoMes(r, mes)?.partes?.length).length;
  const mudarManual = (i, campos) => setManuais(manuais.map((r, j) => (j === i ? { ...r, ...campos } : r)));

  // Tira a linha da medição (antes de salvar) e reorganiza o que estava por índice.
  function excluirLinha(i) {
    if (!window.confirm(`Tirar a linha de ${lidasAtuais[i].recurso || "recurso sem nome"} desta medição?`)) return;
    const reindexar = (mapa) => Object.fromEntries(Object.entries(mapa).filter(([k]) => Number(k) !== i).map(([k, v]) => [Number(k) > i ? Number(k) - 1 : Number(k), v]));
    if (modo === "manual") setManuais(manuais.filter((_, j) => j !== i));
    else setLidas(lidas.filter((_, j) => j !== i));
    setEscolhas(reindexar(escolhas));
    setGuardar(reindexar(guardar));
    setDivisoes(reindexar(divisoes));
    setDividindo(null);
    setEditandoAloc(null);
  }

  async function salvar() {
    setErro("");
    if (ehExtra && !nomeExtra.trim()) return setErro("Dê um nome para a medição extra (ex.: Complementar de agosto).");
    // Na mão: linhas sem horas (e sem valor) ficam de fora.
    const entra = (l) => modo !== "manual" || ((l.horas || l.valorTotal) && String(l.recurso || "").trim());
    if (!linhas.some(entra)) return setErro("Preencha as horas de pelo menos um recurso.");
    if (jaExiste && !window.confirm(`Já existe a medição ${rotuloEscolhida}. Salvar vai substituir a anterior. Continuar?`)) return;
    // Linhas sem alocação em que você escolheu um CC/ODI e marcou "salvar como alocação".
    const novos = new Map();
    const existentes = new Map();
    linhas.forEach((l, i) => {
      if (!entra(l)) return;
      const daDivisao = l.dividida && divisoes[i]?.salvarAlocacao;
      if (!daDivisao && (!l.escolhida || guardar[i] === false)) return;
      const partes = partesParaAlocacao(l.partes);
      if (!partes.length) return;
      const chave = normalizarNome(l.recurso);
      if (l.recursoId) {
        const r = recursos.find((x) => x.id === l.recursoId);
        if (r && !existentes.has(r.id)) existentes.set(r.id, { id: r.id, alocacoes: definirAlocacao(r, mes, partes) });
      } else if (!novos.has(chave)) {
        novos.set(chave, { nome: l.recurso, perfil: l.perfil, valorHH: l.valorHH, alocacoes: [{ desde: mes, partes }] });
      }
    });
    const linhasParaSalvar = linhas.filter(entra).map((l) => {
      const { escolhida, dividida, ...resto } = l;
      void escolhida;
      void dividida;
      return resto;
    });
    setSalvando(true);
    try {
      const depois = situacaoDoMes(nomesPrevistos, [...doMes.filter((m) => m.id !== idEscolhido), { id: idEscolhido, nome: nomeEscolhido, extra: ehExtra, status: "a_lancar" }]);
      await salvarMedicao(contratoId, {
        id: idEscolhido,
        nome: nomeEscolhido,
        extra: ehExtra,
        cicloSubido: depois.todasSubidas,
        mes,
        arquivoNome: modo === "manual" ? "" : arquivoNome,
        linhas: linhasParaSalvar,
        total: totais.total,
        horas: totais.horas,
        user,
        novosRecursos: [...novos.values()],
        alocacoesExistentes: [...existentes.values()],
        // A medição das horas de outubro é feita em novembro: marca o ciclo seguinte.
        ciclo: contrato.medicao?.ativa ? somarMeses(mes, 1) : null,
      });
      navigate(`/contratos/${contratoId}/medicoes/${idEscolhido}`, { replace: true });
    } catch (e) {
      console.error(e);
      setErro("Não deu pra salvar a medição. Tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div className="page-shell" style={{ paddingTop: 24, paddingBottom: 80, maxWidth: 1180 }}>
      <Link to="/contratos" style={{ fontSize: 13, fontWeight: 600 }}>
        ← Contratos
      </Link>
      <CabecalhoContrato contrato={contrato} compacto />
      <Link to={`/contratos/${contratoId}/medicoes`} style={{ display: "inline-block", fontSize: 13, fontWeight: 600, marginTop: 14 }}>
        ← Voltar para Medições
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Subir medição</h1>
        <label style={{ width: 210, margin: 0 }}>
          <span style={rotulo}>Mês da medição</span>
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            {opcoesMes.map((m) => (
              <option key={m} value={m}>
                {rotuloMes(m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!podeEditar && <div className="texto-alerta" style={{ marginTop: 12, fontSize: 13 }}>Você só pode visualizar este contrato.</div>}

      <div className="lista-card qual-medicao">
        <span style={rotulo}>Qual medição</span>
        <div className="chips-row" role="group" aria-label="Qual medição">
          {situacao.previstas.map((p) => (
            <button key={p.nome || "unica"} type="button" className="chip" aria-pressed={qualEfetiva === p.nome} onClick={() => setQual(p.nome)}>
              {p.nome || "Medição do mês"}
              {p.medicao ? " · já subida" : ""}
            </button>
          ))}
          <button type="button" className="chip" aria-pressed={ehExtra} onClick={() => setQual(EXTRA)}>
            + Medição extra
          </button>
        </div>
        {ehExtra && (
          <input value={nomeExtra} onChange={(e) => setNomeExtra(e.target.value)} placeholder="Nome da medição extra (ex.: Complementar de agosto)" aria-label="Nome da medição extra" maxLength={60} style={{ marginTop: 10, maxWidth: 420 }} />
        )}
        <div className="texto-ajuda">
          {nomesPrevistos.length
            ? "As medições do mês vêm do cadastro do contrato. “Medição extra” é para um caso fora do comum e não muda o cadastro."
            : "Este contrato tem uma medição por mês. Para um caso fora do comum, use “Medição extra”; para ter várias todo mês, cadastre os nomes em Editar contrato."}
        </div>
      </div>

      <div className="chips-row como-preencher" role="group" aria-label="Como preencher">
        <span style={{ ...rotulo, margin: 0 }}>Como preencher</span>
        <button type="button" className="chip" aria-pressed={modo === "planilha"} onClick={() => trocarModo("planilha")}>
          Planilha do fornecedor
        </button>
        <button type="button" className="chip" aria-pressed={modo === "manual"} onClick={() => trocarModo("manual")}>
          Preencher na mão
        </button>
      </div>

      {modo === "manual" && (
        <div className="lista-card manual-intro">
          <div style={{ flex: "1 1 320px", fontSize: 13 }}>
            Comece pelos recursos alocados em <b>{rotuloMes(mes).toLowerCase()}</b> (nome, perfil, valor HH e CC/ODI já vêm preenchidos) e digite só as horas. O valor total é horas × valor HH, e dá para ajustar. Linhas sem horas ficam de fora.
          </div>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={trazerAlocados} disabled={!podeEditar || alocadosNoMes === 0}>
              {alocadosNoMes ? `Trazer ${alocadosNoMes === 1 ? "o recurso alocado" : `os ${alocadosNoMes} recursos alocados`}` : "Nenhum recurso alocado neste mês"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setManuais([...manuais, { recurso: "", perfil: "", valorHH: "", horas: "", valorTotal: "", novo: true }])} disabled={!podeEditar}>
              + Adicionar linha
            </button>
          </span>
        </div>
      )}

      {modo === "planilha" && (
      <div className="area-arquivo">
        <span style={{ color: "var(--color-primary)" }}>
          <IconeDocumento size={28} />
        </span>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          {lidas ? (
            <>
              <div style={{ fontWeight: 700, overflowWrap: "anywhere" }}>{arquivoNome}</div>
              <div style={{ fontSize: 13, color: "var(--color-gray)" }}>
                {lidas.length} {lidas.length === 1 ? "linha lida" : "linhas lidas"} · usa Nome do Recurso, Perfil, Valor HH, Horas e Valor Total; as outras colunas ficam de fora
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700 }}>{lendo ? "Lendo a planilha..." : "Escolha a planilha do fornecedor (.xlsx)"}</div>
              <div style={{ fontSize: 13, color: "var(--color-gray)" }}>O app preenche Tipo pagamento e CC/ODI pelas alocações do mês.</div>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          style={{ display: "none" }}
          onChange={(e) => {
            escolherArquivo(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button type="button" className={lidas ? "btn btn-ghost btn-sm" : "btn btn-primary"} onClick={() => inputRef.current?.click()} disabled={lendo || !podeEditar}>
          {lidas ? "Trocar arquivo" : "Escolher arquivo"}
        </button>
      </div>
      )}
      {erroArquivo && (
        <div className="texto-alerta" role="alert" style={{ marginTop: 10, fontSize: 13 }}>
          {erroArquivo}
        </div>
      )}

      {lidasAtuais?.length > 0 && (
        <>
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 13,
              background: semCentro ? "var(--color-orange-soft)" : "#e0f5ef",
              border: `1px solid ${semCentro ? "var(--color-orange-border)" : "#9fd3cf"}`,
            }}
          >
            <b>
              {preenchidas} de {linhas.length} linhas
            </b>{" "}
            preenchidas pelas alocações de <b>{rotuloMes(mes)}</b>
            {semCentro > 0 && (
              <>
                {" "}
                · <b className="texto-alerta">{semCentro} {semCentro === 1 ? "precisa" : "precisam"} de você</b> ({pendentesHoras ? "horas diferentes do padrão ou recurso sem alocação" : "recurso sem alocação"})
              </>
            )}
          </div>
          {jaExiste && (
            <div className="texto-ajuda texto-alerta" style={{ marginTop: 8 }}>
              Já existe a medição {rotuloEscolhida}; salvar vai substituir a anterior.
            </div>
          )}

          <div className="lista-card tabela-rolagem" style={{ marginTop: 12 }}>
            <table className="tabela-med">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Recurso</th>
                  <th>Perfil</th>
                  <th className="num">Valor HH</th>
                  <th className="num">Horas</th>
                  <th className="num">Valor total</th>
                  <th>Tipo pagamento</th>
                  <th>CC / ODI · Equipe · Frente</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => [
                  <LinhaPrevia
                    key={i}
                    linha={l}
                    mes={mes}
                    centros={centros}
                    equipes={equipes}
                    escolha={escolhas[i] || {}}
                    onEscolher={(m) => setEscolhas({ ...escolhas, [i]: { ...(escolhas[i] || {}), ...m } })}
                    guardar={guardar[i] !== false}
                    onGuardar={(v) => setGuardar({ ...guardar, [i]: v })}
                    onDividir={podeEditar ? () => (setEditandoAloc(null), setDividindo(dividindo === i ? null : i)) : null}
                    dividindo={dividindo === i}
                    onEditarAlocacao={podeEditar ? () => (setDividindo(null), setEditandoAloc(editandoAloc === i ? null : i)) : null}
                    editandoAlocacao={editandoAloc === i}
                    onExcluir={podeEditar ? () => excluirLinha(i) : null}
                    manual={modo === "manual" ? manuais[i] : null}
                    onMudarManual={(campos) => mudarManual(i, campos)}
                  />,
                  editandoAloc === i && (
                    <tr key={`a${i}`}>
                      <td colSpan={9} className="editor">
                        <EditorAlocacao
                          contratoId={contratoId}
                          recurso={recursos.find((r) => r.id === l.recursoId) || null}
                          linha={l}
                          centros={centros}
                          equipes={equipes}
                          mes={mes}
                          onCancelar={() => setEditandoAloc(null)}
                          onSalvo={() => {
                            // A linha volta a seguir a alocação (agora atualizada).
                            const semDivisao = { ...divisoes };
                            delete semDivisao[i];
                            const semEscolha = { ...escolhas };
                            delete semEscolha[i];
                            setDivisoes(semDivisao);
                            setEscolhas(semEscolha);
                            setEditandoAloc(null);
                          }}
                        />
                      </td>
                    </tr>
                  ),
                  dividindo === i && (
                    <tr key={`d${i}`}>
                      <td colSpan={9} className="editor">
                        <EditorDivisao
                          linha={l}
                          centros={centros}
                          equipes={equipes}
                          partesIniciais={l.horasAMais && !l.dividida ? linhas[i].partes.slice(0, l.partes.length - (l.aMaisEscolhido ? 1 : 0)) : l.partes}
                          modoInicial={l.horasAMais || l.horasAMenos ? "horas" : "pct"}
                          mes={mes}
                          permitirSalvarAlocacao
                          onCancelar={() => setDividindo(null)}
                          onAplicar={({ partes, salvarAlocacao }) => {
                            setDivisoes({ ...divisoes, [i]: { partes, salvarAlocacao } });
                            setDividindo(null);
                          }}
                        />
                      </td>
                    </tr>
                  ),
                ])}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginTop: 18, alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 420px", minWidth: 0 }}>
              <div style={{ ...rotulo, marginBottom: 8 }}>Total por CC/ODI</div>
              <div className="lista-card tabela-rolagem">
                <table className="tabela-med">
                  <tbody>
                    {porCentro.map((t) => (
                      <tr key={t.centroId || "sem"} className={t.centroId ? "" : "falta"}>
                        <td>{t.centroId ? <CentroTag tipo={t.tipo} codigo={t.codigo} /> : <b className="texto-alerta">Sem CC/ODI</b>}</td>
                        <td className="num">{formatarHoras(t.horas)}</td>
                        <td className="num">
                          <b>{formatarReais(t.valor)}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="lista-card">
                <div className="info-linha">
                  <span>Total da medição</span>
                  <span>{formatarReais(totais.total)}</span>
                </div>
                <div className="info-linha">
                  <span>Horas</span>
                  <span>{formatarHoras(totais.horas)}</span>
                </div>
              </div>
              {erro && (
                <div className="texto-alerta" role="alert" style={{ fontSize: 13 }}>
                  {erro}
                </div>
              )}
              <button type="button" className="btn btn-primary" style={{ justifyContent: "center" }} onClick={salvar} disabled={salvando || !podeEditar}>
                {salvando ? "Salvando..." : "Salvar medição"}
              </button>
              {semCentro > 0 && <div className="texto-ajuda" style={{ margin: 0 }}>Dá para salvar com linha sem CC/ODI e completar depois.</div>}
              <Link to={`/contratos/${contratoId}/medicoes`} className="btn btn-ghost" style={{ justifyContent: "center" }}>
                Cancelar
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function tipoPagamento(tipo) {
  return tipo === "CC" ? "Centro de Custo" : tipo === "ODI" ? "ODI" : "";
}

function LinhaPrevia({ linha, mes, centros, equipes, escolha, onEscolher, guardar, onGuardar, onDividir, dividindo, onEditarAlocacao, editandoAlocacao, onExcluir, manual, onMudarManual }) {
  const l = linha;
  const primeiro = (l.recurso || "recurso").split(" ")[0];
  const acao = (
    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
      {onDividir && (
        <button type="button" className="link-botao" style={{ fontSize: 12, display: "block", marginLeft: "auto" }} onClick={onDividir} aria-expanded={dividindo}>
          {l.partes.length > 1 ? "Editar divisão" : "Dividir"}
        </button>
      )}
      {onEditarAlocacao && (
        <button type="button" className="link-botao" style={{ fontSize: 12, display: "block", marginLeft: "auto", marginTop: 6 }} onClick={onEditarAlocacao} aria-expanded={editandoAlocacao}>
          Editar alocação
        </button>
      )}
      {onExcluir && (
        <button type="button" className="link-botao" style={{ fontSize: 12, display: "block", marginLeft: "auto", marginTop: 6, color: "var(--color-orange)" }} onClick={onExcluir}>
          Excluir linha
        </button>
      )}
    </td>
  );
  const colunasBase = (
    <>
      <td style={{ whiteSpace: "nowrap" }}>{periodoCurto(l.inicio, l.fim)}</td>
      <td>
        {manual?.novo ? (
          <input value={manual.recurso} onChange={(e) => onMudarManual({ recurso: e.target.value })} placeholder="Nome do recurso" aria-label="Nome do recurso" className="campo-manual" style={{ minWidth: 150 }} />
        ) : (
          <b>{l.recurso}</b>
        )}
        {l.justificativa && <div style={{ fontSize: 12, color: "var(--color-gray)" }}>{l.justificativa}</div>}
      </td>
      <td>
        {manual?.novo ? (
          <input value={manual.perfil} onChange={(e) => onMudarManual({ perfil: e.target.value })} placeholder="Perfil (opcional)" aria-label={`Perfil de ${l.recurso || "recurso"}`} className="campo-manual" style={{ minWidth: 130 }} />
        ) : (
          l.perfil || "—"
        )}
      </td>
      <td className="num">
        {manual ? (
          <input value={manual.valorHH} onChange={(e) => onMudarManual({ valorHH: e.target.value })} inputMode="decimal" placeholder="0,00" aria-label={`Valor HH de ${l.recurso || "recurso"}`} className="campo-manual num" style={{ width: 84 }} />
        ) : l.valorHH != null ? (
          formatarNumero(l.valorHH)
        ) : (
          "—"
        )}
        {l.valorCadastrado != null && (
          <div className="texto-alerta" style={{ fontSize: 12 }} title="Valor HH diferente do cadastrado no recurso">
            cadastrado {formatarNumero(l.valorCadastrado)}
          </div>
        )}
      </td>
      <td className="num">
        {manual ? (
          <input value={manual.horas} onChange={(e) => onMudarManual({ horas: e.target.value })} inputMode="decimal" placeholder="0" aria-label={`Horas de ${l.recurso || "recurso"}`} className={`campo-manual num ${l.horas ? "" : "vazio"}`} style={{ width: 70 }} />
        ) : (
          formatarNumero(l.horas, l.horas % 1 ? 2 : 0)
        )}
      </td>
      <td className="num">
        {manual ? (
          <input value={manual.valorTotal} onChange={(e) => onMudarManual({ valorTotal: e.target.value })} inputMode="decimal" placeholder={l.valorTotal ? formatarNumero(l.valorTotal) : "—"} aria-label={`Valor total de ${l.recurso || "recurso"}`} className="campo-manual num" style={{ width: 100 }} />
        ) : (
          formatarNumero(l.valorTotal)
        )}
      </td>
    </>
  );

  if (!l.partes.length || l.escolhida) {
    return (
      <tr className={l.partes.length ? "" : "falta"}>
        {colunasBase}
        <td colSpan={2} style={{ minWidth: 260 }}>
          <div className={`escolha-rapida ${l.partes.length ? "" : "pendente"}`} aria-label={`CC/ODI, equipe e frente de ${l.recurso}`} role="group">
            <SeletoresParte parte={escolha} centros={centros} equipes={equipes} indice={0} onMudar={onEscolher} mes={mes} />
          </div>
          {l.recursoId && <div className="texto-ajuda">Sem alocação em {rotuloMesCurto(mes)}.</div>}
          {escolha.centroId && (
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--color-gray)", marginTop: 6, fontWeight: 400 }}>
              <input type="checkbox" checked={guardar} onChange={(e) => onGuardar(e.target.checked)} style={{ width: "auto" }} />
              Salvar como alocação de {primeiro}
            </label>
          )}
        </td>
        {acao}
      </tr>
    );
  }

  // Alocação por horas fixas com horas diferentes do padrão.
  if ((l.horasAMais || l.horasAMenos) && !l.dividida) {
    const valorHora = l.horas ? Number(l.valorTotal) / Number(l.horas) : 0;
    return (
      <tr className={l.pendenteAMais || l.pendenteAMenos ? "falta" : ""}>
        {colunasBase}
        <td colSpan={2} style={{ minWidth: 280 }}>
          <div style={{ fontSize: 12, color: "var(--color-gray)", marginBottom: 4 }}>
            padrão: {formatarNumero(l.padraoHoras, l.padraoHoras % 1 ? 2 : 0)} h · vieram {formatarNumero(l.horas, l.horas % 1 ? 2 : 0)} h
          </div>
          {(l.aMaisEscolhido ? l.partes.slice(0, -1) : l.partes).map((p, j) => (
            <div key={j} style={{ marginBottom: 2 }}>
              <CentroTag tipo={p.tipo} codigo={p.codigo} />{" "}
              <span style={{ fontSize: 12, color: "var(--color-gray)" }}>
                {formatarNumero(p.horas, p.horas % 1 ? 2 : 0)} h · {formatarReais(p.valor)}
              </span>
            </div>
          ))}
          {l.horasAMais ? (
            <div className="caixa-horas-a-mais">
              <b className={l.pendenteAMais ? "texto-alerta" : ""} style={{ fontSize: 13 }}>
                {formatarNumero(l.horasAMais, l.horasAMais % 1 ? 2 : 0)} h a mais ({formatarReais(l.horasAMais * valorHora)}) · onde alocar?
              </b>
              <div className={`escolha-rapida ${l.pendenteAMais ? "pendente" : ""}`} role="group" aria-label={`Horas a mais de ${l.recurso}`} style={{ marginTop: 6 }}>
                <SeletoresParte parte={escolha} centros={centros} equipes={equipes} indice={0} onMudar={onEscolher} mes={mes} />
              </div>
              {onDividir && (
                <button type="button" className="link-botao" style={{ fontSize: 12, marginTop: 6 }} onClick={onDividir}>
                  Dividir as horas a mais em vários CCs/ODIs
                </button>
              )}
            </div>
          ) : (
            <div className="caixa-horas-a-mais">
              <b className="texto-alerta" style={{ fontSize: 13 }}>
                {formatarNumero(l.horasAMenos, l.horasAMenos % 1 ? 2 : 0)} h a menos que o padrão
              </b>
              <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 2 }}>
                Por enquanto ficou proporcional.{" "}
                {onDividir && (
                  <button type="button" className="link-botao" style={{ fontSize: 12 }} onClick={onDividir}>
                    Ajustar a divisão
                  </button>
                )}
              </div>
            </div>
          )}
        </td>
        {acao}
      </tr>
    );
  }

  if (l.partes.length === 1) {
    const p = l.partes[0];
    return (
      <tr>
        {colunasBase}
        <td>{tipoPagamento(p.tipo)}</td>
        <td>
          <CentroTag tipo={p.tipo} codigo={p.codigo} />
          <EquipeFrente equipe={p.equipe} frente={p.frente} />
        </td>
        {acao}
      </tr>
    );
  }

  return (
    <>
      <tr>
        {colunasBase}
        <td colSpan={2} style={{ fontSize: 12, color: "var(--color-gray)" }}>
          dividido em {l.partes.length} ↓
        </td>
        {acao}
      </tr>
      {l.partes.map((p, j) => (
        <tr key={j} className="sub">
          <td />
          <td colSpan={3}>
            ↳ {formatarNumero(p.pct, p.pct % 1 ? 2 : 0)}% de {primeiro}
          </td>
          <td className="num">{formatarNumero(p.horas, p.horas % 1 ? 2 : 0)}</td>
          <td className="num">{formatarNumero(p.valor)}</td>
          <td>{tipoPagamento(p.tipo)}</td>
          <td>
            <CentroTag tipo={p.tipo} codigo={p.codigo} />
            <EquipeFrente equipe={p.equipe} frente={p.frente} />
          </td>
          <td />
        </tr>
      ))}
    </>
  );
}
