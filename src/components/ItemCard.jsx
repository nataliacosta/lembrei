import { Link } from "react-router-dom";
import { TIPO_POR_KEY } from "../lib/constants";
import { estaAtrasado, formatarData } from "../lib/datas";

export default function ItemCard({ frenteId, item }) {
  const tipo = TIPO_POR_KEY[item.tipo];
  const atrasado = !item.concluido && estaAtrasado(item.prazo);

  return (
    <div
      className="card"
      style={{
        padding: "16px 20px",
        opacity: item.concluido ? 0.75 : 1,
        background: item.concluido ? "#FAFAFA" : "var(--color-white)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="pill" style={{ background: "rgba(0,153,146,0.12)", color: "var(--color-primary)" }}>
            {tipo?.label || item.tipo}
          </span>
          {item.concluido && (
            <span className="pill" style={{ background: "#F3F3F3", color: "var(--color-gray)" }}>
              Concluído
            </span>
          )}
          {!item.concluido && item.status && (
            <span className="pill" style={{ background: "rgba(0,212,192,0.2)", color: "var(--color-dark)" }}>
              {item.status}
            </span>
          )}
        </div>
        <Link to={`/frentes/${frenteId}/itens/${item.id}`} style={{ fontSize: 13, fontWeight: 600, flex: "0 0 auto" }}>
          Abrir
        </Link>
      </div>

      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          marginTop: 8,
          color: item.concluido ? "var(--color-gray)" : "var(--color-dark)",
          textDecoration: item.concluido ? "line-through" : "none",
        }}
      >
        {item.titulo}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 13, color: "var(--color-gray)" }}>
        {item.prazo && (
          <span style={{ color: atrasado ? "var(--color-orange)" : "var(--color-gray)", fontWeight: atrasado ? 700 : 400 }}>
            Prazo: {formatarData(item.prazo)}
          </span>
        )}
        {item.responsavelNome && <span>Responsável: {item.responsavelNome}</span>}
      </div>

      {item.tags?.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {item.tags.map((tag) => (
            <span key={tag} style={{ fontSize: 11, color: "var(--color-primary)" }}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      {item.lembrete?.ativo && !item.concluido && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 14px",
            background: "rgba(0,153,146,0.08)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--color-dark)",
          }}
        >
          <b>Próximo lembrete: {formatarData(item.lembrete.proximaVerificacao)}</b>
          {item.lembrete.mensagem ? ` — ${item.lembrete.mensagem}` : ""}
        </div>
      )}
    </div>
  );
}
