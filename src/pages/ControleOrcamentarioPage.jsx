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
  const ano = anoEscolhido ?? (anos.includes(anoAtual) ? anoAtual : anos[0]);

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
        {aba !== "odis" && anos.length > 0 && (
          <label style={{ width: 280, maxWidth: "100%", margin: 0 }}>
            <span style={rotulo}>Ano</span>
            <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a} · Orçamento {porAno[a].versao.versao} (efetivada)
                </option>
              ))}
            </select>
          </label>
        )}
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
        <AbaOdis />
      ) : carregando && !anos.length ? (
        <div className="spinner-wrap">Carregando...</div>
      ) : !anos.length ? (
        <div className="empty-state" style={{ marginTop: 20 }}>
          Ainda não há orçamento efetivado. Marque uma versão como <b>Efetivada</b> em <Link to="/orcamentos">Orçamentos</Link> para começar o controle.
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

function AbaOdis() {
  const { user } = useAuth();
  const { opcoes, carregando } = useCentrosDisponiveis();
  const [editando, setEditando] = useState(null); // docId ou "novo"
  const doOrcamento = opcoes.filter((o) => o.origem === "orcamento");
  const fora = opcoes.filter((o) => o.origem === "fora");

  return (
    <>
      <div className="texto-ajuda" style={{ marginTop: 12 }}>
        É a lista única que aparece nas alocações de todos os contratos. As do orçamento entram sozinhas; as outras você cadastra aqui (ou direto na hora de escolher).
      </div>
      <h2 style={secaoTitulo}>Do orçamento · {doOrcamento.length}</h2>
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
                  {carregando ? "Carregando…" : "Nenhuma ODI ainda: elas vêm das linhas da última versão efetivada de cada ano."}
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
      <div className="lista-card">
        <table className="tabela-med tabela-orc2 tabela-controle">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th className="esconde-mob">Responsável</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {editando === "novo" && (
              <tr>
                <td colSpan={4} className="editor">
                  <EditorCentroFora uid={user.uid} centro={null} onFechar={() => setEditando(null)} />
                </td>
              </tr>
            )}
            {fora.length === 0 && editando !== "novo" && (
              <tr>
                <td colSpan={4} style={{ color: "var(--color-gray)" }}>
                  Nenhum CC ou ODI fora do orçamento.
                </td>
              </tr>
            )}
            {fora.map((c) =>
              editando === c.docId ? (
                <tr key={c.id}>
                  <td colSpan={4} className="editor">
                    <EditorCentroFora uid={user.uid} centro={c} onFechar={() => setEditando(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={c.id}>
                  <td>
                    <CentroTag tipo={c.tipo} codigo={c.codigo} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{c.descricao || "—"}</td>
                  <td className="esconde-mob">{c.responsavel || "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="link-botao" onClick={() => setEditando(c.docId)}>
                      Editar
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      <div className="texto-ajuda">CC é sempre fora do orçamento. Uma ODI cadastrada aqui que depois entrar no orçamento passa a ter controle sozinha. Os CCs e ODIs que estavam dentro dos contratos vêm para cá automaticamente.</div>
    </>
  );
}

function EditorCentroFora({ uid, centro, onFechar }) {
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
      await salvarCentroFora(uid, centro?.docId, { tipo, codigo, descricao, responsavel });
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
