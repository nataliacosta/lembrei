import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IconeCheck } from "./Icones";
import { marcarMedicaoFeita } from "../lib/contratos";
import { chaveDoMes, nomeDaMedicao, proximaMedicao } from "../lib/medicao";
import { nomesDoContrato, situacaoDoMes } from "../lib/medicoesDoMes";
import { formatarDataRelativa, inicioDoDia } from "../lib/datas";
import {
  alocacaoNoMes,
  definirAlocacao,
  formatarHoras,
  formatarNumero,
  formatarReais,
  historicoDeAlocacoes,
  foraNoMes,
  tirarDosMeses,
  lerNumero,
  mesDe,
  normalizarNome,
  proximaAlocacao,
  rotuloMes,
  rotuloMesCurto,
  somaPct,
  somarMeses,
  resolverCentro,
} from "../lib/alocacoes";
import {
  excluirEquipe,
  excluirRecurso,
  salvarEquipe,
  salvarRecurso,
  watchCentros,
  watchEquipes,
  watchMedicoes,
  watchRecursos,
} from "../lib/medicoesContrato";
import { CabecalhoPartes, EscolhaModoAlocacao, parteComCodigo, partesDaAlocacao, partesParaEditar, porIdDe, SeletoresParte } from "./EditorDivisao";
import { useCentrosDisponiveis } from "../hooks/useCentrosDisponiveis";

export function CentroTag({ tipo, codigo }) {
  return (
    <span className="centro-tag">
      <span className={`tp ${tipo === "ODI" ? "odi" : ""}`}>{tipo || "?"}</span>
      {codigo || "—"}
    </span>
  );
}

// "Equipe Infra · Datacenter" (vazio quando não tem equipe).
export function EquipeFrente({ equipe, frente }) {
  if (!equipe) return null;
  return (
    <div className="equipe-frente">
      Equipe {equipe}
      {frente ? ` · ${frente}` : ""}
    </div>
  );
}

function nomesEquipeFrente(p, equipesPorId) {
  const e = p.equipeId ? equipesPorId[p.equipeId] : null;
  const f = e && p.frenteId ? (e.frentes || []).find((x) => x.id === p.frenteId) : null;
  return { equipe: e?.nome || "", frente: f?.nome || "" };
}

function Partes({ partes, centrosPorId, equipesPorId = {}, empilhar = true }) {
  if (!partes?.length) return <span style={{ color: "var(--color-gray)" }}>—</span>;
  return (
    <span style={{ display: "inline-flex", flexDirection: empilhar ? "column" : "row", flexWrap: "wrap", gap: empilhar ? 4 : "4px 12px" }}>
      {partes.map((p, i) => {
        const c = resolverCentro(p, centrosPorId);
        return (
          <span key={i}>
            <span style={{ whiteSpace: "nowrap" }}>
              <CentroTag tipo={c?.tipo} codigo={c?.codigo || "(sem código)"} />{" "}
              <span style={{ color: "var(--color-gray)", fontSize: 12 }}>{p.horasFixas != null ? `${formatarNumero(p.horasFixas, p.horasFixas % 1 ? 2 : 0)} h` : `${formatarNumero(p.pct, p.pct % 1 ? 2 : 0)}%`}</span>
            </span>
            <EquipeFrente {...nomesEquipeFrente(p, equipesPorId)} />
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
  // Recursos tirados do contrato no mês não aparecem (a não ser o que está sendo editado).
  const recursosDoMes = recursos.filter((r) => !foraNoMes(r, mesVer) || editandoRecurso === r.id);
  const foraDoMes = recursos.filter((r) => foraNoMes(r, mesVer) && editandoRecurso !== r.id);
  const [equipes, setEquipes] = useState([]);
  const [editandoEquipe, setEditandoEquipe] = useState(null);

  useEffect(() => watchCentros(contratoId, setCentros, (e) => setErro(e.message)), [contratoId]);
  useEffect(() => watchRecursos(contratoId, setRecursos, (e) => setErro(e.message)), [contratoId]);
  useEffect(() => watchEquipes(contratoId, setEquipes, (e) => setErro(e.message)), [contratoId]);
  useEffect(() => watchMedicoes(contratoId, setMedicoes, (e) => setErro(e.message)), [contratoId]);

  // CCs/ODIs: a lista única e, para alocações antigas, os que ficavam dentro do contrato.
  const { opcoes } = useCentrosDisponiveis();
  const centrosTodos = useMemo(() => [...centros.map((c) => ({ ...c, origem: "contrato" })), ...opcoes], [centros, opcoes]);
  const centrosPorId = useMemo(() => porIdDe(centrosTodos), [centrosTodos]);

  // Alocações antigas (com o id do CC/ODI do contrato) passam a guardar o código.
  useEffect(() => {
    if (!podeEditar || !centros.length) return;
    for (const r of recursos) {
      const precisa = (r.alocacoes || []).some((a) => a.partes.some((p) => !p.codigo && centrosPorId[p.centroId]));
      if (!precisa) continue;
      const alocacoes = r.alocacoes.map((a) => ({ ...a, partes: a.partes.map((p) => (p.codigo ? p : parteComCodigo(p, centrosTodos, { pct: p.pct }) || p)) }));
      salvarRecurso(contratoId, r.id, { ...r, alocacoes }).catch((e) => console.error("Falha ao atualizar alocações antigas:", e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podeEditar, centros.length, recursos.length]);
  const equipesPorId = useMemo(() => Object.fromEntries(equipes.map((e) => [e.id, e])), [equipes]);

  return (
    <div>
      {erro && (
        <div className="texto-alerta" style={{ marginTop: 16, fontSize: 13 }}>
          Não deu pra carregar as medições: {erro}
        </div>
      )}

      <CartaoDoMes contrato={contrato} podeEditar={podeEditar} medicoes={medicoes} />

      <Secao titulo={`Medições salvas · ${medicoes.length}`} />
      {medicoes.length === 0 ? (
        <div className="lista-card" style={{ padding: "16px 18px", fontSize: 14, color: "var(--color-gray)" }}>
          Nenhuma medição ainda. Cadastre os recursos e os CCs/ODIs abaixo e depois suba a planilha do fornecedor.
        </div>
      ) : (
        <div className="lista-card">
          {[...medicoes]
            .sort((a, b) => b.mes.localeCompare(a.mes) || Number(Boolean(a.extra)) - Number(Boolean(b.extra)) || String(a.nome || "").localeCompare(String(b.nome || "")))
            .map((m) => (
            <Link
              key={m.id}
              to={`/contratos/${contratoId}/medicoes/${m.id}`}
              className="secao-lateral"
              style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", color: "inherit", flexWrap: "wrap" }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {rotuloMes(m.mes)}
                  {m.nome ? ` · ${m.nome}` : ""}
                  {m.extra && (
                    <span className="pill" style={{ background: "#f1e8fb", color: "#6a3c99", marginLeft: 8 }}>
                      extra
                    </span>
                  )}
                </div>
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
        titulo={`Recursos e alocações · ${recursosDoMes.length}`}
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
            {recursosDoMes.map((r) =>
              editandoRecurso === r.id ? (
                <tr key={r.id}>
                  <td colSpan={4} className="editor">
                    <EditorRecurso contratoId={contratoId} recurso={r} recursos={recursos} centros={centrosTodos} equipes={equipes} mesInicial={mesVer} onFechar={() => setEditandoRecurso(null)} />
                  </td>
                </tr>
              ) : (
                <LinhaRecurso key={r.id} recurso={r} mes={mesVer} centrosPorId={centrosPorId} equipesPorId={equipesPorId} podeEditar={podeEditar} onEditar={() => setEditandoRecurso(r.id)} />
              )
            )}
            {foraDoMes.length > 0 && (
              <tr>
                <td colSpan={4} style={{ fontSize: 12, color: "var(--color-gray)" }}>
                  Fora do contrato em {rotuloMesCurto(mesVer)}:{" "}
                  {foraDoMes.map((r, i) => (
                    <span key={r.id}>
                      {i > 0 && ", "}
                      {podeEditar ? (
                        <button type="button" className="link-botao" style={{ fontSize: 12 }} onClick={() => setEditandoRecurso(r.id)}>
                          {r.nome}
                        </button>
                      ) : (
                        r.nome
                      )}
                    </span>
                  ))}
                  {podeEditar && ". Para trazer de volta, abra e defina a alocação a partir deste mês."}
                </td>
              </tr>
            )}
            {editandoRecurso === "novo" && (
              <tr>
                <td colSpan={4} className="editor">
                  <EditorRecurso contratoId={contratoId} recurso={null} recursos={recursos} centros={centrosTodos} equipes={equipes} mesInicial={mesVer} onFechar={() => setEditandoRecurso(null)} />
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
        titulo={`Equipes e frentes · ${equipes.length} ${equipes.length === 1 ? "equipe" : "equipes"}`}
        acao={
          podeEditar && (
            <button type="button" className="link-botao" onClick={() => setEditandoEquipe("nova")}>
              + Nova equipe
            </button>
          )
        }
      />
      <div className="lista-card tabela-rolagem">
        <table className="tabela-med">
          <thead>
            <tr>
              <th>Equipe</th>
              <th>Responsável</th>
              <th>Frentes</th>
              <th>Recursos alocados em {rotuloMesCurto(mesVer)}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {equipes.length === 0 && editandoEquipe !== "nova" && (
              <tr>
                <td colSpan={5} style={{ color: "var(--color-gray)", fontSize: 14 }}>
                  Nenhuma equipe cadastrada. Equipe e frente são opcionais nas alocações.
                </td>
              </tr>
            )}
            {equipes.map((e) =>
              editandoEquipe === e.id ? (
                <tr key={e.id}>
                  <td colSpan={5} className="editor">
                    <EditorEquipe contratoId={contratoId} equipe={e} recursos={recursos} onFechar={() => setEditandoEquipe(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={e.id}>
                  <td style={{ fontWeight: 600 }}>{e.nome}</td>
                  <td>{e.responsavel || "—"}</td>
                  <td>
                    {(e.frentes || []).length ? (e.frentes || []).map((f) => <span key={f.id} className="chip-frente">{f.nome}</span>) : <span style={{ color: "var(--color-gray)" }}>—</span>}
                  </td>
                  <td>{alocadosNaEquipe(recursos, e.id, mesVer) || <span style={{ color: "var(--color-gray)" }}>—</span>}</td>
                  <td style={{ textAlign: "right" }}>
                    {podeEditar && (
                      <button type="button" className="link-botao" onClick={() => setEditandoEquipe(e.id)}>
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              )
            )}
            {editandoEquipe === "nova" && (
              <tr>
                <td colSpan={5} className="editor">
                  <EditorEquipe contratoId={contratoId} equipe={null} recursos={recursos} onFechar={() => setEditandoEquipe(null)} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="texto-ajuda" style={{ marginTop: 20 }}>
        Os CCs e ODIs agora ficam numa lista única, em <Link to="/controle-orcamentario/odis">Controle orçamentário › ODIs e CCs</Link>: os do orçamento entram sozinhos e os outros você cadastra lá (ou direto na hora de escolher).
      </div>
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
function CartaoDoMes({ contrato, podeEditar, medicoes = [] }) {
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
  // Medições do mês de referência (as horas do mês anterior ao prazo).
  const mesRef = feitaEsteMes ? chaveDoMes(hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear(), (hoje.getMonth() + 11) % 12) : proxima?.mesReferencia;
  const nomes = nomesDoContrato(contrato);
  const sit = situacaoDoMes(nomes, medicoes.filter((x) => x.mes === mesRef));
  const varias = sit.total > 1 || sit.extras.length > 0;
  const unica = !varias ? sit.previstas[0].medicao : null;

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
          Medição de {feitaEsteMes ? nomeDaMedicao(hoje.getMonth()) : proxima?.nomeMes}
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
              {!varias && proxima.subida && "Subida · falta marcar como lançada no sistema · "}
              {atrasada ? "Atrasada · era " : "Prazo até "}
              {formatarDataRelativa(proxima.prazo).toLowerCase()}
              {[m.quem, m.responsavelNome].filter(Boolean).length > 0 && ` · ${[m.quem, m.responsavelNome].filter(Boolean).join(" · ")}`}
            </div>
          )
        )}
        {varias && (
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
            {sit.subidas} de {sit.total} {sit.total === 1 ? "subida" : "subidas"}
            {sit.extras.length > 0 && ` + ${sit.extras.length} ${sit.extras.length === 1 ? "extra" : "extras"}`} · {sit.lancadas} {sit.lancadas === 1 ? "lançada" : "lançadas"}
          </div>
        )}
        <div className="texto-ajuda" style={{ marginTop: 2 }}>
          {varias
            ? "O lembrete só sai do “O que fazer” quando todas as medições do mês estiverem lançadas no sistema."
            : "O lembrete sai do “O que fazer” quando você marcar a medição como lançada no sistema."}
        </div>
      </div>
      {podeEditar && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!feitaEsteMes && proxima && !proxima.subida && sit.subidas === 0 && sit.extras.length === 0 && (
            <button type="button" className="btn btn-ghost" disabled={salvando} onClick={() => marcar(proxima.chave, true)}>
              Marcar como feita sem planilha
            </button>
          )}
          {!feitaEsteMes && !varias && proxima?.subida ? (
            <Link to={`/contratos/${contrato.id}/medicoes/${unica?.id || proxima.mesReferencia}`} className="btn btn-primary">
              Abrir medição de {proxima.nomeMes}
            </Link>
          ) : varias && sit.todasSubidas && !feitaEsteMes ? null : (
            <Link to={linkNova} className={feitaEsteMes ? "btn btn-ghost" : "btn btn-primary"}>
              Subir medição{!feitaEsteMes && proxima ? ` de ${proxima.nomeMes}` : ""}
            </Link>
          )}
        </div>
      )}
      {varias && (
        <div style={{ flex: "1 1 100%" }}>
          {[...sit.previstas.map((p) => ({ nome: p.nome, medicao: p.medicao })), ...sit.extras.map((x) => ({ nome: x.nome, medicao: x, extra: true }))].map((p) => (
            <div key={p.medicao?.id || p.nome} className="linha-medicao-mes">
              <span>
                <b>{p.nome || "Medição do mês"}</b>
                {p.extra && (
                  <span className="pill" style={{ background: "#f1e8fb", color: "#6a3c99", marginLeft: 8 }}>
                    extra
                  </span>
                )}
                {p.medicao && (
                  <span style={{ fontSize: 12, color: "var(--color-gray)" }}>
                    {" "}
                    · {(p.medicao.linhas || []).length} {(p.medicao.linhas || []).length === 1 ? "linha" : "linhas"} · {formatarReais(p.medicao.total)}
                  </span>
                )}
              </span>
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {p.medicao ? (
                  <>
                    <StatusMedicao status={p.medicao.status} />
                    <Link to={`/contratos/${contrato.id}/medicoes/${p.medicao.id}`} style={{ fontSize: 13, fontWeight: 600 }}>
                      Abrir
                    </Link>
                  </>
                ) : (
                  <span className="pill" style={{ background: "#eceeee", color: "var(--color-gray)" }}>
                    Ainda não subida
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LinhaRecurso({ recurso, mes, centrosPorId, equipesPorId, podeEditar, onEditar }) {
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
        {atual ? <Partes partes={atual.partes} centrosPorId={centrosPorId} equipesPorId={equipesPorId} /> : <span className="texto-alerta" style={{ fontSize: 12 }}>Sem alocação em {rotuloMesCurto(mes)}</span>}
        {proxima && (
          <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 4 }}>
            A partir de {rotuloMesCurto(proxima.desde)}: {proxima.fora ? <span style={{ color: "var(--color-orange)" }}>fora do contrato</span> : <Partes partes={proxima.partes} centrosPorId={centrosPorId} equipesPorId={equipesPorId} empilhar={false} />}
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

function EditorRecurso({ contratoId, recurso, recursos, centros, equipes, mesInicial, onFechar }) {
  const [nome, setNome] = useState(recurso?.nome || "");
  const [perfil, setPerfil] = useState(recurso?.perfil || "");
  const [valorHH, setValorHH] = useState(recurso?.valorHH != null ? formatarNumero(recurso.valorHH) : "");
  const [desde, setDesde] = useState(mesInicial);
  const alocAtual = recurso ? alocacaoNoMes(recurso, mesInicial) : null;
  const [modo, setModo] = useState(alocAtual?.modo === "horas" ? "horas" : "pct");
  const [partes, setPartes] = useState(() => partesParaEditar(alocAtual?.fora ? null : alocAtual));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const historico = recurso ? historicoDeAlocacoes(recurso) : [];
  const centrosPorId = porIdDe(centros);
  const equipesPorId = Object.fromEntries(equipes.map((e) => [e.id, e]));
  const soma = modo === "horas" ? Math.round(partes.filter((p) => p.centroId).reduce((s2, p) => s2 + (lerNumero(p.horas) || 0), 0) * 100) / 100 : somaPct(partes.filter((p) => p.centroId));
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
    const comCentro = partes.filter((p) => p.centroId || p.codigo);
    if (modo === "horas" && comCentro.some((p) => !(lerNumero(p.horas) > 0))) return setErro("Cada CC/ODI precisa de horas maiores que zero.");
    const validas = partesDaAlocacao(comCentro, modo, centros).filter(Boolean);
    if (modo !== "horas" && validas.length && Math.abs(somaPct(validas) - 100) > 0.001) return setErro("A soma dos percentuais precisa dar 100%.");
    const ids = validas.map((p) => `${p.centroId}|${p.equipeId || ""}|${p.frenteId || ""}`);
    if (new Set(ids).size !== ids.length) return setErro("A mesma combinação de CC/ODI, equipe e frente aparece duas vezes.");
    const alocacoes = validas.length ? definirAlocacao(recurso, desde, validas, modo) : recurso?.alocacoes || [];
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

  // Tirar dos meses (a partir do mês que está sendo visto) ou apagar o recurso.
  const [excluindo, setExcluindo] = useState(false);
  const [modoExcluir, setModoExcluir] = useState("daqui");
  async function excluir() {
    setErro("");
    try {
      if (modoExcluir === "todos") await excluirRecurso(contratoId, recurso.id);
      else await salvarRecurso(contratoId, recurso.id, { ...recurso, alocacoes: tirarDosMeses(recurso, mesInicial, modoExcluir) });
      onFechar();
    } catch (e) {
      console.error(e);
      setErro("Não deu pra tirar o recurso. Tente de novo.");
    }
  }
  const mesLongo = rotuloMes(mesInicial).toLowerCase();
  const mesSeguinte = rotuloMes(somarMeses(mesInicial, 1)).split("/")[0].toLowerCase();
  const mesAnterior = rotuloMes(somarMeses(mesInicial, -1)).split("/")[0].toLowerCase();
  const nomeCurto = String(recurso?.nome || "").replace(/^ALOCA[CÇ][AÃ]O\s*-\s*/i, "");
  const OPCOES_EXCLUIR = [
    ["so", `Só em ${mesLongo}`, `Em ${mesSeguinte} volta com a alocação de antes.`],
    ["daqui", `De ${mesLongo} em diante`, `${mesAnterior[0]?.toUpperCase() + mesAnterior.slice(1)} e os meses anteriores continuam como estão.`],
    ["ate", `Até ${mesLongo} (este mês e os anteriores)`, `Passa a valer só de ${mesSeguinte} em diante.`],
    ["todos", "Em todos os meses", "Apaga o recurso e todo o histórico de alocação. As medições já salvas não mudam."],
  ];

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

      {(
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <span style={{ ...rotulo, margin: 0 }}>Para onde vai</span>
            <EscolhaModoAlocacao modo={modo} onTrocar={setModo} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            <CabecalhoPartes classe="com-equipe" ultima={modo === "horas" ? "Horas no mês" : "%"} />
            {partes.map((p, i) => (
              <div key={i} className="linha-partes com-equipe">
                <SeletoresParte parte={p} centros={centros} equipes={equipes} indice={i} onMudar={(m) => mudarParte(i, m)} mes={desde} />
                <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
                  {modo === "horas" ? (
                    <>
                      <input value={p.horas ?? ""} onChange={(e) => mudarParte(i, { horas: e.target.value })} inputMode="decimal" aria-label={`Horas ${i + 1}`} style={{ width: 64 }} />h
                    </>
                  ) : (
                    <>
                      <input value={p.pct} onChange={(e) => mudarParte(i, { pct: e.target.value })} inputMode="decimal" aria-label={`Percentual ${i + 1}`} style={{ width: 64 }} />%
                    </>
                  )}
                </label>
                <button type="button" className="btn btn-ghost" style={{ padding: 0, width: 40 }} aria-label={`Remover parte ${i + 1}`} onClick={() => setPartes(partes.filter((_, j) => j !== i))} disabled={partes.length === 1}>
                  ×
                </button>
              </div>
            ))}
            <div className="texto-ajuda" style={{ marginTop: 0 }}>
              Equipe e frente são opcionais. A lista de frentes muda conforme a equipe escolhida.
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              onClick={() => setPartes([...partes, { centroId: "", equipeId: "", frenteId: "", horas: "", pct: modo === "horas" ? "" : formatarNumero(Math.max(0, Math.round((100 - soma) * 100) / 100), (100 - soma) % 1 ? 2 : 0) }])}
              style={{ background: "none", border: "1px dashed var(--color-gray-light)", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, color: "var(--color-primary)", minHeight: 36 }}
            >
              + Dividir com outro CC/ODI
            </button>
            {modo === "horas" ? (
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary-dark)" }}>{formatarNumero(soma, soma % 1 ? 2 : 0)} h por mês no padrão</span>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 600, color: Math.abs(soma - 100) < 0.001 ? "var(--color-primary-dark)" : "var(--color-orange)" }}>
                Soma: {formatarNumero(soma, soma % 1 ? 2 : 0)}%{Math.abs(soma - 100) < 0.001 ? " ✓" : ""}
              </span>
            )}
          </div>
          {modo === "horas" && (
            <div className="texto-ajuda">
              Na medição: vindo exatamente essas horas, cada CC/ODI fica com as suas. Vindo mais, as horas do padrão vão como estão e o que passar fica para você decidir (um ou vários CCs/ODIs). Vindo menos, a linha pede para você ajustar a divisão.
            </div>
          )}
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
                    {h.desde < "2001" ? `Até ${rotuloMesCurto(h.ate)}` : h.ate ? `${rotuloMesCurto(h.desde)} a ${rotuloMesCurto(h.ate)}` : `Desde ${rotuloMesCurto(h.desde)}`}
                    {vigente ? " (atual)" : h.desde > mesDe(new Date()) ? " (agendada)" : ""}
                  </span>
                  {h.fora ? <span style={{ color: "var(--color-orange)", fontWeight: 600 }}>Fora do contrato</span> : <Partes partes={h.partes} centrosPorId={centrosPorId} equipesPorId={equipesPorId} empilhar={false} />}
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
      {excluindo && recurso && (
        <div className="painel-excluir" role="group" aria-label={`Tirar ${nomeCurto} de quais meses`}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Tirar {nomeCurto} de quais meses?</div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {OPCOES_EXCLUIR.map(([k, t, d]) => (
              <label key={k} className={`opcao-excluir ${modoExcluir === k ? "ativa" : ""}`}>
                <input type="radio" name="modo-excluir" checked={modoExcluir === k} onChange={() => setModoExcluir(k)} />
                <span>
                  <b>{t}</b>
                  <span>{d}</span>
                </span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExcluindo(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-sm botao-laranja" onClick={excluir}>
              {modoExcluir === "todos" ? "Apagar o recurso" : modoExcluir === "so" ? `Tirar só de ${mesLongo.split("/")[0]}` : modoExcluir === "ate" ? `Tirar até ${mesLongo.split("/")[0]}` : `Tirar a partir de ${mesLongo.split("/")[0]}`}
            </button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 14, flexWrap: "wrap" }}>
        <span>
          {recurso && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--color-orange)", borderColor: "var(--color-orange-border)" }} onClick={() => setExcluindo(!excluindo)} aria-expanded={excluindo}>
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

// "Marcos, Rafael (40%)": quem tem parte da alocação do mês nessa equipe.
function alocadosNaEquipe(recursos, equipeId, mes) {
  const nomes = [];
  for (const r of recursos) {
    const a = alocacaoNoMes(r, mes);
    const pct = (a?.partes || []).filter((p) => p.equipeId === equipeId).reduce((s, p) => s + (Number(p.pct) || 0), 0);
    if (!pct) continue;
    const primeiro = r.nome.split(" ")[0];
    nomes.push(pct >= 99.999 ? primeiro : `${primeiro} (${formatarNumero(pct, pct % 1 ? 2 : 0)}%)`);
  }
  return nomes.join(", ");
}

// Partes de alocação (de qualquer mês) que usam a equipe ou a frente.
function usosDe(recursos, equipeId, frenteId) {
  return recursos.filter((r) => (r.alocacoes || []).some((a) => a.partes.some((p) => p.equipeId === equipeId && (!frenteId || p.frenteId === frenteId))));
}

const novoId = () => Math.random().toString(36).slice(2, 10);

function EditorEquipe({ contratoId, equipe, recursos, onFechar }) {
  const [nome, setNome] = useState(equipe?.nome || "");
  const [responsavel, setResponsavel] = useState(equipe?.responsavel || "");
  const [frentes, setFrentes] = useState(() => (equipe?.frentes || []).map((f) => ({ ...f })));
  const [nova, setNova] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  function adicionar() {
    const n = nova.trim();
    if (!n) return;
    if (frentes.some((f) => normalizarNome(f.nome) === normalizarNome(n))) return setErro(`A frente “${n}” já está na lista.`);
    setFrentes([...frentes, { id: novoId(), nome: n }]);
    setNova("");
    setErro("");
  }

  function remover(f) {
    const usam = equipe ? usosDe(recursos, equipe.id, f.id) : [];
    if (usam.length) return setErro(`A frente “${f.nome}” está nas alocações de ${usam.map((r) => r.nome).join(", ")}. Dá para renomear, mas não remover.`);
    setFrentes(frentes.filter((x) => x.id !== f.id));
  }

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) return setErro("Escreva o nome da equipe.");
    if (frentes.some((f) => !f.nome.trim())) return setErro("Uma frente ficou sem nome.");
    const lista = nova.trim() && !frentes.some((f) => normalizarNome(f.nome) === normalizarNome(nova)) ? [...frentes, { id: novoId(), nome: nova.trim() }] : frentes;
    setSalvando(true);
    try {
      await salvarEquipe(contratoId, equipe?.id, { nome, responsavel, frentes: lista });
      onFechar();
    } catch (err) {
      console.error(err);
      setErro("Não deu pra salvar. Tente de novo.");
      setSalvando(false);
    }
  }

  async function excluir() {
    const usam = usosDe(recursos, equipe.id);
    const aviso = usam.length
      ? `A equipe ${equipe.nome} aparece nas alocações de ${usam.map((r) => r.nome).join(", ")}. Excluir mesmo assim? Essas alocações vão ficar sem equipe.`
      : `Excluir a equipe ${equipe.nome}? As medições já salvas não mudam.`;
    if (!window.confirm(aviso)) return;
    await excluirEquipe(contratoId, equipe.id);
    onFechar();
  }

  return (
    <form onSubmit={salvar} aria-label={equipe ? `Editar equipe ${equipe.nome}` : "Nova equipe"}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ flex: "1 1 220px", margin: 0 }}>
          <span style={rotulo}>Nome da equipe</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Infra" maxLength={120} autoFocus />
        </label>
        <label style={{ flex: "1 1 220px", margin: 0 }}>
          <span style={rotulo}>Responsável (opcional)</span>
          <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Quem lidera a equipe" maxLength={120} />
        </label>
      </div>
      <span style={{ ...rotulo, marginTop: 14 }}>Frentes da equipe</span>
      {frentes.length === 0 && <div className="texto-ajuda" style={{ marginTop: 0 }}>Nenhuma frente ainda.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 480 }}>
        {frentes.map((f, i) => (
          <div key={f.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={f.nome} onChange={(e) => setFrentes(frentes.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} aria-label={`Frente ${i + 1}`} maxLength={120} />
            <button type="button" className="btn btn-ghost" style={{ padding: 0, width: 40, flex: "0 0 auto" }} aria-label={`Remover frente ${f.nome}`} onClick={() => remover(f)}>
              ×
            </button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionar();
              }
            }}
            placeholder="Nova frente, ex: Integrações"
            aria-label="Nova frente"
            maxLength={120}
          />
          <button type="button" className="btn btn-ghost btn-sm" onClick={adicionar} style={{ flex: "0 0 auto" }}>
            Adicionar
          </button>
        </div>
      </div>
      <div className="texto-ajuda">Uma frente que já está em alguma alocação não pode ser removida; dá para renomear.</div>
      {erro && (
        <div className="texto-alerta" role="alert" style={{ fontSize: 13, marginTop: 10 }}>
          {erro}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 12, flexWrap: "wrap" }}>
        <span>
          {equipe && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--color-orange)", borderColor: "var(--color-orange-border)" }} onClick={excluir}>
              Excluir equipe
            </button>
          )}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar equipe"}
          </button>
        </span>
      </div>
    </form>
  );
}
