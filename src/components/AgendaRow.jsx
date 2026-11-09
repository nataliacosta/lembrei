import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { marcarMedicaoFeita } from "../lib/contratos";
import { marcarLancada } from "../lib/medicoesContrato";
import { linkDoItem } from "../lib/itens";
import { atualizarDemanda } from "../lib/filas";
import { notificarFila } from "../lib/notificacoes";
import { diasDesde, retornoChegou } from "../lib/passos";
import { somarDias, inicioDoDia } from "../lib/datas";
import { TIPO_POR_KEY } from "../lib/constants";
import { diasAte, formatarDataRelativa } from "../lib/datas";
import { marcarConcluido, marcarPreparo } from "../lib/firestore";
import { frequenciaCurta } from "../lib/reunioes";
import { IconeCalendario, IconeSino } from "./Icones";
import { nomesDoContrato } from "../lib/medicoesDoMes";
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
  if (entrada.tipo === "medicao") return <MedicaoRow entrada={entrada} />;
  if (entrada.tipo === "cobranca") return <CobrancaRow entrada={entrada} />;
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
  const link = linkDoItem(item.frenteId, item.id);
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
                {item.reuniao?.sala && ` · ${item.reuniao.sala}`}
                {preparos.length > 0 &&
                  ` · ${feitos} de ${preparos.length} ${preparos.length === 1 ? "preparo feito" : "preparos feitos"}`}
              </span>
            </>
          )}
          {mostrarFrente && frente && <span className="so-mobile">· {frente.nome}</span>}
          <span className="meta-compacta">· {[mostrarFrente ? frente?.nome : null, responsavel].filter(Boolean).join(" · ")}</span>
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
  const link = linkDoItem(item.frenteId, item.id);
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
          <span className="meta-compacta">
            · {[mostrarFrente ? frente?.nome : null, item.responsavelNome].filter(Boolean).join(" · ") || "sem responsável"}
          </span>
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

function IconeMedicao({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </svg>
  );
}

// Medição mensal de um contrato (ver lib/medicao.js). Depois de subida a
// planilha, vira "Lançar a medição no sistema" até ser marcada como lançada.
function MedicaoRow({ entrada }) {
  const { user } = useAuth();
  const { contrato, medicao, data } = entrada;
  const [salvando, setSalvando] = useState(false);
  const atrasado = diasAte(data) < 0;
  const papel = contrato.membros?.[user.uid];
  const podeMarcar = papel === "proprietario" || papel === "editor";
  const m = contrato.medicao;
  const subida = medicao.subida;
  const detalhes = [contrato.titulo, subida ? "subida · falta lançar" : m.quem, !subida && m.lightPlus ? "Light+" : null].filter(Boolean);
  // Com várias medições no mês, abre a aba Medições (lá aparece cada uma).
  const link = subida && !nomesDoContrato(contrato).length ? `/contratos/${contrato.id}/medicoes/${medicao.mesReferencia}` : `/contratos/${contrato.id}/medicoes`;

  async function marcar() {
    setSalvando(true);
    try {
      if (subida) await marcarLancada(contrato.id, medicao.mesReferencia, true, medicao.chave);
      else await marcarMedicaoFeita(contrato.id, medicao.chave, true);
    } catch (e) {
      console.error("Erro ao marcar medição:", e);
      window.alert("Não deu pra marcar a medição. Tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div className={`agenda-row com-acoes medicao`}>
      <span className={`icone-linha ${atrasado ? "texto-alerta" : ""}`} style={{ color: atrasado ? undefined : "var(--color-primary)" }}>
        <IconeMedicao />
      </span>
      <Link to={link} style={{ minWidth: 0, color: "inherit" }}>
        <div className="titulo">{subida ? `Lançar a medição de ${medicao.nomeMes} no sistema` : `Fazer a medição de ${medicao.nomeMes}`}</div>
        <div className="meta">
          <span className="pill pill-medicao">Medição</span>
          <span>{detalhes.join(" · ")}</span>
          {m.responsavelId !== user.uid && m.responsavelNome && <span>· {m.responsavelNome}</span>}
        </div>
      </Link>
      {podeMarcar ? (
        <div className="acoes-lembrete">
          <button type="button" className="btn btn-ghost btn-sm" onClick={marcar} disabled={salvando}>
            {salvando ? "Salvando..." : subida ? "Lançada no sistema" : "Medição feita"}
          </button>
        </div>
      ) : (
        <span />
      )}
      <span className={`data ${atrasado ? "texto-alerta" : ""}`}>{formatarDataRelativa(data)}</span>
    </div>
  );
}

// Cobrar retorno de uma demanda parada (ver entradasDeCobranca).
function CobrancaRow({ entrada }) {
  const { demanda: d, donoId, fila, data } = entrada;
  const [salvando, setSalvando] = useState(false);
  const atrasado = diasAte(data) < 0;
  const dias = diasDesde(d.espera.desde);

  async function executar(acao) {
    setSalvando(true);
    try {
      await acao();
    } catch (e) {
      console.error("Erro ao atualizar a demanda:", e);
      window.alert("Não deu pra atualizar. Tente de novo.");
      setSalvando(false);
    }
  }
  const chegou = () =>
    executar(async () => {
      const r = retornoChegou(d);
      await atualizarDemanda(donoId, d.id, r.campos);
      if (fila) notificarFila(donoId, fila, { tipo: r.evento === "parou" ? "demanda_parada" : "demanda_retomada", alvo: d.titulo, trecho: "Retorno chegou", link: `/demandas/${donoId}/${d.id}` });
    });
  const adiar = () => executar(() => atualizarDemanda(donoId, d.id, { espera: { ...d.espera, cobrarEm: somarDias(inicioDoDia(), 2) } }));

  return (
    <div className="agenda-row com-acoes lembrete">
      <span className={`icone-linha ${atrasado ? "texto-alerta" : ""}`} style={{ color: atrasado ? undefined : "#8a5a00" }}>
        <IconeSino size={18} />
      </span>
      <Link to={`/demandas/${donoId}/${d.id}`} style={{ minWidth: 0, color: "inherit" }}>
        <div className="titulo">
          Cobrar {d.espera.de}: {d.titulo}
        </div>
        <div className="meta">
          <span className="pill pill-espera">Demanda parada</span>
          <span>{dias === 0 ? "aguardando desde hoje" : dias === 1 ? "aguardando há 1 dia" : `aguardando há ${dias} dias`}</span>
        </div>
      </Link>
      <div className="acoes-lembrete">
        <button type="button" className="btn btn-ghost btn-sm" onClick={chegou} disabled={salvando}>
          Retorno chegou
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={adiar} disabled={salvando}>
          Adiar 2 dias
        </button>
      </div>
      <span className={`data ${atrasado ? "texto-alerta" : ""}`}>{formatarDataRelativa(data)}</span>
    </div>
  );
}
