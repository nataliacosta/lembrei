import { useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { formatarData } from "../lib/datas";
import { LIMITE_BYTES, baixarDocumento, baixarTodos, enviarDocumento, excluirDocumento, extensao, formatarTamanho } from "../lib/documentos";

const CORES = {
  PDF: ["#fde7e2", "#b3261e"],
  DOC: ["#e3ecfb", "#1f4fa8"],
  DOCX: ["#e3ecfb", "#1f4fa8"],
  XLS: ["#e2f4e8", "#1d6b3a"],
  XLSX: ["#e2f4e8", "#1d6b3a"],
  CSV: ["#e2f4e8", "#1d6b3a"],
  PPT: ["#fdeee0", "#b8520c"],
  PPTX: ["#fdeee0", "#b8520c"],
};

function IconeArquivo({ nome, tamanho = 36 }) {
  const ext = extensao(nome);
  const [bg, fg] = CORES[ext] || ["#eef1f1", "#5f6b6a"];
  return (
    <span className="doc-icone" style={{ width: tamanho, height: tamanho, background: bg, color: fg }} aria-hidden="true">
      {ext.slice(0, 4)}
    </span>
  );
}

// Seção "Documentos" do contrato ou do aditivo.
// documentos: já filtrados (do contrato ou do aditivo).
export default function Documentos({ contratoId, aditivoId = null, documentos, podeEditar, titulo = "Documentos", nomeZip, Cabecalho }) {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const [aberto, setAberto] = useState(false);
  const [escolhidos, setEscolhidos] = useState([]);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(null); // { atual, total, pct }
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(""); // id do documento baixando/excluindo, ou "zip"

  function adicionar(lista) {
    const novos = Array.from(lista || []);
    const grandes = novos.filter((f) => f.size > LIMITE_BYTES);
    setErro(grandes.length ? `${grandes.map((f) => f.name).join(", ")}: acima de 25 MB, não dá para enviar.` : "");
    setEscolhidos((atual) => [...atual, ...novos.filter((f) => f.size <= LIMITE_BYTES)]);
    setAberto(true);
  }

  function fechar() {
    setAberto(false);
    setEscolhidos([]);
    setErro("");
  }

  async function enviar() {
    setErro("");
    const total = escolhidos.length;
    const falhas = [];
    for (let i = 0; i < total; i++) {
      setEnviando({ atual: i + 1, total, pct: 0 });
      try {
        await enviarDocumento(contratoId, { arquivo: escolhidos[i], aditivoId, user, onProgresso: (pct) => setEnviando({ atual: i + 1, total, pct }) });
      } catch (e) {
        console.error(e);
        falhas.push(escolhidos[i]);
      }
    }
    setEnviando(null);
    if (falhas.length) {
      setEscolhidos(falhas);
      setErro(`Não deu para enviar ${falhas.map((f) => f.name).join(", ")}. Tente de novo.`);
    } else {
      fechar();
    }
  }

  async function baixar(d) {
    setOcupado(d.id);
    try {
      await baixarDocumento(d);
    } catch (e) {
      console.error(e);
      window.alert("Não deu para baixar o arquivo. Tente de novo.");
    } finally {
      setOcupado("");
    }
  }

  async function baixarZip() {
    setOcupado("zip");
    try {
      await baixarTodos(documentos, nomeZip || titulo);
    } catch (e) {
      console.error(e);
      window.alert("Não deu para baixar os arquivos. Tente de novo.");
    } finally {
      setOcupado("");
    }
  }

  async function excluir(d) {
    if (!window.confirm(`Excluir "${d.nome}"? O arquivo some para todos que têm acesso.`)) return;
    setOcupado(d.id);
    try {
      await excluirDocumento(contratoId, d);
    } catch (e) {
      console.error(e);
      window.alert("Não deu para excluir o arquivo. Tente de novo.");
    } finally {
      setOcupado("");
    }
  }

  const acoes = (
    <span style={{ display: "flex", gap: 16, flexWrap: "nowrap", justifyContent: "flex-end", textTransform: "none", letterSpacing: 0, whiteSpace: "nowrap" }}>
      {documentos.length > 1 && (
        <button type="button" className="link-acao" onClick={baixarZip} disabled={ocupado === "zip"}>
          {ocupado === "zip" ? "Preparando…" : (
            <>
              Baixar todos<span className="doc-longo"> (.zip)</span>
            </>
          )}
        </button>
      )}
      {podeEditar && (
        <button type="button" className="link-acao" onClick={() => {
            setAberto(true);
            inputRef.current?.click();
          }}>
          + Adicionar<span className="doc-longo"> arquivos</span>
        </button>
      )}
    </span>
  );

  return (
    <section aria-label={titulo}>
      <Cabecalho titulo={`${titulo} · ${documentos.length}`} acao={acoes} />
      {documentos.length > 0 ? (
        <div className="lista-card">
          {documentos.map((d) => (
            <div key={d.id} className="secao-lateral doc-linha">
              <IconeArquivo nome={d.nome} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="doc-nome" title={d.nome}>{d.nome}</div>
                <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 2 }}>
                  {formatarTamanho(d.tamanho)}
                  {d.enviadoPorNome && ` · ${d.enviadoPorNome}`}
                  {d.enviadoEm && ` em ${formatarData(d.enviadoEm)}`}
                </div>
              </div>
              <div className="doc-acoes">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => baixar(d)} disabled={ocupado === d.id} aria-label={`Baixar ${d.nome}`} title="Baixar">
                  <span className="doc-rotulo">Baixar</span>
                  <span className="doc-seta" aria-hidden="true">↓</span>
                </button>
                {podeEditar && (
                  <button type="button" className="btn btn-ghost btn-sm doc-excluir" onClick={() => excluir(d)} disabled={ocupado === d.id} aria-label={`Excluir ${d.nome}`}>
                    <span className="doc-rotulo">Excluir</span>
                    <span className="doc-seta" aria-hidden="true">×</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !aberto && <div style={{ fontSize: 13, color: "var(--color-gray)" }}>Nenhum documento ainda.</div>
      )}

      {podeEditar && (
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            adicionar(e.target.files);
            e.target.value = "";
          }}
        />
      )}

      {podeEditar && aberto && (
        <div className="lista-card" style={{ padding: 16, marginTop: 10 }}>
          <div
            className={`doc-soltar${arrastando ? " ativo" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              adicionar(e.dataTransfer.files);
            }}
          >
            Arraste os arquivos aqui ou{" "}
            <button type="button" className="link-acao" onClick={() => inputRef.current?.click()}>
              escolha no computador
            </button>
            <div style={{ fontSize: 12, marginTop: 2 }}>Qualquer tipo de arquivo · até 25 MB cada</div>
          </div>

          {escolhidos.map((f, i) => (
            <div key={`${f.name}-${i}`} style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
              <IconeArquivo nome={f.name} tamanho={32} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                <div className="doc-nome" style={{ fontSize: 13 }} title={f.name}>{f.name}</div>
                <div style={{ fontSize: 12, color: "var(--color-gray)" }}>{formatarTamanho(f.size)}</div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label={`Tirar ${f.name}`}
                onClick={() => setEscolhidos(escolhidos.filter((_, j) => j !== i))}
                disabled={!!enviando}
              >
                ×
              </button>
            </div>
          ))}

          {erro && <div className="texto-alerta" style={{ fontSize: 12, marginTop: 10 }}>{erro}</div>}
          {enviando && (
            <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 10 }}>
              Enviando {enviando.atual} de {enviando.total}… {Math.round(enviando.pct * 100)}%
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={fechar} disabled={!!enviando}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={enviar} disabled={!escolhidos.length || !!enviando}>
              {escolhidos.length ? `Enviar ${escolhidos.length} arquivo${escolhidos.length > 1 ? "s" : ""}` : "Enviar"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
