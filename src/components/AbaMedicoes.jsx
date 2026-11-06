import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IconeCheck } from "./Icones";
import { marcarMedicaoFeita } from "../lib/contratos";
import { chaveDoMes, nomeDoMes, proximaMedicao } from "../lib/medicao";
import { formatarDataRelativa, inicioDoDia } from "../lib/datas";
import {
  alocacaoNoMes,
  definirAlocacao,
  formatarHoras,
  formatarNumero,
  formatarReais,
  historicoDeAlocacoes,
  lerNumero,
  mesDe,
  normalizarNome,
  proximaAlocacao,
  rotuloMes,
  rotuloMesCurto,
  somaPct,
  somarMeses,
  usoDosCentros,
} from "../lib/alocacoes";
import {
  excluirCentro,
  excluirRecurso,
  salvarCentro,
  salvarRecurso,
  watchCentros,
  watchMedicoes,
  watchRecursos,
} from "../lib/medicoesContrato";

export function CentroTag({ tipo, codigo }) {
  return (
    <span className="centro-tag">
      <span className={`tp ${tipo === "ODI" ? "odi" : ""}`}>{tipo || "?"}</span>
      {codigo || "—"}
    </span>
  );
}

function Partes({ partes, centrosPorId }) {
  if (!partes?.length) return <span style={{ color: "var(--color-gray)" }}>—</span>;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "4px 10px", alignItems: "center" }}>
      {partes.map((p, i) => {
        const c = centrosPorId[p.centroId];
        return (
          <span key={i} style={{ whiteSpace: "nowrap" }}>
            <CentroTag tipo={c?.tipo} codigo={c?.codigo || "(excluído)"} /> <span style={{ color: "var(--color-gray)", fontSize: 12 }}>{p.pct}%</span>
          </span>
        );
      })}
    </span>
  );
}

function Secao({ titulo, acao }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        margin: "28px 0 8px",
        fontSize: 12,
        fontWeight: 700,
        color: "var(--color-gray)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        gap: 12,
      }}
    >
      <h2 style={{ margin: 0, font: "inherit" }}>{titulo}</h2>
      {acao && <span style={{ textTransform: "none", letterSpacing: 0 }}>{acao}</span>}
    </div>
  );
}

const rotulo = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--color-gray)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" };

// Meses para escolher em "vale a partir de": um ano para trás e seis meses à frente.
function opcoesDeMes(centro) {
  const lista = [];
  for (let i = -12; i <= 6; i++) lista.push(somarMeses(centro, i));
  return lista.reverse();
}

export default function AbaMedicoes({ contrato, podeEditar }) {
  const contratoId = contrato.id;
  const [centros, setCentros] = useState([]);
  const [recursos, setRecursos] = useState([]);
  const [medicoes, setMedicoes] = useState([]);
  const [erro, setErro] = useState("");
  const mesAtual = mesDe(new Date());
  const [mesVer, setMesVer] = useState(mesAtual);
  const [editandoRecurso, setEditandoRecurso] = useState(null); // id, "novo" ou null
  const [editandoCentro, setEditandoCentro] = useState(null);

  useEffect(() => watchCentros(contratoId, setCentros, (e) => setErro(e.message)), [contratoId]);
  useEffect(() => watchRecursos(contratoId, setRecursos, (e) => setErro(e.message)), [contratoId]);
  useEffect(() => watchMedicoes(contratoId, setMedicoes, (e) => setErro(e.message)), [contratoId]);

  const centrosPorId = useMemo(() => Object.fromEntries(centros.map((c) => [c.id, c])), [centros]);
  const mesUso = medicoes[0]?.mes || somarMeses(mesAtual, -1);
  const uso = useMemo(() => usoDosCentros(medicoes, mesUso), [medicoes, mesUso]);

  return (
    <div>
      {erro && (
        <div className="texto-alerta" style={{ marginTop: 16, fontSize: 13 }}>
          Não deu pra carregar as medições: {erro}
        </div>
      )}

      <CartaoDoMes contrato={contrato} podeEditar={podeEditar} />

      <Secao titulo={`Medições salvas · ${medicoes.length}`} />
      {medicoes.length === 0 ? (
        <div className="lista-card" style={{ padding: "16px 18px", fontSize: 14, color: "var(--color-gray)" }}>
          Nenhuma medição ainda. Cadastre os recursos e os CCs/ODIs abaixo e depois suba a planilha do fornecedor.
        </div>
      ) : (
        <div className="lista-card">
          {medicoes.map((m) => (
            <Link
              key={m.id}
              to={`/contratos/${contratoId}/medicoes/${m.mes}`}
              className="secao-lateral"
              style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", color: "inherit", flexWrap: "wrap" }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{rotuloMes(m.mes)}</div>
                <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 2 }}>
                  {(m.linhas || []).length} {(m.linhas || []).length === 1 ? "linha" : "linhas"} · {formatarHoras(m.horas)}
                  {(m.linhas || []).some((l) => !l.partes?.length) && <span className="texto-alerta"> · linha sem CC/ODI</span>}
                </div>
              </div>
              <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <b style={{ fontSize: 14 }}>{formatarReais(m.total)}</b>
                <StatusMedicao status={m.status} />
              </span>
            </Link>
          ))}
        </div>
      )}

      <Secao
        titulo={`Recursos e alocações · ${recursos.length}`}
        acao={
          podeEditar && (
            <button type="button" className="link-botao" onClick={() => setEditandoRecurso("novo")}>
              + Novo recurso
            </button>
          )
        }
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, fontSize: 13, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-ghost btn-sm" aria-label="Mês anterior" onClick={() => setMesVer(somarMeses(mesVer, -1))}>
          ‹
        </button>
        <b style={{ minWidth: 130, textAlign: "center" }} aria-live="polite">
          {rotuloMes(mesVer)}
        </b>
        <button type="button" className="btn btn-ghost btn-sm" aria-label="Próximo mês" onClick={() => setMesVer(somarMeses(mesVer, 1))}>
          ›
        </button>
        <span style={{ color: "var(--color-gray)" }}>mostrando a alocação que vale neste mês</span>
        {mesVer !== mesAtual && (
          <button type="button" className="link-botao" onClick={() => setMesVer(mesAtual)}>
            voltar para o mês atual
          </button>
        )}
      </div>
      <div className="lista-card tabela-rolagem">
        <table className="tabela-med">
          <thead>
            <tr>
              <th>Recurso</th>
              <th className="num">Valor HH</th>
              <th>CC / ODI</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {recursos.length === 0 && editandoRecurso !== "novo" && (
              <tr>
                <td colSpan={4} style={{ color: "var(--color-gray)", fontSize: 14 }}>
                  Nenhum recurso cadastrado. {podeEditar && "Use “+ Novo recurso” ou suba uma medição e salve as alocações a partir dela."}
                </td>
              </tr>
            )}
            {recursos.map((r) =>
              editandoRecurso === r.id ? (
                <tr key={r.id}>
                  <td colSpan={4} className="editor">
                    <EditorRecurso contratoId={contratoId} recurso={r} recursos={recursos} centros={centros} mesInicial={mesVer} onFechar={() => setEditandoRecurso(null)} />
                  </td>
                </tr>
              ) : (
                <LinhaRecurso key={r.id} recurso={r} mes={mesVer} centrosPorId={centrosPorId} podeEditar={podeEditar} onEditar={() => setEditandoRecurso(r.id)} />
              )
            )}
            {editandoRecurso === "novo" && (
              <tr>
                <td colSpan={4} className="editor">
                  <EditorRecurso contratoId={contratoId} recurso={null} recursos={recursos} centros={centros} mesInicial={mesVer} onFechar={() => setEditandoRecurso(null)} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="texto-ajuda">
        Na medição, cada linha é ligada ao recurso pelo nome, usando a alocação do mês da medição. Dá para mudar até subir a medição.
      </div>

      <Secao
        titulo={`CCs e ODIs · ${centros.length}`}
        acao={
          podeEditar && (
            <button type="button" className="link-botao" onClick={() => setEditandoCentro("novo")}>
              + Novo CC ou ODI
            </button>
          )
        }
      />
      <div className="lista-card tabela-rolagem">
        <table className="tabela-med">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th>Responsável</th>
              <th className="num">Orçamento mensal</th>
              <th>Usado em {rotuloMesCurto(mesUso)}</th>
              <th>Usado no ano</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {centros.length === 0 && editandoCentro !== "novo" && (
              <tr>
                <td colSpan={7} style={{ color: "var(--color-gray)", fontSize: 14 }}>
                  Nenhum CC ou ODI cadastrado.
                </td>
              </tr>
            )}
            {centros.map((c) =>
              editandoCentro === c.id ? (
                <tr key={c.id}>
                  <td colSpan={7} className="editor">
                    <EditorCentro contratoId={contratoId} centro={c} recursos={recursos} onFechar={() => setEditandoCentro(null)} />
                  </td>
                </tr>
              ) : (
                <LinhaCentro key={c.id} centro={c} uso={uso[c.id]} podeEditar={podeEditar} onEditar={() => setEditandoCentro(c.id)} />
              )
            )}
            {editandoCentro === "novo" && (
              <tr>
                <td colSpan={7} className="editor">
                  <EditorCentro contratoId={contratoId} centro={null} recursos={recursos} onFechar={() => setEditandoCentro(null)} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="texto-ajuda">“Usado” soma as medições deste contrato. Tudo nesta aba é visto por quem participa do contrato.</div>
    </div>
  );
}

export function StatusMedicao({ status }) {
  return status === "lancada" ? (
    <span className="pill" style={{ background: "#e0f5ef", color: "var(--color-primary-dark)", flex: "0 0 auto" }}>
      Lançada no sistema
    </span>
  ) : (
    <span className="pill" style={{ background: "var(--color-orange-soft)", color: "var(--color-orange)", flex: "0 0 auto" }}>
      A lançar no sistema
    </span>
  );
}

// Medição do mês (se o contrato tem o lembrete de medição) ou só o botão de subir.
function CartaoDoMes({ contrato, podeEditar }) {
  const m = contrato.medicao;
  const [salvando, setSalvando] = useState(false);
  const linkNova = `/contratos/${contrato.id}/medicoes/nova`;
  if (!m?.ativa) {
    if (!podeEditar) return null;
    return (
      <div className="lista-card" style={{ marginTop: 16, padding: "14px 18px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px", fontSize: 14 }}>Suba a planilha do fornecedor para preencher os CCs e ODIs de cada linha.</div>
        <Link to={linkNova} className="btn btn-primary">
          Subir medição
        </Link>
      </div>
    );
  }
  const hoje = inicioDoDia();
  const proxima = proximaMedicao(contrato);
  const mesAtual = chaveDoMes(hoje.getFullYear(), hoje.getMonth());
  const feitaEsteMes = Boolean(m.feitas?.[mesAtual]);
  const atrasada = proxima && proxima.prazo < hoje;

  async function marcar(chave, feita) {
    setSalvando(true);
    try {
      await marcarMedicaoFeita(contrato.id, chave, feita);
    } catch (e) {
      console.error("Erro ao marcar medição:", e);
      window.alert("Não deu pra atualizar a medição. Tente de novo.");
    }
    setSalvando(false);
  }

  return (
    <div className="lista-card" style={{ marginTop: 16, padding: "14px 18px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", borderColor: atrasada ? "var(--color-orange-border)" : "#00d4c0" }}>
      <div style={{ flex: "1 1 300px" }}>
        <div className={atrasada ? "texto-alerta" : ""} style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: atrasada ? undefined : "var(--color-primary-dark)" }}>
          Medição de {feitaEsteMes ? nomeDoMes(hoje.getMonth()) : proxima?.nomeMes}
        </div>
        {feitaEsteMes ? (
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>
            <IconeCheck size={14} /> Feita
            {podeEditar && (
              <button type="button" className="link-botao" style={{ marginLeft: 10 }} disabled={salvando} onClick={() => marcar(mesAtual, false)}>
                Desfazer
              </button>
            )}
          </div>
        ) : (
          proxima && (
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>
              {atrasada ? "Atrasada · era " : "Prazo até "}
              {formatarDataRelativa(proxima.prazo).toLowerCase()}
              {[m.quem, m.responsavelNome].filter(Boolean).length > 0 && ` · ${[m.quem, m.responsavelNome].filter(Boolean).join(" · ")}`}
            </div>
          )
        )}
        <div className="texto-ajuda" style={{ marginTop: 2 }}>
          Ao salvar a medição, o mês já fica marcado como feito.
        </div>
      </div>
      {podeEditar && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!feitaEsteMes && proxima && (
            <button type="button" className="btn btn-ghost" disabled={salvando} onClick={() => marcar(proxima.chave, true)}>
              Marcar como feita sem planilha
            </button>
          )}
          <Link to={linkNova} className={feitaEsteMes ? "btn btn-ghost" : "btn btn-primary"}>
            Subir medição{!feitaEsteMes && proxima ? ` de ${proxima.nomeMes}` : ""}
          </Link>
        </div>
      )}
    </div>
  );
}

function LinhaRecurso({ recurso, mes, centrosPorId, podeEditar, onEditar }) {
  const atual = alocacaoNoMes(recurso, mes);
  const proxima = proximaAlocacao(recurso, mes);
  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600 }}>{recurso.nome}</div>
        {recurso.perfil && <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 2 }}>{recurso.perfil}</div>}
      </td>
      <td className="num">{recurso.valorHH != null ? formatarReais(recurso.valorHH) : "—"}</td>
      <td>
        {atual ? <Partes partes={atual.partes} centrosPorId={centrosPorId} /> : <span className="texto-alerta" style={{ fontSize: 12 }}>Sem alocação em {rotuloMesCurto(mes)}</span>}
        {proxima && (
          <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 4 }}>
            A partir de {rotuloMesCurto(proxima.desde)}: <Partes partes={proxima.partes} centrosPorId={centrosPorId} />
          </div>
        )}
      </td>
      <td style={{ textAlign: "right" }}>
        {podeEditar && (
          <button type="button" className="link-botao" onClick={onEditar}>
            Editar
          </button>
        )}
      </td>
    </tr>
  );
}

function EditorRecurso({ contratoId, recurso, recursos, centros, mesInicial, onFechar }) {
  const [nome, setNome] = useState(recurso?.nome || "");
  const [perfil, setPerfil] = useState(recurso?.perfil || "");
  const [valorHH, setValorHH] = useState(recurso?.valorHH != null ? formatarNumero(recurso.valorHH) : "");
  const [desde, setDesde] = useState(mesInicial);
  const [partes, setPartes] = useState(() => {
    const a = recurso ? alocacaoNoMes(recurso, mesInicial) : null;
    return a ? a.partes.map((p) => ({ ...p })) : [{ centroId: "", pct: 100 }];
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const historico = recurso ? historicoDeAlocacoes(recurso) : [];
  const centrosPorId = Object.fromEntries(centros.map((c) => [c.id, c]));
  const soma = somaPct(partes.filter((p) => p.centroId));
  const primeiroNome = (nome || "").trim().split(" ")[0];

  function mudarParte(i, mudanca) {
    setPartes(partes.map((p, j) => (j === i ? { ...p, ...mudanca } : p)));
  }

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) return setErro("Escreva o nome do recurso.");
    const repetido = recursos.find((r) => r.id !== recurso?.id && normalizarNome(r.nome) === normalizarNome(nome));
    if (repetido) return setErro(`Já existe um recurso chamado “${repetido.nome}” neste contrato.`);
    const validas = partes.filter((p) => p.centroId).map((p) => ({ centroId: p.centroId, pct: Number(String(p.pct).replace(",", ".")) || 0 }));
    if (validas.length && Math.abs(somaPct(validas) - 100) > 0.001) return setErro("A soma dos percentuais precisa dar 100%.");
    const ids = validas.map((p) => p.centroId);
    if (new Set(ids).size !== ids.length) return setErro("O mesmo CC/ODI aparece duas vezes.");
    const alocacoes = validas.length ? definirAlocacao(recurso, desde, validas) : recurso?.alocacoes || [];
    setSalvando(true);
    try {
      await salvarRecurso(contratoId, recurso?.id, { nome, perfil, valorHH: lerNumero(valorHH), alocacoes });
      onFechar();
    } catch (err) {
      console.error(err);
      setErro("Não deu pra salvar. Tente de novo.");
      setSalvando(false);
    }
  }

  async function removerPeriodo(desdeRemover) {
    if (!window.confirm(`Remover a alocação que começa em ${rotuloMes(desdeRemover)}?`)) return;
    await salvarRecurso(contratoId, recurso.id, { ...recurso, alocacoes: recurso.alocacoes.filter((a) => a.desde !== desdeRemover) });
  }

  async function excluir() {
    if (!window.confirm(`Excluir o recurso “${recurso.nome}”? As medições já salvas não mudam.`)) return;
    await excluirRecurso(contratoId, recurso.id);
    onFechar();
  }

  return (
    <form onSubmit={salvar} aria-label={recurso ? `Editar recurso ${recurso.nome}` : "Novo recurso"}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ flex: "1 1 200px", margin: 0 }}>
          <span style={rotulo}>Recurso</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Carla Mendes" maxLength={200} autoFocus />
        </label>
        <label style={{ flex: "1 1 220px", margin: 0 }}>
          <span style={rotulo}>Perfil (opcional)</span>
          <input value={perfil} onChange={(e) => setPerfil(e.target.value)} placeholder="Ex: QA - Analista de Testes PL" maxLength={200} />
        </label>
        <label style={{ flex: "0 1 150px", margin: 0 }}>
          <span style={rotulo}>Valor HH (opcional)</span>
          <input value={valorHH} onChange={(e) => setValorHH(e.target.value)} placeholder="R$ 0,00" inputMode="decimal" />
        </label>
      </div>
      <div className="texto-ajuda">Nome como vem na planilha do fornecedor. Com o valor HH preenchido, a medição avisa quando o fornecedor cobrar diferente.</div>

      {centros.length === 0 ? (
        <div className="texto-ajuda texto-alerta" style={{ marginTop: 14 }}>
          Cadastre um CC ou ODI (mais abaixo) para poder alocar o recurso.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginTop: 14 }}>
            <label style={{ flex: "0 1 200px", margin: 0 }}>
              <span style={rotulo}>Alocação vale a partir de</span>
              <select value={desde} onChange={(e) => setDesde(e.target.value)}>
                {opcoesDeMes(mesInicial).map((m) => (
                  <option key={m} value={m}>
                    {rotuloMes(m)}
                  </option>
                ))}
              </select>
            </label>
            <div className="texto-ajuda" style={{ flex: "1 1 200px", margin: "0 0 10px" }}>
              Os meses anteriores continuam com a alocação antiga.
            </div>
          </div>
          <span style={{ ...rotulo, marginTop: 14 }}>Para onde vai</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {partes.map((p, i) => (
              <div key={i} className="linha-partes">
                <select value={p.centroId} onChange={(e) => mudarParte(i, { centroId: e.target.value })} aria-label={`CC ou ODI ${i + 1}`}>
                  <option value="">Escolher CC/ODI…</option>
                  {centros.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.tipo} {c.codigo}
                      {c.descricao ? ` · ${c.descricao}` : ""}
                    </option>
                  ))}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
                  <input value={p.pct} onChange={(e) => mudarParte(i, { pct: e.target.value })} inputMode="decimal" aria-label={`Percentual ${i + 1}`} style={{ width: 64 }} />%
                </label>
                <button type="button" className="btn btn-ghost" style={{ padding: 0, width: 40 }} aria-label={`Remover CC/ODI ${i + 1}`} onClick={() => setPartes(partes.filter((_, j) => j !== i))} disabled={partes.length === 1}>
                  ×
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              onClick={() => setPartes([...partes, { centroId: "", pct: Math.max(0, Math.round((100 - soma) * 100) / 100) }])}
              style={{ background: "none", border: "1px dashed var(--color-gray-light)", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, color: "var(--color-primary)", minHeight: 36 }}
            >
              + Dividir com outro CC/ODI
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, color: Math.abs(soma - 100) < 0.001 ? "var(--color-primary-dark)" : "var(--color-orange)" }}>
              Soma: {formatarNumero(soma, 0)}%{Math.abs(soma - 100) < 0.001 ? " ✓" : ""}
            </span>
          </div>
        </>
      )}

      {historico.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed #cdd9d7" }}>
          <span style={rotulo}>Histórico{primeiroNome ? ` de ${primeiroNome}` : ""}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
            {historico.map((h) => {
              const vigente = h.desde <= mesDe(new Date()) && (!h.ate || h.ate >= mesDe(new Date()));
              return (
                <div key={h.desde} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", color: vigente ? undefined : "var(--color-gray)" }}>
                  <span style={{ minWidth: 170, fontWeight: vigente ? 700 : 400 }}>
                    {h.ate ? `${rotuloMesCurto(h.desde)} a ${rotuloMesCurto(h.ate)}` : `Desde ${rotuloMesCurto(h.desde)}`}
                    {vigente ? " (atual)" : h.desde > mesDe(new Date()) ? " (agendada)" : ""}
                  </span>
                  <Partes partes={h.partes} centrosPorId={centrosPorId} />
                  {historico.length > 1 && (
                    <button type="button" className="link-botao" style={{ fontSize: 12, color: "var(--color-orange)" }} onClick={() => removerPeriodo(h.desde)}>
                      remover
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {erro && (
        <div className="texto-alerta" role="alert" style={{ fontSize: 13, marginTop: 10 }}>
          {erro}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 14, flexWrap: "wrap" }}>
        <span>
          {recurso && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--color-orange)", borderColor: "var(--color-orange-border)" }} onClick={excluir}>
              Excluir recurso
            </button>
          )}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
            {salvando ? "Salvando..." : recurso ? "Salvar recurso" : "Adicionar recurso"}
          </button>
        </span>
      </div>
    </form>
  );
}

function Uso({ valor, orcamento, rotuloOrcamento }) {
  const pct = orcamento ? Math.round((valor / orcamento) * 100) : null;
  const acima = pct !== null && pct > 100;
  return (
    <>
      <div style={{ fontWeight: 600 }}>{formatarReais(valor || 0)}</div>
      {pct !== null ? (
        <>
          <div className={`barra-uso ${acima ? "acima" : ""}`}>
            <span style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <div className={acima ? "texto-alerta" : ""} style={{ fontSize: 12, color: acima ? undefined : "var(--color-gray)" }}>
            {pct}% do {rotuloOrcamento}
            {acima ? " · acima do orçamento" : ""}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: "var(--color-gray)" }}>sem orçamento {rotuloOrcamento}</div>
      )}
    </>
  );
}

function LinhaCentro({ centro, uso, podeEditar, onEditar }) {
  return (
    <tr>
      <td>
        <CentroTag tipo={centro.tipo} codigo={centro.codigo} />
      </td>
      <td style={{ fontWeight: 600 }}>{centro.descricao || "—"}</td>
      <td>{centro.responsavel || "—"}</td>
      <td className="num">
        {centro.orcamentoMensal != null ? formatarReais(centro.orcamentoMensal) : "—"}
        {centro.orcamentoAnual != null && <div style={{ fontSize: 12, color: "var(--color-gray)" }}>{formatarReais(centro.orcamentoAnual)} no ano</div>}
      </td>
      <td style={{ minWidth: 150 }}>
        <Uso valor={uso?.mes || 0} orcamento={centro.orcamentoMensal} rotuloOrcamento="mensal" />
      </td>
      <td style={{ minWidth: 140 }}>
        <Uso valor={uso?.ano || 0} orcamento={centro.orcamentoAnual} rotuloOrcamento="anual" />
      </td>
      <td style={{ textAlign: "right" }}>
        {podeEditar && (
          <button type="button" className="link-botao" onClick={onEditar}>
            Editar
          </button>
        )}
      </td>
    </tr>
  );
}

function EditorCentro({ contratoId, centro, recursos, onFechar }) {
  const [tipo, setTipo] = useState(centro?.tipo || "CC");
  const [codigo, setCodigo] = useState(centro?.codigo || "");
  const [descricao, setDescricao] = useState(centro?.descricao || "");
  const [responsavel, setResponsavel] = useState(centro?.responsavel || "");
  const [mensal, setMensal] = useState(centro?.orcamentoMensal != null ? formatarNumero(centro.orcamentoMensal) : "");
  const [anual, setAnual] = useState(centro?.orcamentoAnual != null ? formatarNumero(centro.orcamentoAnual) : "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    if (!codigo.trim()) return setErro("Escreva o código.");
    setSalvando(true);
    try {
      await salvarCentro(contratoId, centro?.id, { tipo, codigo, descricao, responsavel, orcamentoMensal: lerNumero(mensal), orcamentoAnual: lerNumero(anual) });
      onFechar();
    } catch (err) {
      console.error(err);
      setErro("Não deu pra salvar. Tente de novo.");
      setSalvando(false);
    }
  }

  async function excluir() {
    const emUso = recursos.filter((r) => (r.alocacoes || []).some((a) => a.partes.some((p) => p.centroId === centro.id)));
    const aviso = emUso.length
      ? `${centro.tipo} ${centro.codigo} aparece nas alocações de ${emUso.map((r) => r.nome).join(", ")}. Excluir mesmo assim? Essas alocações vão ficar sem esse CC/ODI.`
      : `Excluir ${centro.tipo} ${centro.codigo}? As medições já salvas não mudam.`;
    if (!window.confirm(aviso)) return;
    await excluirCentro(contratoId, centro.id);
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
        <label style={{ flex: "0 1 140px", margin: 0 }}>
          <span style={rotulo}>Código</span>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex: 4100-221" maxLength={60} autoFocus />
        </label>
        <label style={{ flex: "1 1 180px", margin: 0 }}>
          <span style={rotulo}>Descrição</span>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Infraestrutura · Datacenter" maxLength={200} />
        </label>
        <label style={{ flex: "1 1 160px", margin: 0 }}>
          <span style={rotulo}>Responsável</span>
          <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Quem responde por ele" maxLength={120} />
        </label>
        <label style={{ flex: "0 1 140px", margin: 0 }}>
          <span style={rotulo}>Orç. mensal</span>
          <input value={mensal} onChange={(e) => setMensal(e.target.value)} placeholder="R$ 0,00" inputMode="decimal" />
        </label>
        <label style={{ flex: "0 1 140px", margin: 0 }}>
          <span style={rotulo}>Orç. anual</span>
          <input value={anual} onChange={(e) => setAnual(e.target.value)} placeholder="R$ 0,00" inputMode="decimal" />
        </label>
      </div>
      <div className="texto-ajuda">Os orçamentos são opcionais. O anual não precisa ser 12× o mensal.</div>
      {erro && (
        <div className="texto-alerta" role="alert" style={{ fontSize: 13, marginTop: 10 }}>
          {erro}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 12, flexWrap: "wrap" }}>
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
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </span>
      </div>
    </form>
  );
}
