import { useState } from "react";
import { formatarHoras } from "../lib/previsao";
import { novoIdPasso } from "../lib/passos";

// Lista de passos de uma demanda: quem faz ("Eu", com horas, ou outra
// pessoa/área) e se já foi feito.
export default function PassosDaDemanda({ passos, onChange, podeEditar, esperaPassoId }) {
  const [titulo, setTitulo] = useState("");
  const [quem, setQuem] = useState("eu");
  const [nomeOutro, setNomeOutro] = useState("");
  const [horas, setHoras] = useState("");
  const feitos = passos.filter((p) => p.feito).length;
  const totalEu = passos.filter((p) => p.quem !== "outro").reduce((s, p) => s + (Number(p.horas) || 0), 0);

  function adicionar() {
    if (!titulo.trim()) return;
    const novo = { id: novoIdPasso(), titulo: titulo.trim(), quem, feito: false };
    if (quem === "outro") novo.nomeOutro = nomeOutro.trim() || "outra pessoa";
    else novo.horas = Number(String(horas).replace(",", ".")) || 0;
    onChange([...passos, novo]);
    setTitulo("");
    setHoras("");
  }

  return (
    <div>
      <span className="rotulo-form">
        Passos{passos.length ? ` · ${feitos} de ${passos.length} feitos` : ""}
        {totalEu > 0 ? ` · estimativa ${formatarHoras(totalEu)} (soma dos seus passos)` : ""}
      </span>
      {passos.length > 0 && (
        <div className="lista-card passos">
          {passos.map((p, i) => {
            const esperando = p.id === esperaPassoId;
            return (
              <div key={p.id} className={`passo ${esperando ? "esperando" : ""}`}>
                <button
                  type="button"
                  className={`passo-check ${p.feito ? "feito" : ""} ${esperando ? "esperando" : ""}`}
                  aria-pressed={p.feito}
                  aria-label={`${p.feito ? "Desmarcar" : "Marcar como feito"}: ${p.titulo}`}
                  disabled={!podeEditar}
                  onClick={() => onChange(passos.map((x, j) => (j === i ? { ...x, feito: !x.feito, feitoEm: !x.feito ? new Date() : null } : x)))}
                >
                  {p.feito ? "✓" : esperando ? "⏸" : ""}
                </button>
                <span style={{ minWidth: 0 }}>
                  <span className="passo-titulo" style={p.feito ? { textDecoration: "line-through", color: "var(--color-gray)" } : undefined}>
                    {p.titulo}
                  </span>
                </span>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span className={`passo-quem ${p.quem === "outro" ? "outro" : ""}`}>
                    {p.quem === "outro" ? p.nomeOutro || "outra pessoa" : `Eu${Number(p.horas) ? ` · ${formatarHoras(Number(p.horas))}` : ""}`}
                  </span>
                  {podeEditar && (
                    <button type="button" className="passo-remover" aria-label={`Remover passo: ${p.titulo}`} onClick={() => onChange(passos.filter((_, j) => j !== i))}>
                      ×
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {podeEditar && (
        <div className="passo-novo">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionar();
              }
            }}
            placeholder="Novo passo…"
            aria-label="Novo passo"
          />
          <select value={quem} onChange={(e) => setQuem(e.target.value)} aria-label="Quem faz o passo">
            <option value="eu">Eu</option>
            <option value="outro">Outra pessoa / área</option>
          </select>
          {quem === "outro" ? (
            <input value={nomeOutro} onChange={(e) => setNomeOutro(e.target.value)} placeholder="Quem? Ex: Financeiro" aria-label="Quem faz o passo" />
          ) : (
            <input type="number" min="0" step="0.5" value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="horas" aria-label="Horas do passo" className="passo-horas" />
          )}
          <button type="button" className="chip" onClick={adicionar} disabled={!titulo.trim()}>
            + Adicionar
          </button>
        </div>
      )}
      <div className="dica-form">
        Passo de outra pessoa ou área: quando a demanda chegar nele, ela fica parada aguardando retorno, e a próxima da fila segue.
      </div>
    </div>
  );
}
