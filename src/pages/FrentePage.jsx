import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ItemCard from "../components/ItemCard";
import { useAuth } from "../contexts/AuthContext";
import { useUsuarios } from "../hooks/useUsuarios";
import { excluirFrente, watchFrente, watchItens } from "../lib/firestore";
import { FRENTE_CONTRATOS_ID, STATUS_OPCOES, TIPOS } from "../lib/constants";

const OPCOES_CATEGORIA = [...TIPOS.map((t) => ({ key: t.key, label: t.label + "s" })), { key: "concluido", label: "Concluídos" }];

export default function FrentePage() {
  const { frenteId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [frente, setFrente] = useState(undefined);
  const [itens, setItens] = useState([]);
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState([]);
  const [filtroTag, setFiltroTag] = useState("");
  const [soMeus, setSoMeus] = useState(false);
  const [statusSelecionados, setStatusSelecionados] = useState([]);
  const [erroItens, setErroItens] = useState("");

  useEffect(() => {
    const unsub = watchFrente(frenteId, setFrente);
    return unsub;
  }, [frenteId]);

  useEffect(() => {
    setErroItens("");
    const unsub = watchItens(
      frenteId,
      setItens,
      (erro) => setErroItens(erro.message || String(erro))
    );
    return unsub;
  }, [frenteId]);

  const membros = useUsuarios(frente?.membrosUids || []);

  const itensFiltrados = useMemo(() => {
    return itens.filter((item) => {
      const categoria = item.concluido ? "concluido" : item.tipo;
      const passaCategoria =
        categoriasSelecionadas.length === 0 ? !item.concluido : categoriasSelecionadas.includes(categoria);
      const passaTag = !filtroTag || item.tags?.some((t) => t.toLowerCase().includes(filtroTag.toLowerCase()));
      const passaMeus = !soMeus || item.responsavelId === user.uid;
      const passaStatus = statusSelecionados.length === 0 || statusSelecionados.includes(item.status);
      return passaCategoria && passaTag && passaMeus && passaStatus;
    });
  }, [itens, categoriasSelecionadas, filtroTag, soMeus, statusSelecionados, user.uid]);

  function alternarCategoria(c) {
    setCategoriasSelecionadas((atual) => (atual.includes(c) ? atual.filter((x) => x !== c) : [...atual, c]));
  }

  function alternarStatus(s) {
    setStatusSelecionados((atual) => (atual.includes(s) ? atual.filter((x) => x !== s) : [...atual, s]));
  }

  async function excluir() {
    if (!window.confirm(`Excluir a frente "${frente.nome}" e todos os seus itens? Essa ação não pode ser desfeita.`)) return;
    await excluirFrente(frenteId);
    navigate("/dashboard");
  }

  const contagens = useMemo(() => {
    const base = { todos: 0, concluido: 0 };
    TIPOS.forEach((t) => (base[t.key] = 0));
    itens.forEach((item) => {
      if (item.concluido) base.concluido++;
      else {
        base.todos++;
        base[item.tipo] = (base[item.tipo] || 0) + 1;
      }
    });
    return base;
  }, [itens]);

  if (frente === undefined) return <div className="spinner-wrap">Carregando...</div>;
  if (frente === null) return <div className="spinner-wrap">Frente não encontrada (ou você não tem acesso).</div>;

  const papel = frente.membros?.[user.uid];
  const podeEditar = papel === "proprietario" || papel === "editor";
  // A frente "Contratos" é padrão e necessária pro funcionamento dos
  // aditivos — não dá pra excluir, nem quem é proprietário.
  const ehFrentePadrao = frenteId === FRENTE_CONTRATOS_ID;
  const souProprietario = papel === "proprietario" && !ehFrentePadrao;

  return (
    <div>
      <div className="page-shell" style={{ paddingTop: 28 }}>
        <Link to="/dashboard" style={{ fontSize: 13, fontWeight: 600 }}>
          ← Painel geral
        </Link>
      </div>

      <div
        className="page-shell"
        style={{
          paddingTop: 16,
          paddingBottom: 24,
          borderBottom: "1px solid var(--color-gray-light)",
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: "1 1 420px", minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: frente.cor, flex: "0 0 auto" }} />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{frente.nome}</h1>
          </div>
          {frente.descricao && (
            <p style={{ margin: "0 0 12px 0", fontSize: 14, color: "var(--color-gray)", maxWidth: 640 }}>
              {frente.descricao}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "var(--color-gray)" }}>Membros:</span>
            <div style={{ display: "flex", marginLeft: -6 }}>
              {(frente.membrosUids || []).map((uid) => (
                <div
                  key={uid}
                  className="avatar"
                  style={{ width: 28, height: 28, fontSize: 11, border: "2px solid #fff", marginLeft: -6 }}
                  title={membros[uid]?.nome}
                >
                  {(membros[uid]?.nome || "?").slice(0, 2).toUpperCase()}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flex: "0 0 auto" }}>
          <Link to={`/frentes/${frenteId}/compartilhar`} className="btn btn-ghost">
            Compartilhar
          </Link>
          {podeEditar && (
            <Link to={`/frentes/${frenteId}/novo`} className="btn btn-primary">
              + Novo item
            </Link>
          )}
          {souProprietario && (
            <button
              onClick={excluir}
              className="btn btn-ghost"
              style={{ color: "var(--color-orange)", borderColor: "var(--color-orange)" }}
            >
              Excluir frente
            </button>
          )}
        </div>
      </div>

      <div className="page-shell" style={{ paddingTop: 20, paddingBottom: 20, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid var(--color-gray-light)" }}>
        <button
          onClick={() => setCategoriasSelecionadas([])}
          style={{
            background: categoriasSelecionadas.length === 0 ? "var(--color-primary)" : "#fff",
            color: categoriasSelecionadas.length === 0 ? "#fff" : "var(--color-gray)",
            border: `1px solid ${categoriasSelecionadas.length === 0 ? "var(--color-primary)" : "var(--color-gray-light)"}`,
            padding: "8px 14px",
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Todos · {contagens.todos || 0}
        </button>
        {OPCOES_CATEGORIA.map((c) => {
          const selecionado = categoriasSelecionadas.includes(c.key);
          return (
            <button
              key={c.key}
              onClick={() => alternarCategoria(c.key)}
              style={{
                background: selecionado ? "var(--color-primary)" : "#fff",
                color: selecionado ? "#fff" : "var(--color-gray)",
                border: `1px solid ${selecionado ? "var(--color-primary)" : "var(--color-gray-light)"}`,
                padding: "8px 14px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {c.label} · {contagens[c.key] || 0}
            </button>
          );
        })}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--color-dark)", marginLeft: "auto" }}>
          <input type="checkbox" checked={soMeus} onChange={(e) => setSoMeus(e.target.checked)} style={{ width: "auto" }} />
          Só os meus
        </label>
        <input
          type="text"
          placeholder="Filtrar por tag..."
          value={filtroTag}
          onChange={(e) => setFiltroTag(e.target.value)}
          style={{ maxWidth: 220, borderRadius: 20, fontSize: 13 }}
        />
      </div>

      <div className="page-shell" style={{ paddingTop: 14, paddingBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid var(--color-gray-light)" }}>
        <span style={{ fontSize: 12, color: "var(--color-gray)", fontWeight: 600 }}>Status:</span>
        {STATUS_OPCOES.map((s) => {
          const selecionado = statusSelecionados.includes(s);
          return (
            <button
              key={s}
              onClick={() => alternarStatus(s)}
              style={{
                background: selecionado ? "var(--color-dark)" : "#fff",
                color: selecionado ? "#fff" : "var(--color-gray)",
                border: `1px solid ${selecionado ? "var(--color-dark)" : "var(--color-gray-light)"}`,
                padding: "5px 12px",
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {s}
            </button>
          );
        })}
        {statusSelecionados.length > 0 && (
          <button
            onClick={() => setStatusSelecionados([])}
            style={{ background: "none", border: "none", color: "var(--color-primary)", fontSize: 12, fontWeight: 600 }}
          >
            Limpar
          </button>
        )}
      </div>

      <div className="page-shell" style={{ paddingTop: 28, paddingBottom: 60, display: "flex", flexDirection: "column", gap: 14, maxWidth: 1040 }}>
        {erroItens ? (
          <div className="empty-state" style={{ color: "var(--color-orange)" }}>
            Não deu pra carregar os itens: {erroItens}
          </div>
        ) : itensFiltrados.length === 0 ? (
          <div className="empty-state">Nenhum item aqui ainda.</div>
        ) : (
          itensFiltrados.map((item) => <ItemCard key={item.id} frenteId={frenteId} item={item} />)
        )}
      </div>
    </div>
  );
}
