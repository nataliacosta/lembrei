import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import CabecalhoContrato from "../components/CabecalhoContrato";
import { CentroTag, EquipeFrente, StatusMedicao } from "../components/AbaMedicoes";
import EditorDivisao, { EditorAlocacao } from "../components/EditorDivisao";
import { watchContrato } from "../lib/contratos";
import { formatarData } from "../lib/datas";
import {
  definirAlocacao,
  dividir,
  formatarHoras,
  formatarNumero,
  formatarReais,
  linhasParaExportar,
  normalizarNome,
  partesParaAlocacao,
  periodoCurto,
  rotuloMes,
  somarMeses,
  totaisDaMedicao,
  totaisPorCentro,
  totaisPorEquipe,
  totaisPorFrente,
  usoDosCentros,
} from "../lib/alocacoes";
import { atualizarMedicao, excluirMedicao, marcarLancada, salvarRecurso, watchCentros, watchEquipes, watchMedicao, watchMedicoes, watchRecursos } from "../lib/medicoesContrato";

function tipoPagamento(tipo) {
  return tipo === "CC" ? "Centro de Custo" : tipo === "ODI" ? "ODI" : "";
}

async function baixarPlanilha(medicao, contrato, { chaves = null, codigos = [] } = {}) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const titulo = (t) => ({ value: t, fontWeight: "bold" });
  const data = (iso) => (iso ? { value: new Date(`${iso}T12:00:00`), type: Date, format: "dd/mm/yyyy" } : null);
  const numero = (v, format = "#,##0.00") => (v == null ? null : { value: Number(v), type: Number, format });
  const linhas = [
    ["Data início", "Data fim", "Nome do Recurso", "Perfil do Recurso", "Valor HH (Perfil)", "Quantidade de Horas", "Valor Total", "Justificativa", "Tipo pagamento", "Centro de Custos / ODI", "Equipe", "Frente"].map(titulo),
    ...linhasParaExportar(medicao.linhas || [], chaves).map((l) => [
      data(l.inicio),
      data(l.fim),
      { value: l.recurso },
      { value: l.perfil || "" },
      numero(l.valorHH),
      numero(l.horas, "#,##0.##"),
      numero(l.valor),
      { value: l.justificativa || "" },
      { value: l.tipoPagamento },
      { value: l.centro },
      { value: l.equipe },
      { value: l.frente },
    ]),
  ];
  const limpar = (t) => String(t).replace(/[^\p{L}\p{N}-]+/gu, "_");
  const sufixo = codigos.length ? `_${codigos.map(limpar).join("_")}`.slice(0, 80) : "";
  const nome = `medicao_${limpar(contrato.titulo || "contrato").slice(0, 40)}_${medicao.mes}${sufixo}.xlsx`;
  const blob = await writeXlsxFile(linhas, { columns: [12, 12, 28, 30, 14, 12, 14, 28, 16, 20, 16, 22].map((width) => ({ width })) }).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export default function MedicaoPage() {
  const { contratoId, mes } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contrato, setContrato] = useState(undefined);
  const [medicao, setMedicao] = useState(undefined);
  const [medicoes, setMedicoes] = useState([]);
  const [centros, setCentros] = useState([]);
  const [editadas, setEditadas] = useState(null); // cópia das linhas enquanto edita
  const [paraAlocar, setParaAlocar] = useState({}); // índice → salvar a divisão como alocação
  const [dividindo, setDividindo] = useState(null);
  const [editandoAloc, setEditandoAloc] = useState(null);
  const [exportando, setExportando] = useState(false);
  const [equipes, setEquipes] = useState([]);
  const [recursos, setRecursos] = useState([]);
  const [copiado, setCopiado] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => watchContrato(contratoId, setContrato), [contratoId]);
  useEffect(() => watchMedicao(contratoId, mes, setMedicao), [contratoId, mes]);
  useEffect(() => watchMedicoes(contratoId, setMedicoes), [contratoId]);
  useEffect(() => watchCentros(contratoId, setCentros), [contratoId]);
  useEffect(() => watchEquipes(contratoId, setEquipes), [contratoId]);
  useEffect(() => watchRecursos(contratoId, setRecursos), [contratoId]);

  const centrosPorId = useMemo(() => Object.fromEntries(centros.map((c) => [c.id, c])), [centros]);
  const equipesPorId = useMemo(() => Object.fromEntries(equipes.map((e) => [e.id, e])), [equipes]);
  const uso = useMemo(() => usoDosCentros(medicoes, mes), [medicoes, mes]);

  if (contrato === undefined || medicao === undefined) return <div className="spinner-wrap">Carregando...</div>;
  if (!contrato) return <div className="spinner-wrap">Contrato não encontrado (ou você não tem acesso).</div>;
  if (!medicao)
    return (
      <div className="spinner-wrap">
        Medição de {rotuloMes(mes)} não encontrada. <Link to={`/contratos/${contratoId}/medicoes`}>Voltar para Medições</Link>
      </div>
    );

  const papel = contrato.membros?.[user.uid];
  const podeEditar = papel === "proprietario" || papel === "editor";
  const linhas = editadas || medicao.linhas || [];
  const porCentro = totaisPorCentro(linhas);
  const semCentro = linhas.filter((l) => !l.partes?.length).length;
  const criadoEm = medicao.criadoEm?.toDate ? medicao.criadoEm.toDate() : null;

  async function copiar(chave, valor) {
    try {
      await navigator.clipboard.writeText(formatarNumero(valor));
      setCopiado(chave);
      setTimeout(() => setCopiado((c) => (c === chave ? "" : c)), 1800);
    } catch {
      window.prompt("Copie o valor:", formatarNumero(valor));
    }
  }

  async function alternarLancada() {
    setOcupado(true);
    try {
      await marcarLancada(contratoId, mes, medicao.status !== "lancada", contrato.medicao?.ativa ? somarMeses(mes, 1) : null);
    } catch (e) {
      console.error(e);
      window.alert("Não deu pra atualizar. Tente de novo.");
    }
    setOcupado(false);
  }

  const editando = editadas !== null;

  async function salvarEdicao() {
    const t = totaisDaMedicao(editadas);
    setOcupado(true);
    try {
      await atualizarMedicao(contratoId, mes, { linhas: editadas, total: t.total, horas: t.horas });
      // Divisões marcadas para virar alocação a partir deste mês.
      const feitos = new Set();
      for (const [i, sim] of Object.entries(paraAlocar)) {
        if (!sim) continue;
        const l = editadas[i];
        const r = recursos.find((x) => x.id === l.recursoId) || recursos.find((x) => normalizarNome(x.nome) === normalizarNome(l.recurso));
        const chave = r?.id || normalizarNome(l.recurso);
        if (feitos.has(chave)) continue;
        feitos.add(chave);
        const partes = partesParaAlocacao(l.partes);
        if (r) await salvarRecurso(contratoId, r.id, { ...r, alocacoes: definirAlocacao(r, mes, partes) });
        else await salvarRecurso(contratoId, null, { nome: l.recurso, perfil: l.perfil, valorHH: l.valorHH, alocacoes: [{ desde: mes, partes }] });
      }
      setEditadas(null);
      setParaAlocar({});
      setDividindo(null);
    } catch (e) {
      console.error(e);
      window.alert("Não deu pra salvar. Tente de novo.");
    }
    setOcupado(false);
  }

  function excluirLinhaEditada(i) {
    if (!window.confirm(`Tirar a linha de ${editadas[i].recurso} desta medição? Ela sai de vez quando você salvar as alterações.`)) return;
    setEditadas(editadas.filter((_, j) => j !== i));
    setParaAlocar(Object.fromEntries(Object.entries(paraAlocar).filter(([k]) => Number(k) !== i).map(([k, v]) => [Number(k) > i ? Number(k) - 1 : Number(k), v])));
    setDividindo(null);
    setEditandoAloc(null);
  }

  async function excluir() {
    if (!window.confirm(`Excluir a medição de ${rotuloMes(mes)}? Essa ação não pode ser desfeita.`)) return;
    await excluirMedicao(contratoId, mes, contrato.medicao?.ativa ? somarMeses(mes, 1) : null);
    navigate(`/contratos/${contratoId}/medicoes`, { replace: true });
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
        <div>
          <div style={{ marginBottom: 10 }}>
            <StatusMedicao status={medicao.status} />
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Medição de {rotuloMes(mes).toLowerCase()}</h1>
          <div style={{ fontSize: 14, color: "var(--color-gray)", marginTop: 4 }}>
            {[medicao.subidaPorNome && `Subida por ${medicao.subidaPorNome}`, criadoEm && `em ${formatarData(criadoEm)}`, medicao.arquivoNome].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" onClick={() => setExportando(!exportando)} aria-expanded={exportando}>
            Baixar planilha ▾
          </button>
          {podeEditar && (
            <button type="button" className={medicao.status === "lancada" ? "btn btn-ghost" : "btn btn-primary"} onClick={alternarLancada} disabled={ocupado}>
              {medicao.status === "lancada" ? "Desmarcar lançada" : "Marcar como lançada no sistema"}
            </button>
          )}
        </div>
      </div>

      {exportando && (
        <PainelExport
          porCentro={totaisPorCentro(medicao.linhas || [])}
          linhas={medicao.linhas || []}
          centrosPorId={centrosPorId}
          onCancelar={() => setExportando(false)}
          onBaixar={async ({ chaves, separar }) => {
            const porChave = Object.fromEntries(totaisPorCentro(medicao.linhas || []).map((t) => [t.centroId || "sem", t]));
            const codigoDe = (k) => (k === "sem" ? "sem_CC" : porChave[k]?.codigo || k);
            const todos = chaves.length === Object.keys(porChave).length;
            try {
              if (separar) {
                for (const k of chaves) {
                  await baixarPlanilha(medicao, contrato, { chaves: [k], codigos: [codigoDe(k)] });
                  await new Promise((r) => setTimeout(r, 400));
                }
              } else {
                await baixarPlanilha(medicao, contrato, todos ? {} : { chaves, codigos: chaves.map(codigoDe) });
              }
              setExportando(false);
            } catch (e) {
              console.error(e);
              window.alert("Não deu pra gerar a planilha.");
            }
          }}
        />
      )}

      <div className="medicao-numeros">
        <div className="lista-card">
          <span style={{ fontSize: 12, color: "var(--color-gray)" }}>Total</span>
          <b>{formatarReais(medicao.total)}</b>
        </div>
        <div className="lista-card">
          <span style={{ fontSize: 12, color: "var(--color-gray)" }}>Horas</span>
          <b>{formatarHoras(medicao.horas)}</b>
        </div>
        <div className="lista-card">
          <span style={{ fontSize: 12, color: "var(--color-gray)" }}>Linhas</span>
          <b>{linhas.length}</b>
        </div>
      </div>

      <h2 style={{ margin: "28px 0 8px", fontSize: 12, fontWeight: 700, color: "var(--color-gray)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Por CC/ODI · para lançar no sistema</h2>
      <div className="lista-card tabela-rolagem">
        <table className="tabela-med">
          <thead>
            <tr>
              <th>CC / ODI</th>
              <th>Tipo pagamento</th>
              <th>Responsável</th>
              <th className="num">Horas</th>
              <th className="num">Valor</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {porCentro.map((t) => {
              const c = t.centroId ? centrosPorId[t.centroId] : null;
              const u = t.centroId ? uso[t.centroId] : null;
              const orc = c?.orcamentoMensal ? { valor: u?.mes || 0, base: c.orcamentoMensal, nome: "mensal" } : c?.orcamentoAnual ? { valor: u?.ano || 0, base: c.orcamentoAnual, nome: "anual" } : null;
              const pct = orc ? Math.round((orc.valor / orc.base) * 100) : null;
              const chave = t.centroId || "sem";
              return (
                <tr key={chave} className={t.centroId ? "" : "falta"}>
                  <td>
                    {t.centroId ? <CentroTag tipo={t.tipo} codigo={t.codigo} /> : <b className="texto-alerta">Sem CC/ODI</b>}
                    {c?.descricao && <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 2 }}>{c.descricao}</div>}
                  </td>
                  <td>{tipoPagamento(t.tipo) || "—"}</td>
                  <td>{c?.responsavel || "—"}</td>
                  <td className="num">{formatarHoras(t.horas)}</td>
                  <td className="num">
                    <b>{formatarReais(t.valor)}</b>
                    {pct !== null && (
                      <div className={pct > 100 ? "texto-alerta" : ""} style={{ fontSize: 12, color: pct > 100 ? undefined : "var(--color-gray)" }}>
                        {pct}% do orçamento {orc.nome}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => copiar(chave, t.valor)} aria-label={`Copiar valor de ${t.codigo || "sem CC/ODI"}`}>
                      {copiado === chave ? "Copiado ✓" : "Copiar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {semCentro > 0 && (
        <div className="texto-ajuda texto-alerta">
          {semCentro} {semCentro === 1 ? "linha está" : "linhas estão"} sem CC/ODI. Use “Editar ou dividir linhas” para completar.
        </div>
      )}

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
        <TabelaTotais titulo="Por equipe" colunaNome="Equipe" itens={totaisPorEquipe(linhas)} nome={(t) => (t.sem ? <span style={{ color: "var(--color-gray)" }}>Sem equipe</span> : <b>{t.equipe}</b>)} />
        <TabelaTotais
          titulo="Por frente"
          colunaNome="Equipe › Frente"
          itens={totaisPorFrente(linhas)}
          nome={(t) =>
            t.sem ? (
              <span style={{ color: "var(--color-gray)" }}>Sem frente</span>
            ) : (
              <>
                <span style={{ color: "var(--color-gray)" }}>{t.equipe} ›</span> <b>{t.frente}</b>
              </>
            )
          }
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "28px 0 8px", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--color-gray)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Linhas · {linhas.length}</h2>
        {podeEditar &&
          (editando ? (
            <span style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => (setEditadas(null), setParaAlocar({}), setDividindo(null), setEditandoAloc(null))}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={salvarEdicao} disabled={ocupado || dividindo !== null || editandoAloc !== null}>
                Salvar alterações
              </button>
            </span>
          ) : (
            <button type="button" className="link-botao" onClick={() => setEditadas((medicao.linhas || []).map((l) => ({ ...l })))}>
              Editar ou dividir linhas
            </button>
          ))}
      </div>
      <div className="texto-ajuda" style={{ margin: "-2px 0 8px" }}>
        Preenchida com as alocações de {rotuloMes(mes).toLowerCase()}. Mudar as alocações depois não altera esta medição.
      </div>
      <div className="lista-card tabela-rolagem">
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
              {editando && <th />}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => {
              const primeiro = l.recurso.split(" ")[0];
              const base = (
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
                      <div className="texto-alerta" style={{ fontSize: 12 }}>
                        cadastrado {formatarNumero(l.valorCadastrado)}
                      </div>
                    )}
                  </td>
                  <td className="num">{formatarNumero(l.horas, l.horas % 1 ? 2 : 0)}</td>
                  <td className="num">{formatarNumero(l.valorTotal)}</td>
                </>
              );
              const acao = editando ? (
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button type="button" className="link-botao" style={{ fontSize: 12, display: "block", marginLeft: "auto" }} onClick={() => (setEditandoAloc(null), setDividindo(dividindo === i ? null : i))} aria-expanded={dividindo === i}>
                    {l.partes?.length > 1 ? "Editar divisão" : l.partes?.length ? "Dividir ou trocar" : "Escolher CC/ODI"}
                  </button>
                  <button type="button" className="link-botao" style={{ fontSize: 12, display: "block", marginLeft: "auto", marginTop: 6 }} onClick={() => (setDividindo(null), setEditandoAloc(editandoAloc === i ? null : i))} aria-expanded={editandoAloc === i}>
                    Editar alocação
                  </button>
                  <button type="button" className="link-botao" style={{ fontSize: 12, display: "block", marginLeft: "auto", marginTop: 6, color: "var(--color-orange)" }} onClick={() => excluirLinhaEditada(i)}>
                    Excluir linha
                  </button>
                </td>
              ) : null;
              const recursoDaLinha = recursos.find((x) => x.id === l.recursoId) || recursos.find((x) => normalizarNome(x.nome) === normalizarNome(l.recurso)) || null;
              const editor =
                editandoAloc === i ? (
                  <tr key={`a${i}`}>
                    <td colSpan={9} className="editor">
                      <EditorAlocacao
                        contratoId={contratoId}
                        recurso={recursoDaLinha}
                        linha={l}
                        centros={centros}
                        equipes={equipes}
                        mes={mes}
                        onCancelar={() => setEditandoAloc(null)}
                        onSalvo={({ partes, desde }) => {
                          // Se a alocação nova vale para o mês desta medição, refaz a linha.
                          if (desde <= mes) setEditadas(editadas.map((x, j) => (j === i ? { ...x, partes: dividir(x, partes, centrosPorId, equipesPorId) } : x)));
                          setEditandoAloc(null);
                        }}
                      />
                    </td>
                  </tr>
                ) : dividindo === i ? (
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
                          setEditadas(editadas.map((x, j) => (j === i ? { ...x, partes } : x)));
                          setParaAlocar({ ...paraAlocar, [i]: salvarAlocacao });
                          setDividindo(null);
                        }}
                      />
                    </td>
                  </tr>
                ) : null;
              if (!l.partes?.length) {
                return (
                  [
                    <tr key={i} className="falta">
                      {base}
                      <td colSpan={2} className="texto-alerta" style={{ fontSize: 12, fontWeight: 600 }}>
                        Sem CC/ODI
                      </td>
                      {acao}
                    </tr>,
                    editor,
                  ]
                );
              }
              if (l.partes.length === 1) {
                const p = l.partes[0];
                return (
                  [
                    <tr key={i}>
                      {base}
                      <td>{tipoPagamento(p.tipo)}</td>
                      <td>
                        <CentroTag tipo={p.tipo} codigo={p.codigo} />
                        <EquipeFrente equipe={p.equipe} frente={p.frente} />
                      </td>
                      {acao}
                    </tr>,
                    editor,
                  ]
                );
              }
              return [
                <tr key={i}>
                  {base}
                  <td colSpan={2} style={{ fontSize: 12, color: "var(--color-gray)" }}>
                    dividido em {l.partes.length} ↓
                  </td>
                  {acao}
                </tr>,
                editor,
                ...l.partes.map((p, j) => (
                  <tr key={`${i}-${j}`} className="sub">
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
                    {editando && <td />}
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>

      {podeEditar && (
        <div style={{ marginTop: 16 }}>
          <button type="button" className="link-botao" style={{ color: "var(--color-orange)" }} onClick={excluir}>
            Excluir medição
          </button>
        </div>
      )}
    </div>
  );
}

function TabelaTotais({ titulo, colunaNome, itens, nome }) {
  return (
    <div style={{ flex: "1 1 380px", minWidth: 0 }}>
      <h2 style={{ margin: "28px 0 8px", fontSize: 12, fontWeight: 700, color: "var(--color-gray)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{titulo}</h2>
      <div className="lista-card tabela-rolagem">
        <table className="tabela-med">
          <thead>
            <tr>
              <th>{colunaNome}</th>
              <th className="num">Horas</th>
              <th className="num">Valor</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((t) => (
              <tr key={t.chave}>
                <td>{nome(t)}</td>
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
  );
}

// Escolher quais CC/ODIs vão na planilha (e se sai um arquivo para cada).
function PainelExport({ porCentro, linhas, centrosPorId, onCancelar, onBaixar }) {
  const chaveDe = (t) => t.centroId || "sem";
  const [marcados, setMarcados] = useState(() => porCentro.filter((t) => t.centroId).map(chaveDe));
  const [separar, setSeparar] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const responsaveis = [...new Set(porCentro.map((t) => (t.centroId ? centrosPorId[t.centroId]?.responsavel : "")).filter(Boolean))].sort();
  const escolhidos = porCentro.filter((t) => marcados.includes(chaveDe(t)));
  const total = escolhidos.reduce((s, t) => s + Math.round(t.valor * 100), 0) / 100;
  const qtdLinhas = linhasParaExportar(linhas, marcados).length;

  function alternar(k) {
    setMarcados(marcados.includes(k) ? marcados.filter((x) => x !== k) : [...marcados, k]);
  }

  async function baixar() {
    setBaixando(true);
    await onBaixar({ chaves: porCentro.map(chaveDe).filter((k) => marcados.includes(k)), separar });
    setBaixando(false);
  }

  return (
    <div className="lista-card painel-export" role="dialog" aria-label="Quais CC/ODIs vão na planilha?">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Quais CC/ODIs vão na planilha?</div>
        <span style={{ fontSize: 13 }}>
          <button type="button" className="link-botao" onClick={() => setMarcados(porCentro.filter((t) => t.centroId).map(chaveDe))}>
            Marcar todos
          </button>
          {" · "}
          <button type="button" className="link-botao" onClick={() => setMarcados([])}>
            Desmarcar
          </button>
        </span>
      </div>
      {responsaveis.length > 0 && (
        <div className="chips-row" style={{ marginTop: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--color-gray)" }}>Por responsável:</span>
          {responsaveis.map((r) => {
            const deles = porCentro.filter((t) => t.centroId && centrosPorId[t.centroId]?.responsavel === r).map(chaveDe);
            const ativo = deles.length === marcados.length && deles.every((k) => marcados.includes(k));
            return (
              <button key={r} type="button" className="chip" aria-pressed={ativo} onClick={() => setMarcados(deles)}>
                {r}
              </button>
            );
          })}
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        {porCentro.map((t) => {
          const k = chaveDe(t);
          const c = t.centroId ? centrosPorId[t.centroId] : null;
          return (
            <label key={k} className="linha-export">
              <input type="checkbox" checked={marcados.includes(k)} onChange={() => alternar(k)} />
              <span>
                {t.centroId ? <CentroTag tipo={t.tipo} codigo={t.codigo} /> : <span style={{ color: "var(--color-gray)" }}>Linhas sem CC/ODI</span>}
                {c?.descricao && <span style={{ display: "block", fontSize: 12, color: "var(--color-gray)" }}>{c.descricao}</span>}
              </span>
              <span>{c?.responsavel || ""}</span>
              <span style={{ textAlign: "right", fontWeight: 700 }}>{formatarReais(t.valor)}</span>
            </label>
          );
        })}
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginTop: 10, fontWeight: 400 }}>
        <input type="checkbox" checked={separar} onChange={(e) => setSeparar(e.target.checked)} style={{ width: 18, height: 18 }} />
        Um arquivo para cada CC/ODI marcado
      </label>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap", borderTop: "1px solid var(--color-border)", paddingTop: 12 }}>
        <span style={{ fontSize: 13 }}>
          <b>
            {escolhidos.length} de {porCentro.length}
          </b>{" "}
          CC/ODIs · <b>{formatarReais(total)}</b> · {qtdLinhas} {qtdLinhas === 1 ? "linha" : "linhas"}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={baixar} disabled={baixando || !marcados.length}>
            {baixando ? "Gerando..." : separar && marcados.length > 1 ? `Baixar ${marcados.length} planilhas` : "Baixar planilha"}
          </button>
        </span>
      </div>
      <div className="texto-ajuda">O nome do arquivo leva os códigos escolhidos. Linhas divididas entram só com a parte de cada CC/ODI escolhido.</div>
    </div>
  );
}
