import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import CabecalhoContrato from "../components/CabecalhoContrato";
import { CentroTag, EquipeFrente } from "../components/AbaMedicoes";
import EditorDivisao, { SeletoresParte } from "../components/EditorDivisao";
import { IconeDocumento } from "../components/Icones";
import { watchContrato } from "../lib/contratos";
import { proximaMedicao } from "../lib/medicao";
import {
  definirAlocacao,
  dividir,
  formatarHoras,
  formatarNumero,
  formatarReais,
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

export default function SubirMedicaoPage() {
  const { contratoId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contrato, setContrato] = useState(undefined);
  const [centros, setCentros] = useState([]);
  const [recursos, setRecursos] = useState([]);
  const [medicoes, setMedicoes] = useState([]);
  const [arquivoNome, setArquivoNome] = useState("");
  const [lidas, setLidas] = useState(null);
  const [erroArquivo, setErroArquivo] = useState("");
  const [lendo, setLendo] = useState(false);
  const [mes, setMes] = useState(() => somarMeses(mesDe(new Date()), -1));
  const [escolhas, setEscolhas] = useState({}); // índice da linha → { centroId, equipeId, frenteId }
  const [guardar, setGuardar] = useState({}); // índice da linha → salvar como alocação
  const [equipes, setEquipes] = useState([]);
  const [divisoes, setDivisoes] = useState({}); // índice da linha → { partes, salvarAlocacao }
  const [dividindo, setDividindo] = useState(null);
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
    if (!contrato || lidas) return;
    const proxima = proximaMedicao(contrato);
    if (proxima) setMes(somarMeses(proxima.chave, -1));
  }, [contrato, lidas]);

  const centrosPorId = useMemo(() => Object.fromEntries(centros.map((c) => [c.id, c])), [centros]);
  const equipesPorId = useMemo(() => Object.fromEntries(equipes.map((e) => [e.id, e])), [equipes]);
  const linhas = useMemo(() => {
    if (!lidas) return [];
    return preencherLinhas(lidas, recursos, centros, mes, equipes).map((l, i) => {
      if (divisoes[i]) return { ...l, partes: divisoes[i].partes, dividida: true };
      const e = escolhas[i];
      if (l.partes.length || !e) return l;
      if (!e.centroId) return { ...l, escolhida: true };
      return { ...l, partes: dividir(l, [{ ...e, pct: 100 }], centrosPorId, equipesPorId), escolhida: true };
    });
  }, [lidas, recursos, centros, mes, equipes, escolhas, divisoes, centrosPorId, equipesPorId]);

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

  const semCentro = linhas.filter((l) => !l.partes.length).length;
  const preenchidas = linhas.filter((l) => l.partes.length && !l.escolhida && !l.dividida).length;
  const totais = totaisDaMedicao(linhas);
  const porCentro = totaisPorCentro(linhas);
  const jaExiste = medicoes.find((m) => m.mes === mes);
  const opcoesMes = [];
  for (let i = -12; i <= 1; i++) opcoesMes.push(somarMeses(mesDe(new Date()), i));
  if (!opcoesMes.includes(mes)) opcoesMes.push(mes);
  opcoesMes.sort().reverse();

  async function salvar() {
    setErro("");
    if (jaExiste && !window.confirm(`Já existe a medição de ${rotuloMes(mes)}. Salvar vai substituir a anterior. Continuar?`)) return;
    // Linhas sem alocação em que você escolheu um CC/ODI e marcou "salvar como alocação".
    const novos = new Map();
    const existentes = new Map();
    linhas.forEach((l, i) => {
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
    const linhasParaSalvar = linhas.map((l) => {
      const { escolhida, dividida, ...resto } = l;
      void escolhida;
      void dividida;
      return resto;
    });
    setSalvando(true);
    try {
      await salvarMedicao(contratoId, {
        mes,
        arquivoNome,
        linhas: linhasParaSalvar,
        total: totais.total,
        horas: totais.horas,
        user,
        novosRecursos: [...novos.values()],
        alocacoesExistentes: [...existentes.values()],
        // A medição das horas de outubro é feita em novembro: marca o ciclo seguinte.
        marcarCiclo: contrato.medicao?.ativa ? somarMeses(mes, 1) : null,
      });
      navigate(`/contratos/${contratoId}/medicoes/${mes}`, { replace: true });
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
      {erroArquivo && (
        <div className="texto-alerta" role="alert" style={{ marginTop: 10, fontSize: 13 }}>
          {erroArquivo}
        </div>
      )}

      {lidas && (
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
                · <b className="texto-alerta">{semCentro} {semCentro === 1 ? "precisa" : "precisam"} de você</b> (recurso sem alocação)
              </>
            )}
          </div>
          {jaExiste && (
            <div className="texto-ajuda texto-alerta" style={{ marginTop: 8 }}>
              Já existe a medição de {rotuloMes(mes)}; salvar vai substituir a anterior.
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
                    onDividir={podeEditar && centros.length ? () => setDividindo(dividindo === i ? null : i) : null}
                    dividindo={dividindo === i}
                  />,
                  dividindo === i && (
                    <tr key={`d${i}`}>
                      <td colSpan={9} className="editor">
                        <EditorDivisao
                          linha={l}
                          centros={centros}
                          equipes={equipes}
                          partesIniciais={l.partes}
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

function LinhaPrevia({ linha, mes, centros, equipes, escolha, onEscolher, guardar, onGuardar, onDividir, dividindo }) {
  const l = linha;
  const primeiro = l.recurso.split(" ")[0];
  const acao = (
    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
      {onDividir && (
        <button type="button" className="link-botao" style={{ fontSize: 12 }} onClick={onDividir} aria-expanded={dividindo}>
          {l.partes.length > 1 ? "Editar divisão" : "Dividir"}
        </button>
      )}
    </td>
  );
  const colunasBase = (
    <>
      <td style={{ whiteSpace: "nowrap" }}>{periodoCurto(l.inicio, l.fim)}</td>
      <td>
        <b>{l.recurso}</b>
        {l.justificativa && <div style={{ fontSize: 12, color: "var(--color-gray)" }}>{l.justificativa}</div>}
      </td>
      <td>{l.perfil || "—"}</td>
      <td className="num">
        {l.valorHH != null ? formatarNumero(l.valorHH) : "—"}
        {l.valorCadastrado != null && (
          <div className="texto-alerta" style={{ fontSize: 12 }} title="Valor HH diferente do cadastrado no recurso">
            cadastrado {formatarNumero(l.valorCadastrado)}
          </div>
        )}
      </td>
      <td className="num">{formatarNumero(l.horas, l.horas % 1 ? 2 : 0)}</td>
      <td className="num">{formatarNumero(l.valorTotal)}</td>
    </>
  );

  if (!l.partes.length || l.escolhida) {
    return (
      <tr className={l.partes.length ? "" : "falta"}>
        {colunasBase}
        <td colSpan={2} style={{ minWidth: 260 }}>
          <div className={`escolha-rapida ${l.partes.length ? "" : "pendente"}`} aria-label={`CC/ODI, equipe e frente de ${l.recurso}`} role="group">
            <SeletoresParte parte={escolha} centros={centros} equipes={equipes} indice={0} onMudar={onEscolher} />
          </div>
          {centros.length === 0 && <div className="texto-ajuda">Cadastre os CCs/ODIs na aba Medições.</div>}
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
