import { Link } from "react-router-dom";
import { TIPO_POR_KEY } from "../lib/constants";
import { diasAte, formatarData } from "../lib/datas";
import { baseDoContrato, linkDoItem } from "../lib/itens";

// Lista de itens de um contrato (ou só os de um aditivo). Na tela do
// contrato, os itens de aditivo levam uma etiqueta com o aditivo.
export default function ItensDoContrato({ contratoId, itens, aditivos = [], mostrarAditivo = true }) {
  const base = baseDoContrato(contratoId);
  const nomeAditivo = (id) => (aditivos.find((a) => a.id === id)?.tipo || []).join(", ") || "aditivo";
  if (itens.length === 0) {
    return (
      <div className="lista-card empty-state" style={{ padding: 18 }}>
        Nenhum item ainda.
      </div>
    );
  }
  return (
    <div className="lista-card">
      {itens
        .slice()
        .sort((a, b) => Number(a.concluido) - Number(b.concluido) || (a.prazo?.seconds || Infinity) - (b.prazo?.seconds || Infinity))
        .map((item) => (
          <Link
            key={item.id}
            to={linkDoItem(base, item.id)}
            className="secao-lateral"
            style={{ display: "flex", justifyContent: "space-between", gap: 12, opacity: item.concluido ? 0.7 : 1 }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, textDecoration: item.concluido ? "line-through" : "none" }}>{item.titulo}</div>
              <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 2, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {mostrarAditivo && item.aditivoId && (
                  <span className="pill" style={{ background: "rgba(0,212,192,0.22)", color: "var(--color-dark)" }}>
                    Aditivo · {nomeAditivo(item.aditivoId)}
                  </span>
                )}
                <span>
                  {TIPO_POR_KEY[item.tipo]?.label}
                  {item.responsavelNome && ` · ${item.responsavelNome}`}
                  {item.concluido && " · concluído"}
                </span>
              </div>
            </div>
            {!item.concluido && item.prazo && (
              <span className={diasAte(item.prazo) < 0 ? "texto-alerta" : ""} style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                {formatarData(item.prazo)}
              </span>
            )}
          </Link>
        ))}
    </div>
  );
}
