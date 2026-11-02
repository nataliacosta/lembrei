import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AgendaRow from "../components/AgendaRow";
import Avatar from "../components/Avatar";
import NovaFrenteModal from "../components/NovaFrenteModal";
import { useAuth } from "../contexts/AuthContext";
import { BotaoVoltar } from "../contexts/HistoricoContext";

import { useUsuarios } from "../hooks/useUsuarios";
import { excluirFrente, watchFrente, watchItens } from "../lib/firestore";
import { agruparItensDaFrente, ehMeu } from "../lib/agenda";
import { FRENTE_CONTRATOS_ID, STATUS_OPCOES, TIPOS } from "../lib/constants";
import { paraDate } from "../lib/datas";
import { preparosDaOcorrencia, proximaOcorrencia } from "../lib/reunioes";

// A data que aparece na linha do item: a mais próxima entre prazo e lembrete.
function entradaDoItem(item) {
  if (item.tipo === "reuniao" && item.reuniao) {
    const ocorrencia = proximaOcorrencia(item.reuniao);
    if (ocorrencia) {
      return { chave: item.id, tipo: "reuniao", item, data: ocorrencia, preparos: preparosDaOcorrencia(item.reuniao, ocorrencia) };
    }
    return { chave: item.id, tipo: "sem-data", item, data: null };
  }
  const prazo = item.prazo ? paraDate(item.prazo) : null;
  const lembrete = item.lembrete?.ativo ? paraDate(item.lembrete.proximaVerificacao) : null;
  const data = [prazo, lembrete].filter(Boolean).sort((a, b) => a - b)[0] || null;
  return { chave: item.id, tipo: data ? "prazo" : "sem-data", item, data };
}

export default function FrentePage() {
  const { frenteId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [frente, setFrente] = useState(undefined);
  const [itens, setItens] = useState([]);
  const [categoria, setCategoria] = useState("abertos");
  const [filtroTag, setFiltroTag] = useState("");
  const [soMeus, setSoMeus] = useState(false);
  const [status, setStatus] = useState("");
  const [erroItens, setErroItens] = useState("");
  const [editandoFrente, setEditandoFrente] = useState(false);

  useEffect(() => watchFrente(frenteId, setFrente), [frenteId]);

  useEffect(
    () =>
      watchItens(
        frenteId,
        (lista) => {
          setItens(lista);
          setErroItens("");
        },
        (erro) => setErroItens(erro.message || String(erro))
      ),
    [frenteId]
  );

  const membros = useUsuarios(frente?.membrosUids || []);

  const contagens = useMemo(() => {
    const base = { abertos: 0, concluido: 0 };
    TIPOS.forEach((t) => (base[t.key] = 0));
    itens.forEach((item) => {
      if (item.concluido) base.concluido++;
      else {
        base.abertos++;
        base[item.tipo] = (base[item.tipo] || 0) + 1;
      }
    });
    return base;
  }, [itens]);

  const itensFiltrados = useMemo(() => {
    return itens.filter((item) => {
      const passaCategoria =
        categoria === "concluido" ? item.concluido : !item.concluido && (categoria === "abertos" || item.tipo === categoria);
      const passaTag = !filtroTag || item.tags?.some((t) => t.toLowerCase().includes(filtroTag.replace(/^#/, "").toLowerCase()));
      const passaMeus = !soMeus || ehMeu(item, user.uid);
      const passaStatus = !status || item.status === status;
      return passaCategoria && passaTag && passaMeus && passaStatus;
    });
  }, [itens, categoria, filtroTag, soMeus, status, user.uid]);

  if (frente === undefined) return <div className="spinner-wrap">Carregando...</div>;
  if (frente === null) return <div className="spinner-wrap">Frente não encontrada (ou você não tem acesso).</div>;

  const papel = frente.membros?.[user.uid];
  const podeEditar = papel === "proprietario" || papel === "editor";
  // A frente "Contratos" é padrão e necessária pro funcionamento dos
  // aditivos — não dá pra excluir, nem quem é proprietário.
  const ehFrentePadrao = frenteId === FRENTE_CONTRATOS_ID;
  const souProprietario = papel === "proprietario" && !ehFrentePadrao;

  async function excluir() {
    if (!window.confirm(`Excluir a frente "${frente.nome}" e todos os seus itens? Essa ação não pode ser desfeita.`)) return;
    await excluirFrente(frenteId);
    navigate("/dashboard", { replace: true });
  }

  const { atrasados, comData, semData } = agruparItensDaFrente(itensFiltrados);
  const grupos =
    categoria === "concluido"
      ? [{ key: "concluidos", label: "Concluídos", itens: itensFiltrados }]
      : [
          { key: "atrasados", label: "Atrasados", itens: atrasados, alerta: true },
          { key: "proximos", label: "Próximos", itens: comData },
          { key: "sem-data", label: "Sem prazo", itens: semData },
        ];

  const opcoesCategoria = [
    { key: "abertos", label: "Abertos" },
    ...TIPOS.filter((t) => contagens[t.key] > 0).map((t) => ({ key: t.key, label: t.plural })),
    { key: "concluido", label: "Concluídos" },
  ];

  return (
    <div className="page-shell" style={{ paddingTop: 24, paddingBottom: 48, maxWidth: 1180 }}>
      <BotaoVoltar destinoPadrao="/frentes" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
        <div style={{ flex: "1 1 420px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: frente.cor, flex: "0 0 auto" }} />
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{frente.nome}</h1>
          </div>
          {frente.descricao && (
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--color-gray)", maxWidth: 640 }}>{frente.descricao}</p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, fontSize: 13, color: "var(--color-gray)", flexWrap: "wrap" }}>
            <span>
              {atrasados.length > 0 && categoria !== "concluido" && (
                <b className="texto-alerta">{atrasados.length} atrasados · </b>
              )}
              {contagens.abertos} abertos · {contagens.concluido} concluídos
            </span>
            <span style={{ display: "flex", paddingLeft: 6 }}>
              {(frente.membrosUids || []).map((uid) => (
                <Avatar
                  key={uid}
                  nome={membros[uid]?.nome}
                  url={membros[uid]?.avatarUrl}
                  tamanho={26}
                  style={{ border: "2px solid var(--color-bg-soft)", marginLeft: -6 }}
                />
              ))}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flex: "0 0 auto", flexWrap: "wrap" }}>
          {podeEditar && (
            <button type="button" className="btn btn-ghost" onClick={() => setEditandoFrente(true)}>
              Editar
            </button>
          )}
          <Link to={`/frentes/${frenteId}/compartilhar`} className="btn btn-ghost">
            Compartilhar
          </Link>
          {podeEditar && (
            <Link to={`/frentes/${frenteId}/novo`} className="btn btn-primary so-desktop">
              + Novo item
            </Link>
          )}
          {souProprietario && (
            <button
              onClick={excluir}
              className="btn btn-ghost"
              style={{ color: "var(--color-orange)", borderColor: "var(--color-orange-border)" }}
            >
              Excluir frente
            </button>
          )}
        </div>
      </div>

      <div className="chips-row chips-rolagem" style={{ marginTop: 20 }} role="group" aria-label="Filtrar por tipo">
        {opcoesCategoria.map((c) => (
          <button key={c.key} type="button" className="chip" aria-pressed={categoria === c.key} onClick={() => setCategoria(c.key)}>
            {c.label} · {contagens[c.key] || 0}
          </button>
        ))}
      </div>
      <div className="chips-row" style={{ marginTop: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, margin: 0, minHeight: 36 }}>
          <input type="checkbox" checked={soMeus} onChange={(e) => setSoMeus(e.target.checked)} style={{ width: "auto" }} />
          Só os meus
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filtrar por status"
          style={{ width: "auto", borderRadius: 17, padding: "7px 12px", fontSize: 13 }}
        >
          <option value="">Qualquer status</option>
          {STATUS_OPCOES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="#tag"
          aria-label="Filtrar por tag"
          value={filtroTag}
          onChange={(e) => setFiltroTag(e.target.value)}
          style={{ width: 140, borderRadius: 17, padding: "7px 12px", fontSize: 13 }}
        />
      </div>

      {erroItens ? (
        <div className="empty-state" style={{ color: "var(--color-orange)" }}>
          Não deu pra carregar os itens: {erroItens}
        </div>
      ) : itensFiltrados.length === 0 ? (
        <div className="empty-state">
          {categoria === "concluido" ? "Nenhum item concluído ainda." : "Nenhum item aqui ainda."}
          {podeEditar && categoria !== "concluido" && (
            <div style={{ marginTop: 12 }}>
              <Link to={`/frentes/${frenteId}/novo`} className="btn btn-primary">
                + Novo item
              </Link>
            </div>
          )}
        </div>
      ) : (
        grupos.map((g) =>
          g.itens.length === 0 ? null : (
            <section key={g.key}>
              <h2 className={`grupo-titulo ${g.alerta ? "grupo-alerta" : ""}`}>
                {g.label} · {g.itens.length}
              </h2>
              <div className={`lista-card ${g.alerta ? "alerta" : ""}`}>
                {g.itens.map((item) => (
                  <AgendaRow
                    key={item.id}
                    entrada={entradaDoItem(item)}
                    frente={frente}
                    podeEditar={podeEditar && !item.concluido}
                    mostrarFrente={false}
                  />
                ))}
              </div>
            </section>
          )
        )
      )}
      {editandoFrente && <NovaFrenteModal frente={{ ...frente, id: frenteId }} onClose={() => setEditandoFrente(false)} />}
    </div>
  );
}
