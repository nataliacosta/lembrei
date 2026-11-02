import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useDados } from "../contexts/DadosContext";
import { carregarExtrasBusca } from "../lib/busca";
import { TIPO_POR_KEY } from "../lib/constants";
import { formatarData } from "../lib/datas";
import { IconeBusca } from "./Icones";

function normalizar(texto) {
  return (texto || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const GRUPOS = [
  { id: "itens", label: "Itens" },
  { id: "demandas", label: "Demandas" },
  { id: "contratos", label: "Contratos" },
  { id: "aditivos", label: "Aditivos" },
  { id: "frentes", label: "Frentes" },
];

const ICONES = {
  item: (
    <>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  reuniao: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  demanda: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  frente: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  contrato: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8" />
    </>
  ),
  aditivo: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M12 18v-6M9 15h6" />
    </>
  ),
};

const STATUS_CONTRATO = { ativo: "ativo", aditivo: "aditivo em andamento", cancelamento: "cancelamento em andamento", cancelado: "cancelado" };

// Procura em tudo que a pessoa acessa: itens (abertos e concluídos, incluindo
// reuniões), demandas (da própria fila e das compartilhadas), contratos,
// aditivos e frentes. Devolve os resultados agrupados por tipo.
export function useResultadosBusca(termo, ativa = true) {
  const { user } = useAuth();
  const { itensAbertos, frentes, contratos, mapaFrentes, minhaFila, minhasDemandas, filasCompartilhadas } = useDados();
  const [extras, setExtras] = useState({ itensConcluidos: [], aditivos: [], demandas: [] });

  useEffect(() => {
    if (!ativa || !user) return;
    let vivo = true;
    carregarExtrasBusca(user.uid, contratos, filasCompartilhadas).then((r) => vivo && setExtras(r));
    return () => {
      vivo = false;
    };
  }, [ativa, user, contratos, filasCompartilhadas]);

  return useMemo(() => {
    const t = normalizar(termo.trim());
    const vazio = { termo: t, grupos: [], total: 0 };
    if (t.length < 2) return vazio;
    const casa = (...campos) => campos.some((c) => normalizar(Array.isArray(c) ? c.join(" ") : c).includes(t));
    const mapaContratos = Object.fromEntries(contratos.map((c) => [c.id, c]));

    const abertos = itensAbertos.filter((i) => casa(i.titulo, i.descricao, i.tags, i.responsavelNome, i.lembrete?.mensagem));
    const concluidos = extras.itensConcluidos
      .filter((i) => casa(i.titulo, i.descricao, i.tags, i.responsavelNome))
      .sort((a, b) => (b.concluidoEm?.seconds || 0) - (a.concluidoEm?.seconds || 0));
    const itens = [...abertos, ...concluidos].map((i) => ({
      chave: `i:${i.id}`,
      icone: i.tipo === "reuniao" ? "reuniao" : "item",
      link: `/frentes/${i.frenteId}/itens/${i.id}`,
      titulo: i.titulo,
      concluido: Boolean(i.concluido),
      detalhe: [
        TIPO_POR_KEY[i.tipo]?.label,
        mapaFrentes[i.frenteId]?.nome,
        i.concluido ? i.concluidoEm && `concluído em ${formatarData(i.concluidoEm)}` : i.prazo && `prazo ${formatarData(i.prazo)}`,
      ]
        .filter(Boolean)
        .join(" · "),
    }));

    const filas = [
      ...(minhaFila ? [{ ...minhaFila, id: user?.uid, nome: "Sua fila", demandas: minhasDemandas }] : []),
      ...filasCompartilhadas.map((f) => ({
        ...f,
        nome: `Fila de ${f.donoNome || "outra pessoa"}`,
        demandas: extras.demandas.filter((d) => d.donoId === f.id),
      })),
    ];
    const demandas = filas
      .flatMap((f) =>
        f.demandas
          .filter((d) => casa(d.titulo, d.descricao, d.solicitante))
          .map((d) => {
            const pos = (f.ordem || []).indexOf(d.id);
            const situacao = d.concluida ? "concluída" : pos >= 0 ? `${pos + 1}º da fila` : "aguardando priorização";
            return {
              chave: `d:${f.id}:${d.id}`,
              icone: "demanda",
              link: `/demandas/${f.id}/${d.id}`,
              titulo: d.titulo,
              concluido: Boolean(d.concluida),
              detalhe: ["Demanda", f.nome, situacao, d.solicitante && `pedida por ${d.solicitante}`].filter(Boolean).join(" · "),
            };
          })
      )
      .sort((a, b) => a.concluido - b.concluido);

    const cs = contratos
      .filter((c) => casa(c.titulo, c.numero, c.fornecedor, c.escopo))
      .map((c) => ({
        chave: `c:${c.id}`,
        icone: "contrato",
        link: `/contratos/${c.id}`,
        titulo: c.titulo,
        detalhe: ["Contrato", c.fornecedor, c.numero && `Nº ${c.numero}`, STATUS_CONTRATO[c.status]].filter(Boolean).join(" · "),
      }));

    const ads = extras.aditivos
      .filter((a) => casa((a.tipo || []).join(" "), a.motivo, a.numeroRQS, a.pendenteEm, mapaContratos[a.contratoId]?.titulo))
      .sort((a, b) => a.finalizado - b.finalizado)
      .map((a) => ({
        chave: `a:${a.contratoId}:${a.id}`,
        icone: "aditivo",
        link: `/contratos/${a.contratoId}/aditivos/${a.id}`,
        titulo: `Aditivo de ${(a.tipo || []).join(", ") || "contrato"} · ${mapaContratos[a.contratoId]?.titulo || ""}`,
        concluido: Boolean(a.finalizado),
        detalhe: [
          "Aditivo",
          a.finalizado ? "finalizado" : a.pendenteEm && `pendente em ${a.pendenteEm}`,
          a.numeroRQS && `RQS ${a.numeroRQS}`,
          a.dataSolicitacao && `desde ${formatarData(a.dataSolicitacao)}`,
        ]
          .filter(Boolean)
          .join(" · "),
      }));

    const fs = frentes
      .filter((f) => casa(f.nome, f.descricao))
      .map((f) => {
        const abertosNaFrente = itensAbertos.filter((i) => i.frenteId === f.id).length;
        return {
          chave: `f:${f.id}`,
          icone: "frente",
          link: `/frentes/${f.id}`,
          titulo: f.nome,
          detalhe: `Frente · ${abertosNaFrente} ${abertosNaFrente === 1 ? "item aberto" : "itens abertos"}`,
        };
      });

    const porGrupo = { itens, demandas, contratos: cs, aditivos: ads, frentes: fs };
    const grupos = GRUPOS.map((g) => ({ ...g, resultados: porGrupo[g.id] })).filter((g) => g.resultados.length);
    return { termo: t, grupos, total: grupos.reduce((s, g) => s + g.resultados.length, 0) };
  }, [termo, itensAbertos, frentes, contratos, mapaFrentes, minhaFila, minhasDemandas, filasCompartilhadas, extras, user]);
}

// Resultados visíveis com o filtro escolhido (todos limitados por grupo).
export function resultadosVisiveis(busca, filtro, porGrupo) {
  return busca.grupos
    .filter((g) => filtro === "tudo" || g.id === filtro)
    .map((g) => ({ ...g, mostrados: g.resultados.slice(0, filtro === "tudo" ? porGrupo : 50) }));
}

function Destaque({ texto, termo }) {
  const i = normalizar(texto).indexOf(termo);
  if (!termo || i < 0) return texto;
  return (
    <>
      {texto.slice(0, i)}
      <mark className="busca-marca">{texto.slice(i, i + termo.length)}</mark>
      {texto.slice(i + termo.length)}
    </>
  );
}

export function ListaResultados({ termo, busca, filtro, onFiltro, ativo, onEscolher, porGrupo = 5 }) {
  if (termo.trim().length < 2) {
    return <div className="empty-state" style={{ padding: 20 }}>Digite pelo menos 2 letras.</div>;
  }
  if (busca.total === 0) {
    return <div className="empty-state" style={{ padding: 20 }}>Nada encontrado para “{termo}”.</div>;
  }
  const grupos = resultadosVisiveis(busca, filtro, porGrupo);
  let indice = -1;
  return (
    <>
      <div className="busca-filtros" role="group" aria-label="Filtrar resultados">
        <button type="button" className={`busca-filtro${filtro === "tudo" ? " ativo" : ""}`} aria-pressed={filtro === "tudo"} onMouseDown={(e) => e.preventDefault()} onClick={() => onFiltro("tudo")}>
          Tudo · {busca.total}
        </button>
        {busca.grupos.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`busca-filtro${filtro === g.id ? " ativo" : ""}`}
            aria-pressed={filtro === g.id}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFiltro(g.id)}
          >
            {g.label} · {g.resultados.length}
          </button>
        ))}
      </div>
      {grupos.map((g) => (
        <div key={g.id} className="busca-grupo">
          <div className="busca-grupo-titulo">
            <span>
              {g.label} · {g.resultados.length}
            </span>
            {g.mostrados.length < g.resultados.length && (
              <button type="button" className="link-botao" style={{ fontSize: 12 }} onMouseDown={(e) => e.preventDefault()} onClick={() => onFiltro(g.id)}>
                Ver todos
              </button>
            )}
          </div>
          {g.mostrados.map((r) => {
            indice += 1;
            return (
              <Link key={r.chave} to={r.link} className={`busca-resultado${indice === ativo ? " ativo" : ""}`} onClick={onEscolher} role="option" aria-selected={indice === ativo}>
                <span className="busca-icone" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {ICONES[r.icone]}
                  </svg>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="busca-titulo">
                    <Destaque texto={r.titulo} termo={busca.termo} />
                  </span>
                  <span className="busca-detalhe">{r.detalhe}</span>
                </span>
                {r.concluido && <span className="busca-concluido">{r.icone === "aditivo" ? "Finalizado" : "Concluído"}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

// Campo de busca do topo (computador). Atalho: "/".
export default function Busca() {
  const [termo, setTermo] = useState("");
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [filtro, setFiltro] = useState("tudo");
  const [usada, setUsada] = useState(false);
  const inputRef = useRef(null);
  const caixaRef = useRef(null);
  const navigate = useNavigate();
  const busca = useResultadosBusca(termo, usada);
  const lista = resultadosVisiveis(busca, filtro, 5).flatMap((g) => g.mostrados);

  useEffect(() => {
    function atalho(e) {
      const alvo = e.target;
      const digitando = alvo.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName);
      if (e.key === "/" && !digitando) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    function fora(e) {
      if (caixaRef.current && !caixaRef.current.contains(e.target)) setAberta(false);
    }
    document.addEventListener("keydown", atalho);
    document.addEventListener("mousedown", fora);
    return () => {
      document.removeEventListener("keydown", atalho);
      document.removeEventListener("mousedown", fora);
    };
  }, []);

  function fechar() {
    setAberta(false);
    setTermo("");
    setFiltro("tudo");
    inputRef.current?.blur();
  }

  function teclas(e) {
    if (e.key === "Escape") return fechar();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((a) => Math.min(a + 1, lista.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && lista[ativo]) {
      e.preventDefault();
      navigate(lista[ativo].link);
      fechar();
    }
  }

  return (
    <div className="busca so-desktop" ref={caixaRef}>
      <span style={{ position: "absolute", left: 12, top: 11, color: "var(--color-gray)" }}>
        <IconeBusca size={18} />
      </span>
      <input
        ref={inputRef}
        type="search"
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value);
          setAtivo(0);
          setFiltro("tudo");
          setAberta(true);
        }}
        onFocus={() => {
          setAberta(true);
          setUsada(true);
        }}
        onKeyDown={teclas}
        placeholder="Buscar em tudo…  ( / )"
        aria-label="Buscar em itens, demandas, frentes, contratos e aditivos"
      />
      {aberta && termo && (
        <div className="busca-resultados" role="listbox">
          <ListaResultados
            termo={termo}
            busca={busca}
            filtro={filtro}
            onFiltro={(f) => {
              setFiltro(f);
              setAtivo(0);
              inputRef.current?.focus();
            }}
            ativo={ativo}
            onEscolher={fechar}
          />
          {busca.total > 0 && (
            <div className="busca-rodape">
              <span>↑ ↓ para navegar · Enter para abrir · Esc para fechar</span>
              <span>Inclui itens concluídos</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
