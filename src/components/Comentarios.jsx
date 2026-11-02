import { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "./Avatar";
import { useAuth } from "../contexts/AuthContext";
import { adicionarComentario, editarComentario, excluirComentario, watchComentarios } from "../lib/comentarios";
import { PAPEIS } from "../lib/constants";
import { notificar } from "../lib/notificacoes";

function escaparRegex(t) {
  return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Quem foi mencionado: pessoas com acesso cujo "@Nome" aparece no texto.
function mencionados(texto, pessoas) {
  return pessoas.filter((p) => p.nome && texto.includes("@" + p.nome)).map((p) => p.id);
}

// Texto do comentário com as menções destacadas.
function TextoComMencoes({ texto, pessoas }) {
  const nomes = pessoas.map((p) => p.nome).filter(Boolean).sort((a, b) => b.length - a.length);
  if (nomes.length === 0) return texto;
  const re = new RegExp("(" + nomes.map((n) => "@" + escaparRegex(n)).join("|") + ")", "g");
  return texto.split(re).map((parte, i) =>
    i % 2 === 1 ? (
      <span key={i} className="mencao">
        {parte}
      </span>
    ) : (
      parte
    )
  );
}

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
// aviso: { alvo, link, interessados } para notificar (responsável, criador...).
// usuarios: mapa uid → perfil de quem tem acesso; papeis: mapa uid → papel.
export default function Comentarios({ caminhoPai, aviso, usuarios = {}, papeis = {} }) {
  const { user } = useAuth();
  const [comentarios, setComentarios] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState(null); // { inicio, termo } enquanto digita "@..."
  const [destaque, setDestaque] = useState(0);
  const campoRef = useRef(null);
  const chave = caminhoPai.join("/");

  const pessoas = useMemo(
    () =>
      Object.values(usuarios)
        .filter((u) => u?.nome && papeis[u.id])
        .map((u) => ({ id: u.id, nome: u.nome, foto: u.avatarUrl, papel: papeis[u.id] })),
    [usuarios, papeis]
  );
  const sugestoes = busca
    ? pessoas
        .filter((p) => p.id !== user.uid && p.nome.toLowerCase().includes(busca.termo.toLowerCase()))
        .slice(0, 6)
    : [];

  useEffect(() => {
    const unsub = watchComentarios(caminhoPai, setComentarios);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  function aoDigitar(e) {
    const valor = e.target.value;
    setTexto(valor);
    const cursor = e.target.selectionStart ?? valor.length;
    const antes = valor.slice(0, cursor);
    const m = antes.match(/(^|\s)@([^@\n]{0,30})$/);
    if (m && pessoas.length > 0) {
      setBusca({ inicio: cursor - m[2].length - 1, fim: cursor, termo: m[2] });
      setDestaque(0);
    } else {
      setBusca(null);
    }
  }

  function escolher(p) {
    const novo = texto.slice(0, busca.inicio) + "@" + p.nome + " " + texto.slice(busca.fim);
    setTexto(novo);
    setBusca(null);
    const pos = busca.inicio + p.nome.length + 2;
    requestAnimationFrame(() => {
      campoRef.current?.focus();
      campoRef.current?.setSelectionRange(pos, pos);
    });
  }

  function aoTeclar(e) {
    if (!busca || sugestoes.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setDestaque((d) => (d + 1) % sugestoes.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDestaque((d) => (d - 1 + sugestoes.length) % sugestoes.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      escolher(sugestoes[Math.min(destaque, sugestoes.length - 1)]);
    } else if (e.key === "Escape") {
      setBusca(null);
    }
  }

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
    setBusca(null);
    setEnviando(false);
    if (aviso) {
      // Quem foi mencionado recebe "mencionou você"; os demais interessados
      // (responsável, criador e quem já comentou), "comentou em".
      const marcados = mencionados(limpo, pessoas);
      const comAcesso = (uid) => !Object.keys(papeis).length || papeis[uid];
      const interessados = [...(aviso.interessados || []), ...comentarios.map((c) => c.autorId)].filter(
        (uid) => !marcados.includes(uid) && comAcesso(uid)
      );
      const base = { alvo: aviso.alvo, contexto: aviso.contexto, link: aviso.link, trecho: limpo };
      notificar(marcados, { ...base, tipo: "mencao" });
      notificar(interessados, { ...base, tipo: "comentario" });
    }
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


      <form onSubmit={enviar} style={{ maxWidth: 600, display: "flex", gap: 8, position: "relative" }}>
        <input
          ref={campoRef}
          value={texto}
          onChange={aoDigitar}
          onKeyDown={aoTeclar}
          onBlur={() => setTimeout(() => setBusca(null), 150)}
          placeholder={pessoas.length > 1 ? "Escreva um comentário... use @ para mencionar" : "Escreva um comentário..."}
          aria-label="Comentário"
          aria-autocomplete="list"
          aria-expanded={sugestoes.length > 0}
          style={{ flex: "1 1 auto" }}
        />
        {sugestoes.length > 0 && (
          <div className="mencao-lista" role="listbox" aria-label="Mencionar">
            {sugestoes.map((p, i) => (
              <button
                type="button"
                key={p.id}
                role="option"
                aria-selected={i === destaque}
                className={i === destaque ? "ativo" : ""}
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(p);
                }}
              >
                <Avatar nome={p.nome} url={p.foto} tamanho={28} decorativo />
                <span>
                  {p.nome} <span className="mencao-papel">· {PAPEIS[p.papel] || ""}</span>
                </span>
              </button>
            ))}
            <div className="mencao-dica">↑ ↓ para escolher · Enter para mencionar</div>
          </div>
        )}
        <button type="submit" disabled={enviando || !texto.trim()} className="btn btn-primary">
          Comentar
        </button>
      </form>
      {comentarios.length > 1 && (
        <div style={{ fontSize: 12, color: "var(--color-gray)", margin: "12px 0 0" }}>Mais recentes primeiro</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10, maxWidth: 600 }}>
        {comentarios.map((c) => (
          <ComentarioItem key={c.id} caminhoPai={caminhoPai} comentario={c} ehAutor={c.autorId === user.uid} pessoas={pessoas} />
        ))}
      </div>
    </div>
  );
}

function ComentarioItem({ caminhoPai, comentario: c, ehAutor, pessoas }) {
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
          <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>
            <TextoComMencoes texto={c.texto} pessoas={pessoas} />
          </div>
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
