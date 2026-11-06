import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import CabecalhoContrato from "../components/CabecalhoContrato";
import { CentroTag, StatusMedicao } from "../components/AbaMedicoes";
import { watchContrato } from "../lib/contratos";
import { formatarData } from "../lib/datas";
import {
  dividir,
  formatarHoras,
  formatarNumero,
  formatarReais,
  linhasParaExportar,
  periodoCurto,
  rotuloMes,
  totaisDaMedicao,
  totaisPorCentro,
  usoDosCentros,
} from "../lib/alocacoes";
import { atualizarMedicao, excluirMedicao, marcarLancada, watchCentros, watchMedicao, watchMedicoes } from "../lib/medicoesContrato";

function tipoPagamento(tipo) {
  return tipo === "CC" ? "Centro de Custo" : tipo === "ODI" ? "ODI" : "";
}

async function baixarPlanilha(medicao, contrato) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const titulo = (t) => ({ value: t, fontWeight: "bold" });
  const data = (iso) => (iso ? { value: new Date(`${iso}T12:00:00`), type: Date, format: "dd/mm/yyyy" } : null);
  const numero = (v, format = "#,##0.00") => (v == null ? null : { value: Number(v), type: Number, format });
  const linhas = [
    ["Data início", "Data fim", "Nome do Recurso", "Perfil do Recurso", "Valor HH (Perfil)", "Quantidade de Horas", "Valor Total", "Justificativa", "Tipo pagamento", "Centro de Custos / ODI"].map(titulo),
    ...linhasParaExportar(medicao.linhas || []).map((l) => [
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
    ]),
  ];
  const nome = `medicao_${(contrato.titulo || "contrato").replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 40)}_${medicao.mes}.xlsx`;
  const blob = await writeXlsxFile(linhas, { columns: [12, 12, 28, 30, 14, 12, 14, 28, 16, 20].map((width) => ({ width })) }).toBlob();
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
  const [editando, setEditando] = useState(false);
  const [trocas, setTrocas] = useState({});
  const [copiado, setCopiado] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => watchContrato(contratoId, setContrato), [contratoId]);
  useEffect(() => watchMedicao(contratoId, mes, setMedicao), [contratoId, mes]);
  useEffect(() => watchMedicoes(contratoId, setMedicoes), [contratoId]);
  useEffect(() => watchCentros(contratoId, setCentros), [contratoId]);

  const centrosPorId = useMemo(() => Object.fromEntries(centros.map((c) => [c.id, c])), [centros]);
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
  const linhas = medicao.linhas || [];
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
      await marcarLancada(contratoId, mes, medicao.status !== "lancada");
    } catch (e) {
      console.error(e);
      window.alert("Não deu pra atualizar. Tente de novo.");
    }
    setOcupado(false);
  }

  async function salvarTrocas() {
    const novas = linhas.map((l, i) => (trocas[i] ? { ...l, partes: dividir(l, [{ centroId: trocas[i], pct: 100 }], centrosPorId) } : l));
    const t = totaisDaMedicao(novas);
    setOcupado(true);
    try {
      await atualizarMedicao(contratoId, mes, { linhas: novas, total: t.total, horas: t.horas });
      setEditando(false);
      setTrocas({});
    } catch (e) {
      console.error(e);
      window.alert("Não deu pra salvar. Tente de novo.");
    }
    setOcupado(false);
  }

  async function excluir() {
    if (!window.confirm(`Excluir a medição de ${rotuloMes(mes)}? Essa ação não pode ser desfeita.`)) return;
    await excluirMedicao(contratoId, mes);
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
          <button type="button" className="btn btn-ghost" onClick={() => baixarPlanilha(medicao, contrato).catch((e) => (console.error(e), window.alert("Não deu pra gerar a planilha.")))}>
            Baixar planilha preenchida
          </button>
          {podeEditar && (
            <button type="button" className={medicao.status === "lancada" ? "btn btn-ghost" : "btn btn-primary"} onClick={alternarLancada} disabled={ocupado}>
              {medicao.status === "lancada" ? "Desmarcar lançada" : "Marcar como lançada no sistema"}
            </button>
          )}
        </div>
      </div>

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
          {semCentro} {semCentro === 1 ? "linha está" : "linhas estão"} sem CC/ODI. Use “Editar CC/ODI das linhas” para completar.
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "28px 0 8px", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--color-gray)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Linhas · {linhas.length}</h2>
        {podeEditar &&
          (editando ? (
            <span style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => (setEditando(false), setTrocas({}))}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={salvarTrocas} disabled={ocupado || !Object.keys(trocas).length}>
                Salvar CC/ODI
              </button>
            </span>
          ) : (
            <button type="button" className="link-botao" onClick={() => setEditando(true)}>
              Editar CC/ODI das linhas
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
              <th>CC / ODI</th>
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
              if (editando) {
                return (
                  <tr key={i} className={l.partes?.length ? "" : "falta"}>
                    {base}
                    <td colSpan={2} style={{ minWidth: 240 }}>
                      <select value={trocas[i] || ""} onChange={(e) => setTrocas({ ...trocas, [i]: e.target.value })} aria-label={`CC ou ODI de ${l.recurso}`} style={{ padding: "6px 8px" }}>
                        <option value="">
                          {l.partes?.length ? `Como está (${l.partes.map((p) => `${p.tipo} ${p.codigo}${l.partes.length > 1 ? ` ${p.pct}%` : ""}`).join(" + ")})` : "Escolher CC/ODI…"}
                        </option>
                        {centros.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.tipo} {c.codigo}
                            {c.descricao ? ` · ${c.descricao}` : ""} (100%)
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              }
              if (!l.partes?.length) {
                return (
                  <tr key={i} className="falta">
                    {base}
                    <td colSpan={2} className="texto-alerta" style={{ fontSize: 12, fontWeight: 600 }}>
                      Sem CC/ODI
                    </td>
                  </tr>
                );
              }
              if (l.partes.length === 1) {
                const p = l.partes[0];
                return (
                  <tr key={i}>
                    {base}
                    <td>{tipoPagamento(p.tipo)}</td>
                    <td>
                      <CentroTag tipo={p.tipo} codigo={p.codigo} />
                    </td>
                  </tr>
                );
              }
              return [
                <tr key={i}>
                  {base}
                  <td colSpan={2} style={{ fontSize: 12, color: "var(--color-gray)" }}>
                    dividido em {l.partes.length} ↓
                  </td>
                </tr>,
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
                    </td>
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
