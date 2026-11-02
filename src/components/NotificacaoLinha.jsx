import { Link } from "react-router-dom";
import Avatar from "./Avatar";
import { localDe, marcarLidas, partesDoTexto, quandoFoi } from "../lib/notificacoes";

// Pequeno selo no canto do avatar, indicando o tipo de aviso.
const SELOS = {
  comentario: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  mencao: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
    </>
  ),
  atribuido: (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 11l2 2 4-4" />
    </>
  ),
  aditivo: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M12 18v-6M9 15h6" />
    </>
  ),
  demanda: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  convite: (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M19 8v6M16 11h6" />
    </>
  ),
};

function selo(tipo) {
  if (tipo.startsWith("demanda") || tipo === "fila_repriorizada") return SELOS.demanda;
  if (tipo.startsWith("convite")) return SELOS.convite;
  return SELOS[tipo] || SELOS.comentario;
}

export default function NotificacaoLinha({ n, onAbrir, compacta = false }) {
  const local = localDe(n);
  return (
    <Link
      to={n.link || "/dashboard"}
      className={`notif-linha${n.lida ? "" : " nao-lida"}${compacta ? " compacta" : ""}`}
      onClick={() => {
        if (!n.lida) marcarLidas([n.id]).catch((e) => console.error(e));
        onAbrir?.();
      }}
    >
      <span className="notif-avatar">
        <Avatar nome={n.autorNome} url={n.autorFoto} tamanho={36} decorativo />
        <span className="notif-selo" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {selo(n.tipo)}
          </svg>
        </span>
      </span>
      <span className="notif-corpo">
        <span className="notif-texto">
          {partesDoTexto(n).map(([t, negrito], i) => (negrito ? <b key={i}>{t}</b> : <span key={i}>{t}</span>))}
        </span>
        {n.trecho && (
          <span className="notif-trecho">
            {["comentario", "mencao"].includes(n.tipo) ? `“${n.trecho}”` : n.trecho}
          </span>
        )}
        <span className="notif-meta">
          {local ? `${local} · ` : ""}
          {quandoFoi(n.criadoEm)}
        </span>
      </span>
      {!n.lida && <span className="notif-ponto" aria-label="não lida" />}
    </Link>
  );
}
