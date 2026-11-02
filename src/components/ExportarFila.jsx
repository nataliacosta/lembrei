import { useState } from "react";
import { formatarData, inicioDoDia, paraDate } from "../lib/datas";
import { formatarEstimativa, formatarHoras, horasRestantes } from "../lib/previsao";

function hojePorExtenso() {
  return new Date().toLocaleDateString("pt-BR");
}

function linhasDaFila(previsao, { solicitante, prazo, comparacao }) {
  const fimAntes = comparacao ? Object.fromEntries(comparacao.previsaoSalva.itens.map((r) => [r.demanda.id, r.fim])) : {};
  return previsao.itens.map((r, i) => {
    const d = r.demanda;
    const andamento = i === 0;
    const pausada = !andamento && Number(d.horasFeitas) > 0;
    const prazoPedido = d.prazoPedido ? inicioDoDia(paraDate(d.prazoPedido)) : null;
    const estoura = prazoPedido && r.fim > prazoPedido;
    const estado = andamento ? "em andamento" : pausada ? `pausada, restam ${formatarHoras(horasRestantes(d))}` : formatarEstimativa(d);
    const antes = fimAntes[d.id];
    return {
      posicao: i + 1,
      titulo: d.titulo,
      solicitante: d.solicitante || "",
      estado,
      pronta: formatarData(r.fim),
      prontaAntes: antes && antes.getTime() !== r.fim.getTime() ? formatarData(antes) : "",
      prazo: prazoPedido ? formatarData(prazoPedido) : "",
      estoura,
      texto:
        `${i + 1}. ${d.titulo}` +
        (solicitante && d.solicitante ? ` · ${d.solicitante}` : "") +
        ` — ${estado} — pronta ${formatarData(r.fim)}` +
        (antes && antes.getTime() !== r.fim.getTime() ? ` (antes: ${formatarData(antes)})` : "") +
        (prazo && prazoPedido ? ` (pedido: ${formatarData(prazoPedido)})${estoura ? " ⚠" : ""}` : ""),
    };
  });
}

function baixar(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escaparHtml(t) {
  return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

export default function ExportarFila({ fila, previsao, comparacao, onFechar }) {
  const [formato, setFormato] = useState("texto");
  const [solicitante, setSolicitante] = useState(true);
  const [prazo, setPrazo] = useState(true);
  const [comparar, setComparar] = useState(Boolean(comparacao));
  const [copiado, setCopiado] = useState(false);

  const linhas = linhasDaFila(previsao, { solicitante, prazo, comparacao: comparar ? comparacao : null });
  const fim = previsao.itens.length ? formatarData(previsao.itens[previsao.itens.length - 1].fim) : "";
  const titulo = `Fila de demandas — ${fila.donoNome || ""} (${hojePorExtenso()})`;
  const cabecalho = `${titulo}\nCapacidade: ${formatarHoras(fila.capacidadeHoras || 6)} por dia útil${comparar && comparacao ? "\nProposta de nova ordem (comparada com a atual)" : ""}`;
  const texto = `${cabecalho}\n\n${linhas.map((l) => l.texto).join("\n")}\n\nFila zerada em ${fim} se a prioridade não mudar.`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt("Copie o texto abaixo:", texto);
    }
  }

  function exportarCsv() {
    const col = ["Posição", "Demanda", ...(solicitante ? ["Quem pediu"] : []), "Situação", "Pronta em", ...(comparar && comparacao ? ["Antes"] : []), ...(prazo ? ["Prazo pedido"] : [])];
    const csv = [col, ...linhas.map((l) => [l.posicao, l.titulo, ...(solicitante ? [l.solicitante] : []), l.estado, l.pronta, ...(comparar && comparacao ? [l.prontaAntes] : []), ...(prazo ? [l.prazo] : [])])]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    baixar(`fila-de-demandas-${new Date().toISOString().slice(0, 10)}.csv`, "﻿" + csv, "text/csv;charset=utf-8");
  }

  function exportarPdf() {
    const janela = window.open("", "_blank");
    if (!janela) {
      window.alert("O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.");
      return;
    }
    const linhasHtml = linhas
      .map(
        (l) =>
          `<tr><td>${l.posicao}</td><td><b>${escaparHtml(l.titulo)}</b>${solicitante && l.solicitante ? `<br><span>${escaparHtml(l.solicitante)}</span>` : ""}</td><td>${escaparHtml(l.estado)}</td><td><b>${l.pronta}</b>${comparar && l.prontaAntes ? `<br><span>antes: ${l.prontaAntes}</span>` : ""}</td>${prazo ? `<td class="${l.estoura ? "alerta" : ""}">${l.prazo || "—"}</td>` : ""}</tr>`
      )
      .join("");
    janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escaparHtml(titulo)}</title>
<style>body{font-family:Inter,system-ui,sans-serif;color:#00332d;margin:32px}h1{font-size:20px;margin:0 0 4px}p{color:#5f6b6a;margin:0 0 16px;font-size:13px}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:8px;border-bottom:1px solid #e3e3e3;vertical-align:top}th{font-size:11px;text-transform:uppercase;color:#5f6b6a}
td span{color:#5f6b6a;font-size:12px}.alerta{color:#b8520c;font-weight:700}</style></head><body>
<h1>${escaparHtml(titulo)}</h1><p>${escaparHtml(cabecalho.split("\n").slice(1).join(" · "))}</p>
<table><thead><tr><th>#</th><th>Demanda</th><th>Situação</th><th>Pronta em</th>${prazo ? "<th>Prazo pedido</th>" : ""}</tr></thead><tbody>${linhasHtml}</tbody></table>
<p style="margin-top:16px">Fila zerada em ${fim} se a prioridade não mudar.</p></body></html>`);
    janela.document.close();
    janela.focus();
    janela.print();
  }

  const mailto = `mailto:?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(texto)}`;

  return (
    <div
      className="modal-overlay"
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,51,45,0.55)", display: "flex", justifyContent: "center", alignItems: "flex-start", overflowY: "auto" }}
      onClick={(e) => e.target === e.currentTarget && onFechar()}
    >
      <div className="card" role="dialog" aria-label="Exportar fila" style={{ width: "100%", maxWidth: 680, boxShadow: "0 20px 60px rgba(0,51,45,0.3)", overflow: "hidden" }}>
        <div className="modal-body-pad" style={{ paddingTop: 20, paddingBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Exportar fila</h2>
          <button type="button" onClick={onFechar} style={{ fontSize: 22, color: "var(--color-gray)", background: "none", border: "none", width: 44, height: 44 }} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="modal-body-pad" style={{ paddingBottom: 8 }}>
          <div className="chips-row" role="group" aria-label="Formato">
            {[
              ["texto", "Texto (e-mail, WhatsApp)"],
              ["pdf", "PDF"],
              ["csv", "Planilha (CSV)"],
            ].map(([k, l]) => (
              <button key={k} type="button" className="chip" aria-pressed={formato === k} onClick={() => setFormato(k)}>
                {l}
              </button>
            ))}
          </div>
          <div className="chips-row" style={{ marginTop: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, fontSize: 13 }}>
              <input type="checkbox" checked={solicitante} onChange={(e) => setSolicitante(e.target.checked)} style={{ width: "auto" }} />
              Incluir quem pediu
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, fontSize: 13 }}>
              <input type="checkbox" checked={prazo} onChange={(e) => setPrazo(e.target.checked)} style={{ width: "auto" }} />
              Incluir prazo pedido
            </label>
            {comparacao && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, fontSize: 13 }}>
                <input type="checkbox" checked={comparar} onChange={(e) => setComparar(e.target.checked)} style={{ width: "auto" }} />
                Comparar com a ordem atual
              </label>
            )}
          </div>
          <pre
            style={{
              margin: "16px 0 0",
              padding: "14px 16px",
              background: "var(--color-bg-soft)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              fontFamily: "inherit",
              fontSize: 13,
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {texto}
          </pre>
        </div>
        <div className="modal-body-pad" style={{ paddingTop: 16, paddingBottom: 16, borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          {formato === "texto" && (
            <>
              <a href={mailto} className="btn btn-ghost">
                Enviar por e-mail
              </a>
              <button type="button" className="btn btn-primary" onClick={copiar}>
                {copiado ? "Copiado!" : "Copiar texto"}
              </button>
            </>
          )}
          {formato === "pdf" && (
            <button type="button" className="btn btn-primary" onClick={exportarPdf}>
              Gerar PDF
            </button>
          )}
          {formato === "csv" && (
            <button type="button" className="btn btn-primary" onClick={exportarCsv}>
              Baixar planilha
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
