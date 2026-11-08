import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { chaveCentro, normalizarNome, resolverCentro } from "../lib/alocacoes";
import { salvarCentroFora } from "../lib/centros";

function textoDaOpcao(o) {
  return `${o.tipo} ${o.codigo}${o.descricao ? ` · ${o.descricao}` : ""}`;
}

// Campo com busca para escolher o CC/ODI (lista única: do orçamento e fora dele).
// Dá para cadastrar um novo ali mesmo, sem sair da tela.
export default function SeletorCentro({ valor, opcoes, porId = {}, onEscolher, rotulo = "CC ou ODI", desabilitado }) {
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [ativo, setAtivo] = useState(0);
  const [cadastrando, setCadastrando] = useState(null); // { tipo, codigo, descricao }
  const [erro, setErro] = useState("");
  const caixaRef = useRef(null);
  const idLista = useId();

  // O valor pode ser a chave nova ("ODI:123") ou o id antigo do CC/ODI do contrato.
  const atual = valor ? porId[valor] || (() => {
    const r = resolverCentro({ centroId: valor }, porId);
    return r ? { ...r, id: chaveCentro(r.tipo, r.codigo), descricao: "" } : null;
  })() : null;

  const filtradas = useMemo(() => {
    const t = normalizarNome(termo);
    const lista = !t ? opcoes : opcoes.filter((o) => [o.codigo, o.descricao, o.linha, o.projeto, o.fornecedor, o.responsavel].some((x) => normalizarNome(x).includes(t)));
    return lista.slice(0, 40);
  }, [opcoes, termo]);

  useEffect(() => {
    if (!aberto) return;
    function fora(e) {
      if (caixaRef.current && !caixaRef.current.contains(e.target)) {
        setAberto(false);
        setCadastrando(null);
      }
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  function escolher(o) {
    onEscolher({ centroId: o.id, tipo: o.tipo, codigo: o.codigo });
    setAberto(false);
    setTermo("");
    setCadastrando(null);
  }

  async function salvarNovo() {
    setErro("");
    const codigo = String(cadastrando.codigo || "").trim();
    if (!codigo) return setErro("Escreva o código.");
    const id = chaveCentro(cadastrando.tipo, codigo);
    if (porId[id]) return escolher(porId[id]);
    try {
      await salvarCentroFora(user.uid, null, { ...cadastrando, codigo });
      escolher({ id, tipo: cadastrando.tipo, codigo });
    } catch (e) {
      console.error(e);
      setErro("Não deu pra cadastrar. Tente de novo.");
    }
  }

  function teclas(e) {
    if (!aberto && (e.key === "ArrowDown" || e.key === "Enter")) {
      setAberto(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((a) => Math.min(a + 1, filtradas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtradas[ativo]) escolher(filtradas[ativo]);
    } else if (e.key === "Escape") {
      setAberto(false);
      setCadastrando(null);
    }
  }

  const grupos = [
    ["orcamento", "Do orçamento"],
    ["fora", "Fora do orçamento"],
  ];

  return (
    <div className="seletor-centro" ref={caixaRef}>
      <input
        role="combobox"
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-autocomplete="list"
        disabled={desabilitado}
        value={aberto ? termo : atual ? textoDaOpcao(atual) : ""}
        placeholder={aberto ? "Digite código, linha ou descrição" : "Buscar CC/ODI…"}
        onFocus={() => {
          setAberto(true);
          setTermo("");
          setAtivo(0);
        }}
        onChange={(e) => {
          setTermo(e.target.value);
          setAtivo(0);
          setAberto(true);
        }}
        onKeyDown={teclas}
      />
      {aberto && (
        <div className="seletor-centro-lista" id={idLista} role="listbox" aria-label={`Opções de ${rotulo}`}>
          {cadastrando ? (
            <div style={{ padding: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Novo CC ou ODI (fora do orçamento)</div>
              <div className="chips-row" role="group" aria-label="Tipo" style={{ marginBottom: 8 }}>
                {[
                  ["CC", "Centro de custo"],
                  ["ODI", "ODI"],
                ].map(([k, l]) => (
                  <button key={k} type="button" className="chip" aria-pressed={cadastrando.tipo === k} onClick={() => setCadastrando({ ...cadastrando, tipo: k })}>
                    {l}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input value={cadastrando.codigo} onChange={(e) => setCadastrando({ ...cadastrando, codigo: e.target.value })} aria-label="Código" placeholder="Código" style={{ flex: "0 1 140px" }} />
                <input value={cadastrando.descricao} onChange={(e) => setCadastrando({ ...cadastrando, descricao: e.target.value })} aria-label="Descrição" placeholder="Descrição (opcional)" style={{ flex: "1 1 180px" }} />
              </div>
              {erro && (
                <div className="texto-alerta" role="alert" style={{ fontSize: 12, marginTop: 6 }}>
                  {erro}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCadastrando(null)}>
                  Voltar
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={salvarNovo}>
                  Cadastrar e usar
                </button>
              </div>
            </div>
          ) : (
            <>
              {filtradas.length === 0 && <div className="seletor-centro-vazio">Nada encontrado{termo ? ` para “${termo}”` : ""}.</div>}
              {grupos.map(([origem, titulo]) => {
                const doGrupo = filtradas.filter((o) => o.origem === origem);
                if (!doGrupo.length) return null;
                return (
                  <div key={origem}>
                    <div className="seletor-centro-grupo">
                      {titulo}
                      {origem === "orcamento" && doGrupo[0]?.ano ? ` ${doGrupo[0].ano}` : ""}
                    </div>
                    {doGrupo.map((o) => {
                      const i = filtradas.indexOf(o);
                      return (
                        <div
                          key={o.id}
                          role="option"
                          aria-selected={i === ativo}
                          className={`seletor-centro-opcao ${i === ativo ? "ativa" : ""}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setAtivo(i)}
                          onClick={() => escolher(o)}
                        >
                          <span className="centro-tag">
                            <span className={`tp ${o.tipo === "ODI" ? "odi" : ""}`}>{o.tipo}</span>
                            {o.codigo}
                          </span>
                          <span className="seletor-centro-desc">{[o.descricao, o.fornecedor && o.origem === "orcamento" ? o.fornecedor : null].filter(Boolean).join(" · ")}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <button
                type="button"
                className="seletor-centro-novo"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setCadastrando({ tipo: /^\d+$/.test(termo.trim()) ? "ODI" : "CC", codigo: termo.trim(), descricao: "" })}
              >
                + Cadastrar {termo.trim() ? `“${termo.trim()}”` : "um"} como novo CC ou ODI
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
