import { Link } from "react-router-dom";
import { TIPO_POR_KEY } from "../lib/constants";
import { diasAte, formatarDataRelativa } from "../lib/datas";
import { marcarConcluido, marcarPreparo } from "../lib/firestore";
import { frequenciaCurta } from "../lib/reunioes";
import { IconeCalendario, IconeSino } from "./Icones";
import LembreteAcoes from "./LembreteAcoes";

// Uma linha da lista de coisas a fazer. `entrada` vem de lib/agenda.js:
// { tipo: "prazo" | "lembrete" | "sem-data", item, data }.
function dataComHora(data, comHora) {
  const texto = formatarDataRelativa(data);
  if (!comHora) return texto;
  const hora = data.toTimeString().slice(0, 5);
  return hora === "00:00" ? texto : `${texto} ${hora}`;
}

export default function AgendaRow({ entrada, frente, podeEditar, mostrarFrente = true }) {
  if (entrada.tipo === "reuniao" || entrada.tipo === "preparo") {
    return <ReuniaoRow entrada={entrada} frente={frente} podeEditar={podeEditar} mostrarFrente={mostrarFrente} />;
  }
  return <ItemRow entrada={entrada} frente={frente} podeEditar={podeEditar} mostrarFrente={mostrarFrente} />;
}

// Linha de uma reunião (no dia dela) ou de um preparo pendente para ela.
function ReuniaoRow({ entrada, frente, podeEditar, mostrarFrente }) {
  const { item, tipo, data, preparo } = entrada;
  const ehPreparo = tipo === "preparo";
  const ocorrencia = entrada.ocorrencia || data;
  const link = `/frentes/${item.frenteId}/itens/${item.id}`;
  const preparos = entrada.preparos || [];
  const feitos = preparos.filter((p) => p.feito).length;
  const responsavel = ehPreparo ? preparo.responsavelNome || item.responsavelNome || "—" : item.responsavelNome || "—";

  async function concluirPreparo() {
    await marcarPreparo(item.frenteId, item.id, preparo.chave, preparo.id, true);
  }

  return (
    <div className={`agenda-row ${ehPreparo ? "" : "reuniao"}`}>
      {ehPreparo && podeEditar ? (
        <button
          type="button"
          className="check-btn"
          onClick={concluirPreparo}
          aria-label={`Marcar preparo como feito: ${preparo.titulo}`}
          title="Marcar preparo como feito"
        >
          <span className="ring" />
        </button>
      ) : (
        <span className="icone-linha" style={{ color: "#1f4f8f" }}>
          {ehPreparo ? null : <IconeCalendario size={18} />}
        </span>
      )}

      <Link to={link} style={{ minWidth: 0, color: "inherit" }}>
        <div className="titulo">{ehPreparo ? preparo.titulo : item.titulo}</div>
        <div className="meta">
          {ehPreparo ? (
            <>
              <span className="pill pill-preparo">Preparo</span>
              <span>
                para {item.titulo}, {dataComHora(ocorrencia, true).toLowerCase()}
              </span>
            </>
          ) : (
            <>
              <span className="pill pill-reuniao">Reunião</span>
              <span>
                {frequenciaCurta(item.reuniao)}
                {preparos.length > 0 &&
                  ` · ${feitos} de ${preparos.length} ${preparos.length === 1 ? "preparo feito" : "preparos feitos"}`}
              </span>
            </>
          )}
          {mostrarFrente && frente && <span className="so-mobile">· {frente.nome}</span>}
        </div>
      </Link>

      <span className="col" title={frente?.nome}>
        {mostrarFrente ? frente?.nome || "—" : ""}
      </span>
      <span className="col" title={responsavel}>
        {responsavel}
      </span>

      <span className="data">{dataComHora(ehPreparo ? data : ocorrencia, !ehPreparo)}</span>
    </div>
  );
}

function ItemRow({ entrada, frente, podeEditar, mostrarFrente }) {
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
