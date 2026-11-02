import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDados } from "../contexts/DadosContext";
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

// Procura nos itens abertos (título, descrição, tags, responsável), nas
// frentes e nos contratos (título, número, fornecedor). Tudo em memória.
export function useResultadosBusca(termo) {
  const { itensAbertos, frentes, contratos, mapaFrentes } = useDados();
  return useMemo(() => {
    const t = normalizar(termo.trim());
    if (t.length < 2) return [];
    const casa = (...campos) => campos.some((c) => normalizar(Array.isArray(c) ? c.join(" ") : c).includes(t));
    const itens = itensAbertos
      .filter((i) => casa(i.titulo, i.descricao, i.tags, i.responsavelNome, i.lembrete?.mensagem))
      .slice(0, 8)
      .map((i) => ({
        chave: `i:${i.id}`,
        link: `/frentes/${i.frenteId}/itens/${i.id}`,
        titulo: i.titulo,
        detalhe: [TIPO_POR_KEY[i.tipo]?.label, mapaFrentes[i.frenteId]?.nome, i.prazo && `prazo ${formatarData(i.prazo)}`]
          .filter(Boolean)
          .join(" · "),
      }));
    const fs = frentes
      .filter((f) => casa(f.nome, f.descricao))
      .slice(0, 4)
      .map((f) => ({ chave: `f:${f.id}`, link: `/frentes/${f.id}`, titulo: f.nome, detalhe: "Frente" }));
    const cs = contratos
      .filter((c) => casa(c.titulo, c.numero, c.fornecedor))
      .slice(0, 4)
      .map((c) => ({
        chave: `c:${c.id}`,
        link: `/contratos/${c.id}`,
        titulo: c.titulo,
        detalhe: ["Contrato", c.fornecedor, c.numero && `Nº ${c.numero}`].filter(Boolean).join(" · "),
      }));
    return [...itens, ...fs, ...cs];
  }, [termo, itensAbertos, frentes, contratos, mapaFrentes]);
}

export function ListaResultados({ termo, resultados, ativo, onEscolher }) {
  if (termo.trim().length < 2) {
    return <div className="empty-state" style={{ padding: 20 }}>Digite pelo menos 2 letras.</div>;
  }
  if (resultados.length === 0) {
    return <div className="empty-state" style={{ padding: 20 }}>Nada encontrado para “{termo}”.</div>;
  }
  return resultados.map((r, i) => (
    <Link
      key={r.chave}
      to={r.link}
      className={`busca-resultado ${i === ativo ? "ativo" : ""}`}
      onClick={onEscolher}
    >
      <div style={{ fontSize: 14, fontWeight: 600 }}>{r.titulo}</div>
      <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 2 }}>{r.detalhe}</div>
    </Link>
  ));
}

// Campo de busca do topo (computador). Atalho: "/".
export default function Busca() {
  const [termo, setTermo] = useState("");
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const inputRef = useRef(null);
  const caixaRef = useRef(null);
  const navigate = useNavigate();
  const resultados = useResultadosBusca(termo);

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
    inputRef.current?.blur();
  }

  function teclas(e) {
    if (e.key === "Escape") return fechar();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((a) => Math.min(a + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && resultados[ativo]) {
      e.preventDefault();
      navigate(resultados[ativo].link);
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
          setAberta(true);
        }}
        onFocus={() => setAberta(true)}
        onKeyDown={teclas}
        placeholder="Buscar itens, frentes e contratos…  ( / )"
        aria-label="Buscar itens, frentes e contratos"
      />
      {aberta && termo && (
        <div className="busca-resultados" role="listbox">
          <ListaResultados termo={termo} resultados={resultados} ativo={ativo} onEscolher={fechar} />
        </div>
      )}
    </div>
  );
}
