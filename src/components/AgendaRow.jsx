import { Link } from "react-router-dom";
import { TIPO_POR_KEY } from "../lib/constants";
import { diasAte, formatarDataRelativa } from "../lib/datas";
import { marcarConcluido } from "../lib/firestore";
import { IconeSino } from "./Icones";
import LembreteAcoes from "./LembreteAcoes";

// Uma linha da lista de coisas a fazer. `entrada` vem de lib/agenda.js:
// { tipo: "prazo" | "lembrete" | "sem-data", item, data }.
export default function AgendaRow({ entrada, frente, podeEditar, mostrarFrente = true }) {
  const { item, tipo, data } = entrada;
  const dias = data ? diasAte(data) : null;
  const atrasado = dias !== null && dias < 0;
  const ehLembrete = tipo === "lembrete";
  const mostrarAcoes = ehLembrete && podeEditar && dias !== null && dias <= 0;
  const link = `/frentes/${item.frenteId}/itens/${item.id}`;
  const tipoInfo = TIPO_POR_KEY[item.tipo];
  const responsavel = item.responsavelNome || "—";
  const textoLembrete =
    item.lembrete?.ativo && item.lembrete.proximaVerificacao
      ? `Lembrete ${formatarDataRelativa(item.lembrete.proximaVerificacao).toLowerCase()}`
      : "";

  async function concluir() {
    await marcarConcluido(item.frenteId, item.id, true);
  }

  const linhaClasse = ["agenda-row", ehLembrete ? "lembrete" : "", mostrarAcoes ? "com-acoes" : ""].join(" ");

  return (
    <div className={linhaClasse}>
      {ehLembrete ? (
        <span className={`icone-linha ${atrasado ? "texto-alerta" : ""}`} style={{ color: atrasado ? undefined : "var(--color-primary)" }}>
          <IconeSino size={18} />
        </span>
      ) : podeEditar ? (
        <button
          type="button"
          className={`check-btn ${atrasado ? "alerta" : ""}`}
          onClick={concluir}
          aria-label={`Marcar como concluído: ${item.titulo}`}
          title="Marcar como concluído"
        >
          <span className="ring" />
        </button>
      ) : (
        <span className="icone-linha" />
      )}

      <Link to={link} style={{ minWidth: 0, color: "inherit" }}>
        <div className="titulo">{ehLembrete ? item.lembrete.mensagem || item.titulo : item.titulo}</div>
        <div className="meta">
          {ehLembrete ? (
            <span>
              Lembrete{item.lembrete.mensagem ? ` de “${item.titulo}”` : ""}
              <span className="so-mobile">{mostrarFrente && frente ? ` · ${frente.nome}` : ""}</span>
            </span>
          ) : (
            <>
              <span className="pill pill-tipo">{tipoInfo?.label || item.tipo}</span>
              {item.status && <span>{item.status}</span>}
              {mostrarFrente && frente && <span className="so-mobile">· {frente.nome}</span>}
            </>
          )}
        </div>
      </Link>

      {mostrarAcoes ? (
        <LembreteAcoes item={item} compacto />
      ) : (
        <>
          <span className="col" title={mostrarFrente ? frente?.nome : textoLembrete}>
            {mostrarFrente ? frente?.nome || "—" : textoLembrete || ""}
          </span>
          <span className="col" title={responsavel}>
            {responsavel}
          </span>
        </>
      )}

      <span className={`data ${atrasado ? "texto-alerta" : ""}`} style={dias === null ? { color: "var(--color-gray)" } : undefined}>
        {data ? formatarDataRelativa(data) : "—"}
      </span>
    </div>
  );
}
