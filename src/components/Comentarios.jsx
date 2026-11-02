import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { adicionarComentario, editarComentario, excluirComentario, watchComentarios } from "../lib/comentarios";

function formatarDataHora(valor) {
  if (!valor) return "";
  const data = valor.toDate ? valor.toDate() : new Date(valor);
  return (
    data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
    " às " +
    data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

// caminhoPai: array de segmentos até o documento comentado, ex:
// ["frentes", frenteId, "itens", itemId] ou ["contratos", contratoId, "aditivos", aditivoId].
export default function Comentarios({ caminhoPai }) {
  const { user } = useAuth();
  const [comentarios, setComentarios] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const chave = caminhoPai.join("/");

  useEffect(() => {
    const unsub = watchComentarios(caminhoPai, setComentarios);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  async function enviar(e) {
    e.preventDefault();
    const limpo = texto.trim();
    if (!limpo) return;
    setEnviando(true);
    await adicionarComentario(caminhoPai, {
      autorId: user.uid,
      autorNome: user.displayName || user.email,
      texto: limpo,
    });
    setTexto("");
    setEnviando(false);
  }

  return (
    <div style={{ marginTop: 28 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--color-gray)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 10,
        }}
      >
        Comentários {comentarios.length > 0 && `(${comentarios.length})`}
      </div>


      <form onSubmit={enviar} style={{ maxWidth: 600, display: "flex", gap: 8 }}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva um comentário..."
          style={{ flex: "1 1 auto" }}
        />
        <button type="submit" disabled={enviando || !texto.trim()} className="btn btn-primary">
          Comentar
        </button>
      </form>
      {comentarios.length > 1 && (
        <div style={{ fontSize: 12, color: "var(--color-gray)", margin: "12px 0 0" }}>Mais recentes primeiro</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10, maxWidth: 600 }}>
        {comentarios.map((c) => (
          <ComentarioItem key={c.id} caminhoPai={caminhoPai} comentario={c} ehAutor={c.autorId === user.uid} />
        ))}
      </div>
    </div>
  );
}

function ComentarioItem({ caminhoPai, comentario: c, ehAutor }) {
  const [editando, setEditando] = useState(false);
  const [textoEdicao, setTextoEdicao] = useState(c.texto);
  const [salvando, setSalvando] = useState(false);

  async function salvarEdicao(e) {
    e.preventDefault();
    const limpo = textoEdicao.trim();
    if (!limpo) return;
    setSalvando(true);
    await editarComentario(caminhoPai, c.id, limpo);
    setSalvando(false);
    setEditando(false);
  }

  async function excluir() {
    if (!window.confirm("Excluir este comentário?")) return;
    await excluirComentario(caminhoPai, c.id);
  }

  return (
    <div className="card" style={{ padding: "10px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{c.autorNome}</span>
        <span style={{ fontSize: 11, color: "var(--color-gray)" }}>
          {formatarDataHora(c.criadoEm)}
          {c.editadoEm && " · editado"}
        </span>
      </div>

      {editando ? (
        <form onSubmit={salvarEdicao}>
          <textarea
            value={textoEdicao}
            onChange={(e) => setTextoEdicao(e.target.value)}
            rows={2}
            style={{ resize: "vertical", marginBottom: 8 }}
            autoFocus
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={salvando || !textoEdicao.trim()} className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12 }}>
              Salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setTextoEdicao(c.texto);
                setEditando(false);
              }}
              className="btn btn-ghost"
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <>
          <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{c.texto}</div>
          {ehAutor && (
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button
                onClick={() => setEditando(true)}
                style={{ background: "none", border: "none", color: "var(--color-primary)", fontSize: 12, fontWeight: 600 }}
              >
                Editar
              </button>
              <button
                onClick={excluir}
                style={{ background: "none", border: "none", color: "var(--color-orange)", fontSize: 12, fontWeight: 600 }}
              >
                Excluir
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
