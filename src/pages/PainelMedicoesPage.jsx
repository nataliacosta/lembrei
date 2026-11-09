import { useEffect, useMemo, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useDados } from "../contexts/DadosContext";
import { useMedicoesDosContratos } from "../hooks/useMedicoesDosContratos";
import { formatarReais, mesDe, normalizarNome, rotuloMes, somarMeses } from "../lib/alocacoes";
import { prazoDoMes } from "../lib/medicao";
import { correcaoDoCiclo, nomesDoContrato, situacaoDoMes } from "../lib/medicoesDoMes";
import { marcarMedicaoFeita } from "../lib/contratos";
import { formatarDataRelativa, inicioDoDia } from "../lib/datas";

const ORDEM = { atrasada: 0, parcial: 1, nao: 2, alancar: 3, lancada: 4 };
const FILTROS = [
  ["todas", "Todas"],
  ["subir", "Faltam subir"],
  ["lancar", "Falta lançar"],
  ["lancadas", "Lançadas"],
];
const grupo = (st) => (st === "lancada" ? "lancadas" : st === "alancar" ? "lancar" : "subir");

// Abas da tela de Contratos (lista e painel de medições).
export function AbasContratos({ ativa }) {
  return (
    <nav className="abas-contrato" aria-label="Seções de contratos">
      <NavLink to="/contratos" end aria-current={ativa === "contratos" ? "page" : undefined}>
        Contratos
      </NavLink>
      <NavLink to="/contratos/medicoes" aria-current={ativa === "medicoes" ? "page" : undefined}>
        Medições
      </NavLink>
    </nav>
  );
}

function Situacao({ linha }) {
  const { st, sit } = linha;
  const [txt, bg, cor] =
    st === "atrasada"
      ? [sit.subidas ? `Atrasada · ${sit.subidas} de ${sit.total} subidas` : "Atrasada · não subida", "#fde3d3", "var(--color-orange)"]
      : st === "parcial"
        ? [`${sit.subidas} de ${sit.total} subidas`, "#fff0e4", "var(--color-orange)"]
        : st === "nao"
          ? ["Não subida", "#eceeee", "var(--color-gray)"]
          : st === "alancar"
            ? ["Falta lançar no sistema", "#fff0e4", "var(--color-orange)"]
            : ["Lançada", "#e0f5ef", "var(--color-primary-dark)"];
  return (
    <span className="pill" style={{ background: bg, color: cor, whiteSpace: "nowrap" }}>
      {txt}
    </span>
  );
}

export default function PainelMedicoesPage() {
  const { user } = useAuth();
  const { contratos } = useDados();
  const comMedicao = useMemo(() => contratos.filter((c) => c.medicao?.ativa && c.status !== "cancelado"), [contratos]);
  const { medicoes, carregando } = useMedicoesDosContratos(comMedicao);
  const hoje = inicioDoDia();
  // Mês das horas: por padrão o anterior ao atual (o que tem prazo agora).
  const [ref, setRef] = useState(() => somarMeses(mesDe(new Date()), -1));
  const [quem, setQuem] = useState("todas");
  const [filtro, setFiltro] = useState("todas");
  const [busca, setBusca] = useState("");
  const ciclo = somarMeses(ref, 1);
  const [anoC, mesC] = ciclo.split("-").map(Number);

  const linhas = useMemo(() => {
    return comMedicao
      .map((c) => {
        const doMes = medicoes.filter((m) => m.contratoId === c.id && m.mes === ref);
        const nomes = nomesDoContrato(c);
        const sit = situacaoDoMes(nomes, doMes);
        const prazo = prazoDoMes(anoC, mesC - 1, Number(c.medicao.diaPrazo) || 10);
        const feita = Boolean(c.medicao.feitas?.[ciclo]);
        // Com medição salva, a situação vem dela; o "feito" do contrato só vale sem medição (feita sem planilha).
        const temMedicao = sit.subidas > 0 || sit.extras.length > 0;
        const st = temMedicao
          ? sit.todasLancadas
            ? "lancada"
            : sit.todasSubidas
              ? "alancar"
              : prazo < hoje
                ? "atrasada"
                : "parcial"
          : feita
            ? "lancada"
            : prazo < hoje
              ? "atrasada"
              : "nao";
        const valor = doMes.reduce((s, m) => s + (Number(m.total) || 0), 0);
        const todas = [...sit.previstas.map((p) => p.medicao), ...sit.extras].filter(Boolean);
        const resumo =
          nomes.length || sit.extras.length
            ? [...sit.previstas.map((p) => `${p.nome || "Medição do mês"} ${p.medicao ? (p.medicao.status === "lancada" ? "✓" : "· a lançar") : "· não subida"}`), ...sit.extras.map((x) => `${x.nome} (extra) ${x.status === "lancada" ? "✓" : "· a lançar"}`)].join(" · ")
            : todas.length
              ? "1 medição"
              : feita
                ? "feita sem planilha"
                : "—";
        const abrir = !nomes.length && todas.length === 1 ? `/contratos/${c.id}/medicoes/${todas[0].id}` : `/contratos/${c.id}/medicoes`;
        return { c, sit, st, prazo, valor, resumo, abrir, subir: st === "atrasada" || st === "parcial" || st === "nao", corrigir: correcaoDoCiclo(feita, sit) };
      })
      .sort((a, b) => ORDEM[a.st] - ORDEM[b.st] || a.prazo - b.prazo || String(a.c.titulo).localeCompare(String(b.c.titulo)));
  }, [comMedicao, medicoes, ref, ciclo, anoC, mesC, hoje.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  // Acerta o "feito" do ciclo nos contratos em que ele não bate com as medições
  // (ex.: medição subida de novo depois de lançada), para o lembrete voltar.
  const aCorrigir = linhas.filter((l) => l.corrigir !== null && ["proprietario", "editor"].includes(l.c.membros?.[user.uid]));
  const chaveCorrecao = aCorrigir.map((l) => `${l.c.id}:${l.corrigir}`).join(",");
  useEffect(() => {
    if (carregando) return;
    for (const l of aCorrigir) marcarMedicaoFeita(l.c.id, ciclo, l.corrigir).catch((e) => console.error("Não deu pra acertar o ciclo da medição:", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveCorrecao, carregando]);

  const minhas = linhas.filter((l) => quem === "todas" || l.c.medicao?.responsavelId === user.uid);
  const conta = (g) => minhas.filter((l) => grupo(l.st) === g).length;
  const t = normalizarNome(busca);
  const visiveis = minhas.filter((l) => (filtro === "todas" || grupo(l.st) === filtro) && (!t || normalizarNome(`${l.c.titulo} ${l.c.fornecedor || ""}`).includes(t)));
  const valorMes = minhas.reduce((s, l) => s + l.valor, 0);
  const nomeMes = rotuloMes(ref).toLowerCase();
  const nomeCiclo = rotuloMes(ciclo).split("/")[0].toLowerCase();

  return (
    <div className="page-shell" style={{ paddingTop: 28, paddingBottom: 60, maxWidth: 1180 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ margin: "0 0 4px 0", fontSize: 26, fontWeight: 700 }}>Contratos</h1>
          <p style={{ margin: 0, color: "var(--color-gray)", fontSize: 14 }}>Fornecedores, vencimentos, aditivos, cancelamentos e medições.</p>
        </div>
        <Link to="/contratos/novo" className="btn btn-primary">
          + Novo contrato
        </Link>
      </div>
      <AbasContratos ativa="medicoes" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Mês anterior" onClick={() => setRef(somarMeses(ref, -1))}>
            ‹
          </button>
          <span style={{ minWidth: 200, textAlign: "center" }}>
            <b style={{ fontSize: 16 }}>Medição de {nomeMes}</b>
            <div style={{ fontSize: 12, color: "var(--color-gray)" }}>prazos em {nomeCiclo}</div>
          </span>
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Próximo mês" onClick={() => setRef(somarMeses(ref, 1))}>
            ›
          </button>
        </div>
        <div className="chips-row" role="group" aria-label="Responsável" style={{ alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--color-gray)" }}>Responsável:</span>
          <button type="button" className="chip" aria-pressed={quem === "minhas"} onClick={() => setQuem("minhas")}>
            Minhas
          </button>
          <button type="button" className="chip" aria-pressed={quem === "todas"} onClick={() => setQuem("todas")}>
            Todas
          </button>
        </div>
      </div>

      <div className="medicao-numeros controle-numeros painel-numeros">
        <div className="lista-card">
          <span style={{ fontSize: 12, color: "var(--color-gray)" }}>Contratos com medição</span>
          <b>{minhas.length}</b>
        </div>
        <div className="lista-card">
          <span style={{ fontSize: 12, color: "var(--color-gray)" }}>Faltam subir</span>
          <b className={conta("subir") ? "texto-alerta" : ""}>{conta("subir")}</b>
        </div>
        <div className="lista-card">
          <span style={{ fontSize: 12, color: "var(--color-gray)" }}>Falta lançar no sistema</span>
          <b className={conta("lancar") ? "texto-alerta" : ""}>{conta("lancar")}</b>
        </div>
        <div className="lista-card">
          <span style={{ fontSize: 12, color: "var(--color-gray)" }}>Lançadas</span>
          <b style={{ color: "var(--color-primary-dark)" }}>{conta("lancadas")}</b>
        </div>
        <div className="lista-card">
          <span style={{ fontSize: 12, color: "var(--color-gray)" }}>Valor subido no mês</span>
          <b>{formatarReais(valorMes)}</b>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "16px 0 8px" }}>
        <div className="chips-row" role="group" aria-label="Situação">
          {FILTROS.map(([k, rot]) => (
            <button key={k} type="button" className="chip" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>
              {rot} · {k === "todas" ? minhas.length : conta(k)}
            </button>
          ))}
        </div>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar contrato ou fornecedor…" aria-label="Buscar contrato ou fornecedor" style={{ width: 240, padding: "6px 10px", marginLeft: "auto" }} />
      </div>

      {carregando && !linhas.length ? (
        <div className="spinner-wrap">Carregando...</div>
      ) : comMedicao.length === 0 ? (
        <div className="empty-state">Nenhum contrato com medição mensal. Ligue “Tem medição mensal” em Editar contrato.</div>
      ) : (
        <>
          <div className="lista-card so-desktop">
            <table className="tabela-med tabela-orc2">
              <thead>
                <tr>
                  <th>Contrato</th>
                  <th>Responsável</th>
                  <th>Prazo</th>
                  <th>Medições do mês</th>
                  <th className="num">Valor</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visiveis.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ color: "var(--color-gray)" }}>
                      Nada com esse filtro.
                    </td>
                  </tr>
                )}
                {visiveis.map((l) => (
                  <tr key={l.c.id}>
                    <td>
                      <Link to={`/contratos/${l.c.id}/medicoes`} style={{ fontWeight: 700, color: "inherit" }}>
                        {l.c.titulo}
                      </Link>
                      {l.c.fornecedor && <div className="sub">{l.c.fornecedor}</div>}
                    </td>
                    <td>{l.c.medicao?.responsavelNome || "—"}</td>
                    <td className={l.st === "atrasada" ? "texto-alerta" : ""} style={{ whiteSpace: "nowrap" }}>
                      {formatarDataRelativa(l.prazo)}
                      {l.st === "atrasada" ? " · atrasada" : ""}
                    </td>
                    <td style={{ fontSize: 13 }}>{l.resumo}</td>
                    <td className="num">{l.valor ? formatarReais(l.valor) : "—"}</td>
                    <td>
                      <Situacao linha={l} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {l.subir ? (
                        <Link to={`/contratos/${l.c.id}/medicoes/nova?mes=${ref}`} className="btn btn-primary btn-sm">
                          Subir
                        </Link>
                      ) : (
                        <Link to={l.abrir} className="btn btn-ghost btn-sm">
                          Abrir
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lista-card so-mobile">
            {visiveis.length === 0 && <div style={{ padding: 14, color: "var(--color-gray)", fontSize: 14 }}>Nada com esse filtro.</div>}
            {visiveis.map((l) => (
              <Link key={l.c.id} to={l.subir ? `/contratos/${l.c.id}/medicoes/nova?mes=${ref}` : l.abrir} className="cartao-medicao-painel">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{l.c.titulo}</div>
                    <div className="sub">
                      {[l.c.fornecedor, `prazo ${formatarDataRelativa(l.prazo).toLowerCase()}`].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <b style={{ fontSize: 13, color: "var(--color-primary)" }}>{l.subir ? "Subir" : "Abrir"}</b>
                </div>
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <Situacao linha={l} />
                  {l.valor > 0 && <span className="sub">{formatarReais(l.valor)}</span>}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
      <div className="texto-ajuda">
        Só os contratos com medição mensal. Ordem: atrasadas, faltam subir, falta lançar e lançadas. “Subir” abre a subida já no mês certo; “Abrir” vai para a medição (ou para a aba Medições do contrato, quando ele tem várias).
      </div>
    </div>
  );
}
