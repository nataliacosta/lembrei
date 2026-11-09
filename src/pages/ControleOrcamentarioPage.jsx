import { useMemo, useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useDados } from "../contexts/DadosContext";
import { CentroTag } from "../components/AbaMedicoes";
import { useOrcamentosVigentes } from "../hooks/useOrcamentosVigentes";
import { useMedicoesDosContratos } from "../hooks/useMedicoesDosContratos";
import { useCentrosDisponiveis } from "../hooks/useCentrosDisponiveis";
import { formatarNumero, formatarReais, mesDe, normalizarNome, rotuloMes } from "../lib/alocacoes";
import { MESES } from "../lib/orcamentos";
import { controleDoAno } from "../lib/controle";
import { excluirCentroFora, salvarCentroFora } from "../lib/centros";
import { formatarData } from "../lib/datas";

const rotulo = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--color-gray)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" };
const mil = (v) => (v ? `${formatarNumero(v / 1000, (v / 1000) % 1 ? 1 : 0)}k` : "—");
const secaoTitulo = { margin: "28px 0 8px", fontSize: 12, fontWeight: 700, color: "var(--color-gray)", textTransform: "uppercase", letterSpacing: "0.05em" };

export default function ControleOrcamentarioPage() {
  const { aba } = useParams();
  const { porAno, carregando } = useOrcamentosVigentes();
  const anos = Object.keys(porAno).map(Number).sort((a, b) => b - a);
  const anoAtual = new Date().getFullYear();
  const [anoEscolhido, setAno] = useState(null);
  const ano = anoEscolhido ?? (anos.includes(anoAtual) || !anos.length ? anoAtual : anos[0]);
  // No seletor: os anos com orçamento efetivado e o ano atual (para cadastrar
  // ODIs de fora antes de existir orçamento).
  const anosDoSeletor = [...new Set([...anos, anoAtual, ano])].sort((a, b) => b - a);

  return (
    <div className="page-shell" style={{ paddingTop: 24, paddingBottom: 80, maxWidth: 1280 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Controle orçamentário</h1>
            <Link to="/orcamentos" className="link-orcamentos" style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
              Orçamentos ›
            </Link>
          </div>
          <div style={{ fontSize: 14, color: "var(--color-gray)", marginTop: 4 }}>Orçado na última versão efetivada × realizado nas medições lançadas no sistema</div>
        </div>
        <label style={{ width: 280, maxWidth: "100%", margin: 0 }}>
          <span style={rotulo}>Ano</span>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anosDoSeletor.map((a) => (
              <option key={a} value={a}>
                {a} · {porAno[a] ? `Orçamento ${porAno[a].versao.versao} (efetivada)` : "sem orçamento efetivado"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <nav className="abas-contrato" aria-label="Seções do controle orçamentário">
        <NavLink to="/controle-orcamentario" end aria-current={aba !== "odis" ? "page" : undefined}>
          Visão geral
        </NavLink>
        <NavLink to="/controle-orcamentario/odis" aria-current={aba === "odis" ? "page" : undefined}>
          ODIs e CCs
        </NavLink>
      </nav>
      {aba === "odis" ? (
        <AbaOdis ano={ano} />
      ) : carregando && !anos.length ? (
        <div className="spinner-wrap">Carregando...</div>
      ) : !porAno[ano] ? (
        <div className="empty-state" style={{ marginTop: 20 }}>
          Ainda não há orçamento efetivado para {ano}. Marque uma versão como <b>Efetivada</b> em <Link to="/orcamentos">Orçamentos</Link> para começar o controle.
        </div>
      ) : (
        <VisaoGeral ano={ano} vigente={porAno[ano]} />
      )}
    </div>
  );
}

function Barra({ pct }) {
  return (
    <div className={`barra-uso ${pct > 100 ? "acima" : ""}`}>
      <span style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function dataDe(ts) {
  const d = ts?.toDate ? ts.toDate() : ts?.seconds ? new Date(ts.seconds * 1000) : null;
  return d ? formatarData(d) : null;
}

function VisaoGeral({ ano, vigente }) {
  const { contratos } = useDados();
  const { medicoes, carregando } = useMedicoesDosContratos(contratos);
  const { porId: centrosPorId } = useCentrosDisponiveis();
  const [aberta, setAberta] = useState(null);
  const [busca, setBusca] = useState("");
  const [todasDe, setTodasDe] = useState({});
  const r = useMemo(() => controleDoAno(vigente.linhas, medicoes, ano), [vigente, medicoes, ano]);
  const hoje = new Date();
  const idxMes = hoje.getFullYear() === ano ? hoje.getMonth() : null;
  const t = normalizarNome(busca);
  const odis = r.odis.filter((o) => !t || [o.codigo, ...o.linhas.flatMap((l) => [l.linha, l.projeto, l.fornecedor])].some((x) => normalizarNome(x).includes(t)));
  const pctTotal = r.totais.orcado ? Math.round((r.totais.realizado / r.totais.orcado) * 100) : 0;

  return (
    <>
      <div className="medicao-numeros controle-numeros">
        <div className="lista-card">
          <span style={{ fontSize: 12, color: "var(--color-gray)" }}>Orçado em {ano}</span>
          <b>{formatarReais(r.totais.orcado)}</b>
        </div>
        <div className="lista-card">
          <span style={{ fontSize: 12, color: "var(--color-gray)" }}>Realizado (lançado)</span>
          <b>{formatarReais(r.totais.realizado)}</b>
        </div>
        <div className="lista-card">
          <span style={{ fontSize: 12, color: "var(--color-gray)" }}>Saldo</span>
          <b className={r.totais.saldo < 0 ? "texto-alerta" : ""}>{formatarReais(r.totais.saldo)}</b>
        </div>
        <div className="lista-card">
          <span style={{ fontSize: 12, color: "var(--color-gray)" }}>Usado no ano</span>
          <b>{pctTotal}%</b>
          <Barra pct={pctTotal} />
        </div>
      </div>
      <div className="texto-ajuda">
        A medição das horas de um mês é paga no mês seguinte (a de outubro consome novembro), e só conta depois de marcada como lançada no sistema. Fonte: Orçamento {ano} · {vigente.versao.versao}.
        {carregando && " Carregando medições…"}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={secaoTitulo}>ODIs do orçamento · {r.odis.length}</h2>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar ODI, linha, projeto…" aria-label="Buscar ODI" style={{ width: 240, padding: "6px 10px" }} />
      </div>
      <div className="lista-card">
        <table className="tabela-med tabela-orc2 tabela-controle">
          <thead>
            <tr>
              <th>ODI · Linha</th>
              <th className="num esconde-mob">Orçado no ano</th>
              <th className="num">Realizado</th>
              <th className="num">Saldo</th>
              <th className="esconde-mob">Uso</th>
              {idxMes !== null && <th className="num esconde-mob esconde-tablet">Mês atual</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {odis.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: "var(--color-gray)" }}>
                  {r.odis.length ? "Nada com essa busca." : "Nenhuma linha do orçamento tem ODI preenchida (veja a visão condensada do orçamento)."}
                </td>
              </tr>
            )}
            {odis.map((o) => {
              const pct = o.orcado.total ? Math.round((o.realizado.total / o.orcado.total) * 100) : o.realizado.total ? 999 : 0;
              const estaAberta = aberta === o.id;
              const l0 = o.linhas[0] || {};
              const verTodas = todasDe[o.id];
              return [
                <tr key={o.id} className={estaAberta ? "aberta" : ""}>
                  <td>
                    <CentroTag tipo="ODI" codigo={o.codigo} />
                    <div className="sub">
                      {[l0.linha, l0.projeto, l0.fornecedor].filter(Boolean).join(" · ")}
                      {o.linhas.length > 1 ? ` (+${o.linhas.length - 1} ${o.linhas.length === 2 ? "linha" : "linhas"})` : ""}
                    </div>
                  </td>
                  <td className="num esconde-mob">{formatarReais(o.orcado.total)}</td>
                  <td className="num">{formatarReais(o.realizado.total)}</td>
                  <td className={`num ${o.saldo < 0 ? "texto-alerta" : ""}`}>
                    <b>{formatarReais(o.saldo)}</b>
                    <div className="so-mob sub">{pct > 900 ? "sem orçado" : `${pct}% de ${mil(o.orcado.total)}`}</div>
                  </td>
                  <td className="esconde-mob" style={{ minWidth: 130 }}>
                    <Barra pct={pct} />
                    <div className={pct > 100 ? "texto-alerta" : ""} style={{ fontSize: 12, color: pct > 100 ? undefined : "var(--color-gray)" }}>
                      {pct > 900 ? "sem orçado" : `${pct}% do ano`}
                    </div>
                  </td>
                  {idxMes !== null && (
                    <td className="num esconde-mob esconde-tablet">
                      {o.orcado.meses[idxMes] || o.realizado.meses[idxMes] ? (
                        <div>
                          {formatarNumero(o.realizado.meses[idxMes])} <span style={{ color: "var(--color-gray)", fontSize: 12 }}>de</span> {formatarNumero(o.orcado.meses[idxMes])}
                        </div>
                      ) : (
                        <div style={{ color: "var(--color-gray)" }}>—</div>
                      )}
                      <div className="sub">{rotuloMes(mesDe(hoje)).split("/")[0].toLowerCase()}</div>
                    </td>
                  )}
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="link-botao" onClick={() => setAberta(estaAberta ? null : o.id)} aria-expanded={estaAberta} aria-label={`${estaAberta ? "Fechar" : "Abrir"} ODI ${o.codigo}`}>
                      <span className="esconde-mob">{estaAberta ? "Fechar " : "Abrir "}</span>
                      {estaAberta ? "▴" : "▾"}
                    </button>
                  </td>
                </tr>,
                estaAberta && (
                  <tr key={`${o.id}-aberta`}>
                    <td colSpan={7} className="editor">
                      <div style={{ fontSize: 12, color: "var(--color-gray)", marginBottom: 6 }}>Por mês de pagamento · em cima o orçado, embaixo o realizado</div>
                      <div className="grade-meses">
                        {MESES.map((m, i) => (
                          <div key={m} className="mes-cartao" style={i === idxMes ? { borderColor: "var(--color-primary)" } : undefined}>
                            <span>{m}</span>
                            <div style={{ fontSize: 12 }}>{mil(o.orcado.meses[i])}</div>
                            <b style={{ color: o.realizado.meses[i] > o.orcado.meses[i] ? "var(--color-orange)" : "var(--color-primary-dark)" }}>{mil(o.realizado.meses[i])}</b>
                          </div>
                        ))}
                      </div>
                      {o.linhas.length > 1 && (
                        <div className="texto-ajuda">Linhas do orçamento com esta ODI: {o.linhas.map((l) => [l.linha, l.projeto].filter(Boolean).join(" · ")).join("; ")}.</div>
                      )}
                      <Historico item={o} nome="nesta ODI" todas={verTodas} onTodas={() => setTodasDe({ ...todasDe, [o.id]: true })} />
                    </td>
                  </tr>
                ),
              ];
            })}
            {odis.length > 0 && (
              <tr className="total">
                <td>Total no orçamento</td>
                <td className="num esconde-mob">{formatarReais(r.totais.orcado)}</td>
                <td className="num">{formatarReais(r.totais.realizado)}</td>
                <td className="num">{formatarReais(r.totais.saldo)}</td>
                <td colSpan={idxMes !== null ? 3 : 2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={secaoTitulo}>Fora do orçamento · sem controle</h2>
        <Link to="/controle-orcamentario/odis" style={{ fontSize: 13, fontWeight: 600 }}>
          Ver ODIs e CCs
        </Link>
      </div>
      <div className="lista-card">
        <table className="tabela-med tabela-orc2 tabela-controle">
          <thead>
            <tr>
              <th>CC / ODI</th>
              <th className="esconde-mob">Usado em</th>
              <th className="num">Lançado em {ano}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {r.fora.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: "var(--color-gray)" }}>
                  Nenhuma medição com CC/ODI fora do orçamento em {ano}.
                </td>
              </tr>
            )}
            {r.fora.map((f) => {
              const chave = `fora:${f.id}`;
              const estaAberta = aberta === chave;
              return [
                <tr key={f.id} className={estaAberta ? "aberta" : ""}>
                  <td>
                    <CentroTag tipo={f.tipo} codigo={f.codigo} />
                    {centrosPorId[f.id]?.descricao && <div className="sub">{centrosPorId[f.id].descricao}</div>}
                    <div className="sub so-mob">{f.contratos.join(", ")}</div>
                  </td>
                  <td className="esconde-mob">{f.contratos.join(", ") || "—"}</td>
                  <td className="num">
                    {formatarReais(f.realizado.total)}
                    {f.pendentes.length > 0 && <div className="sub">+ {formatarReais(f.pendentes.reduce((s, x) => s + x.valor, 0))} a lançar</div>}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="link-botao" onClick={() => setAberta(estaAberta ? null : chave)} aria-expanded={estaAberta} aria-label={`${estaAberta ? "Fechar" : "Abrir"} ${f.tipo} ${f.codigo}`}>
                      <span className="esconde-mob">{estaAberta ? "Fechar " : "Abrir "}</span>
                      {estaAberta ? "▴" : "▾"}
                    </button>
                  </td>
                </tr>,
                estaAberta && (
                  <tr key={`${f.id}-aberta`}>
                    <td colSpan={4} className="editor">
                      <div style={{ fontSize: 12, color: "var(--color-gray)", marginBottom: 6 }}>Lançado por mês de pagamento</div>
                      <div className="grade-meses">
                        {MESES.map((m, i) => (
                          <div key={m} className="mes-cartao" style={i === idxMes ? { borderColor: "var(--color-primary)" } : undefined}>
                            <span>{m}</span>
                            <b style={{ color: "var(--color-primary-dark)" }}>{mil(f.realizado.meses[i])}</b>
                          </div>
                        ))}
                      </div>
                      <Historico item={f} nome={`neste ${f.tipo}`} todas={todasDe[chave]} onTodas={() => setTodasDe({ ...todasDe, [chave]: true })} />
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
      <div className="texto-ajuda">Só para referência: esses não estão no seu orçamento, então não têm orçado nem saldo.</div>
    </>
  );
}

// Medições lançadas (as mais recentes, com "mostrar todas") e as que ainda não contam.
function Historico({ item, nome, todas, onTodas }) {
  const { lancamentos, pendentes } = item;
  return (
    <>
      <div style={{ ...secaoTitulo, margin: "14px 0 4px" }}>
        Lançado {nome} · {lancamentos.length} {lancamentos.length === 1 ? "medição" : "medições"}
      </div>
      {lancamentos.length === 0 && <div style={{ fontSize: 13, color: "var(--color-gray)" }}>Nenhuma medição lançada ainda.</div>}
      {(todas ? lancamentos : lancamentos.slice(0, 5)).map((x) => (
        <LinhaLancamento key={`${x.contratoId}-${x.mes}`} x={x} />
      ))}
      {!todas && lancamentos.length > 5 && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: "1px solid #eef1f0", fontSize: 13, color: "var(--color-gray)" }}>
          <span>+ {lancamentos.length - 5} medições anteriores</span>
          <button type="button" className="link-botao" onClick={onTodas}>
            mostrar todas
          </button>
        </div>
      )}
      {pendentes.length > 0 && (
        <div style={{ marginTop: 8, padding: "10px 12px", border: "1px dashed #cdd9d7", borderRadius: 8, fontSize: 13, color: "var(--color-gray)" }}>
          <b style={{ color: "var(--color-dark)" }}>Ainda não conta:</b>{" "}
          {pendentes.map((x, i) => (
            <span key={i}>
              {i > 0 && "; "}
              <Link to={`/contratos/${x.contratoId}/medicoes/${x.mes}`}>medição de {rotuloMes(x.mes).toLowerCase()}</Link> · {x.contratoTitulo} · {formatarReais(x.valor)} (vai contar em {rotuloMes(x.mesPagamento).split("/")[0].toLowerCase()})
            </span>
          ))}{" "}
          — falta marcar como lançada no sistema.
        </div>
      )}
    </>
  );
}

function LinhaLancamento({ x }) {
  const lancada = dataDe(x.lancadaEm);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderTop: "1px solid #eef1f0", fontSize: 13, flexWrap: "wrap" }}>
      <span style={{ flex: "1 1 220px", minWidth: 0 }}>
        <b>Medição de {rotuloMes(x.mes).toLowerCase()}</b> · {x.contratoTitulo}{" "}
        <span style={{ color: "var(--color-gray)", fontSize: 12 }}>
          · paga em {rotuloMes(x.mesPagamento).split("/")[0].toLowerCase()}
          {lancada ? ` · lançada em ${lancada}` : ""}
        </span>
      </span>
      <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <b>{formatarReais(x.valor)}</b>
        <Link to={`/contratos/${x.contratoId}/medicoes/${x.mes}`} style={{ fontWeight: 600 }}>
          ver medição
        </Link>
      </span>
    </div>
  );
}

// ---------- ODIs e CCs ----------

function AbaOdis({ ano }) {
  const { user } = useAuth();
  const { opcoes, carregando } = useCentrosDisponiveis();
  const [editando, setEditando] = useState(null); // docId ou "novo"
  const [trazendo, setTrazendo] = useState(false);
  const doOrcamento = opcoes.filter((o) => o.origem === "orcamento" && o.anos.includes(ano)).map((o) => ({ ...o, ...o.porAno[ano], ano }));
  // CCs valem sempre; ODIs de fora, só no ano delas.
  const fora = opcoes
    .filter((o) => o.origem === "fora" && (o.anoFora == null || o.anoFora === ano))
    .sort((a, b) => (a.tipo === b.tipo ? String(a.codigo).localeCompare(String(b.codigo)) : a.tipo === "CC" ? -1 : 1));
  const codigosNoAno = new Set(fora.filter((o) => o.tipo === "ODI").map((o) => o.id));
  const doAnoAnterior = opcoes.filter((o) => o.origem === "fora" && o.anoFora === ano - 1 && !codigosNoAno.has(o.id));
  const COLS = 5;

  return (
    <>
      <div className="texto-ajuda" style={{ marginTop: 12 }}>
        É a lista que aparece nas alocações dos contratos para custos de {ano} (pelo mês de pagamento: as horas de dezembro já contam no ano seguinte). As do orçamento entram sozinhas; as outras você cadastra aqui (ou direto na hora de escolher).
      </div>
      <h2 style={secaoTitulo}>
        Do orçamento {ano} · {doOrcamento.length}
      </h2>
      <div className="lista-card">
        <table className="tabela-med tabela-orc2 tabela-controle">
          <thead>
            <tr>
              <th>ODI</th>
              <th>Linha · Projeto</th>
              <th className="esconde-mob">Fornecedor</th>
              <th>Origem</th>
            </tr>
          </thead>
          <tbody>
            {doOrcamento.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: "var(--color-gray)" }}>
                  {carregando ? "Carregando…" : `Nenhuma ODI em ${ano}: elas vêm das linhas da última versão efetivada do orçamento do ano.`}
                </td>
              </tr>
            )}
            {doOrcamento.map((o) => (
              <tr key={o.id}>
                <td>
                  <CentroTag tipo="ODI" codigo={o.codigo} />
                </td>
                <td>{o.descricao || "—"}</td>
                <td className="esconde-mob">{o.fornecedor || "—"}</td>
                <td>
                  <span className="pill" style={{ background: "#e0f5ef", color: "var(--color-primary-dark)" }}>
                    Orçamento {o.ano}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={secaoTitulo}>Fora do orçamento · {fora.length}</h2>
        <button type="button" className="link-botao" onClick={() => setEditando("novo")}>
          + Novo CC ou ODI
        </button>
      </div>
      <div className="texto-ajuda" style={{ margin: "-2px 0 8px" }}>
        CCs valem para todos os anos. ODIs fora do orçamento valem só para o ano em que foram cadastradas: na virada do ano a lista de ODIs começa vazia.
        {doAnoAnterior.length > 0 && ` Use “Trazer de ${ano - 1}” para repetir as que continuam.`}
      </div>
      <div className="lista-card">
        <table className="tabela-med tabela-orc2 tabela-controle">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th className="esconde-mob">Responsável</th>
              <th>Vale para</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {editando === "novo" && (
              <tr>
                <td colSpan={COLS} className="editor">
                  <EditorCentroFora uid={user.uid} centro={null} ano={ano} onFechar={() => setEditando(null)} />
                </td>
              </tr>
            )}
            {fora.length === 0 && editando !== "novo" && (
              <tr>
                <td colSpan={COLS} style={{ color: "var(--color-gray)" }}>
                  Nenhum CC ou ODI fora do orçamento em {ano}.
                </td>
              </tr>
            )}
            {fora.map((c) =>
              editando === c.docId ? (
                <tr key={c.docId}>
                  <td colSpan={COLS} className="editor">
                    <EditorCentroFora uid={user.uid} centro={c} ano={ano} onFechar={() => setEditando(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={c.docId}>
                  <td>
                    <CentroTag tipo={c.tipo} codigo={c.codigo} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{c.descricao || "—"}</td>
                  <td className="esconde-mob">{c.responsavel || "—"}</td>
                  <td>
                    {c.tipo === "CC" ? (
                      <span className="pill" style={{ background: "#eceeee", color: "var(--color-gray)" }}>
                        Todos os anos
                      </span>
                    ) : (
                      <span className="pill" style={{ background: "#f1e8fb", color: "#6a3c99" }}>
                        Só {c.anoFora}
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="link-botao" onClick={() => setEditando(c.docId)}>
                      Editar
                    </button>
                  </td>
                </tr>
              )
            )}
            {doAnoAnterior.length > 0 && !trazendo && (
              <tr>
                <td colSpan={COLS} style={{ fontSize: 13, color: "var(--color-gray)" }}>
                  {doAnoAnterior.length} {doAnoAnterior.length === 1 ? "ODI fora do orçamento" : "ODIs fora do orçamento"} em {ano - 1} ·{" "}
                  <button type="button" className="link-botao" onClick={() => setTrazendo(true)}>
                    Trazer de {ano - 1}
                  </button>{" "}
                  (você escolhe quais)
                </td>
              </tr>
            )}
            {trazendo && (
              <tr>
                <td colSpan={COLS} className="editor">
                  <TrazerDoAnoAnterior uid={user.uid} ano={ano} lista={doAnoAnterior} onFechar={() => setTrazendo(false)} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="texto-ajuda">CC é sempre fora do orçamento. Uma ODI cadastrada aqui que depois entrar no orçamento passa a ter controle sozinha. Os CCs e ODIs que estavam dentro dos contratos vieram para cá automaticamente.</div>
    </>
  );
}

function TrazerDoAnoAnterior({ uid, ano, lista, onFechar }) {
  const [marcados, setMarcados] = useState(() => new Set(lista.map((o) => o.docId)));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  async function trazer() {
    setSalvando(true);
    try {
      for (const o of lista.filter((x) => marcados.has(x.docId))) {
        await salvarCentroFora(uid, null, { tipo: "ODI", codigo: o.codigo, descricao: o.descricao, responsavel: o.responsavel, ano });
      }
      onFechar();
    } catch (e) {
      console.error(e);
      setErro("Não deu pra trazer. Tente de novo.");
      setSalvando(false);
    }
  }
  return (
    <div role="group" aria-label={`Trazer ODIs de ${ano - 1}`}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
        Quais ODIs de {ano - 1} continuam em {ano}?
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {lista.map((o) => (
          <label key={o.docId} style={{ display: "flex", gap: 8, alignItems: "center", margin: 0, fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={marcados.has(o.docId)}
              onChange={(e) => {
                const n = new Set(marcados);
                if (e.target.checked) n.add(o.docId);
                else n.delete(o.docId);
                setMarcados(n);
              }}
              style={{ width: "auto", minHeight: 0 }}
            />
            <CentroTag tipo="ODI" codigo={o.codigo} />
            <span style={{ fontSize: 13, color: "var(--color-gray)" }}>{o.descricao}</span>
          </label>
        ))}
      </div>
      {erro && (
        <div className="texto-alerta" role="alert" style={{ fontSize: 13, marginTop: 8 }}>
          {erro}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onFechar}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={trazer} disabled={salvando || marcados.size === 0}>
          {salvando ? "Trazendo..." : `Trazer ${marcados.size} para ${ano}`}
        </button>
      </div>
    </div>
  );
}

function EditorCentroFora({ uid, centro, ano, onFechar }) {
  const [tipo, setTipo] = useState(centro?.tipo || "CC");
  const [codigo, setCodigo] = useState(centro?.codigo || "");
  const [descricao, setDescricao] = useState(centro?.descricao || "");
  const [responsavel, setResponsavel] = useState(centro?.responsavel || "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  async function salvar(e) {
    e.preventDefault();
    if (!codigo.trim()) return setErro("Escreva o código.");
    setSalvando(true);
    try {
      // ODI fica no ano dela (a que já existe) ou no ano escolhido em cima (a nova).
      await salvarCentroFora(uid, centro?.docId, { tipo, codigo, descricao, responsavel, ano: centro?.anoFora || ano });
      onFechar();
    } catch (err) {
      console.error(err);
      setErro("Não deu pra salvar. Tente de novo.");
      setSalvando(false);
    }
  }
  async function excluir() {
    if (!window.confirm(`Excluir ${centro.tipo} ${centro.codigo} da lista? Alocações e medições que já usam esse código não mudam.`)) return;
    await excluirCentroFora(uid, centro.docId);
    onFechar();
  }
  return (
    <form onSubmit={salvar} aria-label={centro ? `Editar ${centro.tipo} ${centro.codigo}` : "Novo CC ou ODI"}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <span style={rotulo}>Tipo</span>
          <div className="chips-row" role="group" aria-label="Tipo" style={{ minHeight: 40, alignItems: "center" }}>
            {[
              ["CC", "Centro de custo"],
              ["ODI", "ODI"],
            ].map(([k, l]) => (
              <button key={k} type="button" className="chip" aria-pressed={tipo === k} onClick={() => setTipo(k)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <label style={{ flex: "0 1 150px", margin: 0 }}>
          <span style={rotulo}>Código</span>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex: 4100-221" maxLength={60} autoFocus />
        </label>
        <label style={{ flex: "1 1 220px", margin: 0 }}>
          <span style={rotulo}>Descrição</span>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Infraestrutura · Datacenter" maxLength={200} />
        </label>
        <label style={{ flex: "1 1 180px", margin: 0 }}>
          <span style={rotulo}>Responsável (opcional)</span>
          <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Quem responde por ele" maxLength={120} />
        </label>
      </div>
      <div className="texto-ajuda">{tipo === "CC" ? "CC é sempre fora do orçamento e vale para todos os anos." : `Esta ODI vale só para ${centro?.anoFora || ano}. Se ela depois entrar no orçamento, passa a ter controle sozinha.`}</div>
      {erro && (
        <div className="texto-alerta" role="alert" style={{ fontSize: 13, marginTop: 8 }}>
          {erro}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 12 }}>
        <span>
          {centro && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--color-orange)", borderColor: "var(--color-orange-border)" }} onClick={excluir}>
              Excluir
            </button>
          )}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onFechar}>
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
