import { Link } from "react-router-dom";
import Comentarios from "./Comentarios";
import { caminhoDoItem, linkDaOrigem, linkDoItem } from "../lib/itens";
import OrigemDoItem from "./OrigemDoItem";
import { IconeCalendario, IconeCheck } from "./Icones";
import { BotaoVoltar } from "../contexts/HistoricoContext";
import { PAPEIS } from "../lib/constants";
import { diasAte, formatarData, formatarDataRelativa, inicioDoDia } from "../lib/datas";
import { marcarConcluido, marcarPreparo, pularReuniao } from "../lib/firestore";
import {
  chaveData,
  descreverRecorrencia,
  frequenciaCurta,
  ocorrencias,
  preparosDaOcorrencia,
  proximaOcorrencia,
  ultimaOcorrencia,
} from "../lib/reunioes";

function dataLonga(data) {
  const texto = data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const hora = data.toTimeString().slice(0, 5);
  return `${texto.charAt(0).toUpperCase() + texto.slice(1)}${hora !== "00:00" ? ` às ${hora}` : ""}`;
}

function emQuanto(data) {
  const dias = diasAte(data);
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  return `em ${dias} dias`;
}

function Secao({ children }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-gray)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "24px 0 8px" }}>
      {children}
    </div>
  );
}

function ListaPreparos({ item, preparos, podeEditar, passada }) {
  if (preparos.length === 0) {
    return <div className="lista-card empty-state" style={{ padding: 18 }}>Nenhum preparo cadastrado.</div>;
  }
  return (
    <div className="lista-card" style={passada ? { opacity: 0.8 } : undefined}>
      {preparos.map((p) => {
        const atrasado = !passada && !p.feito && p.comecaEm < inicioDoDia();
        return (
          <div key={p.id} className="secao-lateral" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              className="check-quadrado"
              aria-pressed={p.feito}
              disabled={!podeEditar}
              onClick={() => marcarPreparo(item.frenteId, item.id, p.chave, p.id, !p.feito)}
              aria-label={`${p.feito ? "Desmarcar" : "Marcar como feito"}: ${p.titulo}`}
              style={{ cursor: podeEditar ? "pointer" : "default", minWidth: 22 }}
            >
              {p.feito && <IconeCheck size={14} />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, textDecoration: p.feito ? "line-through" : "none" }}>{p.titulo}</div>
              <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 2 }}>
                {[p.responsavelNome || item.responsavelNome, `${p.diasAntes} ${p.diasAntes === 1 ? "dia" : "dias"} antes`]
                  .filter(Boolean)
                  .join(" · ")}
                {!passada && !p.feito && (
                  <span className={atrasado ? "texto-alerta" : undefined}>
                    {` · ${atrasado ? "atrasado desde" : "fazer até"} ${formatarDataRelativa(p.comecaEm).toLowerCase()}`}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ReuniaoDetalhe({ item, frenteId, frente, membros, papel, podeEditar, onExcluir }) {
  const reuniao = item.reuniao;
  const itemComFrente = { ...item, frenteId };
  const proxima = proximaOcorrencia(reuniao);
  const ultima = ultimaOcorrencia(reuniao);
  const preparosProxima = preparosDaOcorrencia(reuniao, proxima);
  const preparosUltima = preparosDaOcorrencia(reuniao, ultima);
  const proximas = ocorrencias(reuniao, { quantas: 4 });
  const feitos = preparosProxima.filter((p) => p.feito).length;

  async function pular() {
    if (!proxima) return;
    if (!window.confirm(`Pular a reunião de ${formatarData(proxima)}? Os preparos dessa data deixam de aparecer.`)) return;
    await pularReuniao(frenteId, item.id, chaveData(proxima));
  }

  async function encerrar() {
    const texto = reuniao.frequencia === "unica" ? "Encerrar esta reunião?" : "Encerrar a recorrência? A reunião sai do O que fazer.";
    if (!window.confirm(texto)) return;
    await marcarConcluido(frenteId, item.id, !item.concluido);
  }

  return (
    <div className="page-shell" style={{ paddingTop: 24, paddingBottom: 60, maxWidth: 1180 }}>
      <BotaoVoltar destinoPadrao={linkDaOrigem(frenteId)} />

      <div className="detalhe-layout" style={{ marginTop: 16 }}>
        <div className="detalhe-principal">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <span className="pill pill-reuniao">Reunião</span>
            <span className="pill" style={{ background: "#eceeee", color: "var(--color-dark)" }}>
              {frequenciaCurta(reuniao).replace(/^./, (c) => c.toUpperCase())}
            </span>
            {item.concluido && (
              <span className="pill" style={{ background: "#eceeee", color: "var(--color-gray)" }}>
                Encerrada
              </span>
            )}
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, lineHeight: 1.3 }}>{item.titulo}</h1>
          <OrigemDoItem origem={frente} item={item} />

          <div className="caixa-reuniao" style={{ marginTop: 18, padding: "16px 18px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "#1f4f8f" }}>
              <IconeCalendario size={28} />
            </span>
            <div style={{ flex: "1 1 240px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#1f4f8f" }}>
                Próxima reunião
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                {proxima && !item.concluido ? `${dataLonga(proxima)} · ${emQuanto(proxima)}` : "Nenhuma data futura"}
              </div>
            </div>
            {reuniao.link && (
              <a href={reuniao.link} target="_blank" rel="noreferrer" className="btn btn-primary">
                Entrar na reunião
              </a>
            )}
            {podeEditar && proxima && !item.concluido && reuniao.frequencia !== "unica" && (
              <button type="button" className="btn btn-ghost" onClick={pular}>
                Pular esta data
              </button>
            )}
          </div>

          {item.descricao && <p style={{ margin: "18px 0 0", maxWidth: 640, fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{item.descricao}</p>}

          {proxima && !item.concluido && (
            <>
              <Secao>
                Preparos para {formatarData(proxima)}
                {preparosProxima.length > 0 && ` · ${feitos} de ${preparosProxima.length} feitos`}
              </Secao>
              <ListaPreparos item={itemComFrente} preparos={preparosProxima} podeEditar={podeEditar} />
            </>
          )}

          {ultima && preparosUltima.length > 0 && (
            <>
              <Secao>Última reunião · {formatarData(ultima)}</Secao>
              <ListaPreparos item={itemComFrente} preparos={preparosUltima} podeEditar={podeEditar} passada />
            </>
          )}

          <div style={{ maxWidth: 640 }}>
            <Comentarios
              caminhoPai={caminhoDoItem(frenteId, item.id)}
              aviso={{ alvo: item.titulo, contexto: frente?.nome, link: linkDoItem(frenteId, item.id), interessados: [item.responsavelId, item.criadoPor] }}
              usuarios={membros}
              papeis={frente?.membros}
            />
          </div>
        </div>

        <aside className="detalhe-lateral">
          <div className="lista-card">
            <div className="info-linha">
              <span>Quando</span>
              <span>{descreverRecorrencia(reuniao)}</span>
            </div>
            <div className="info-linha">
              <span>{reuniao.frequencia === "unica" ? "Data" : "Desde"}</span>
              <span>{formatarData(reuniao.inicio)}</span>
            </div>
            {reuniao.frequencia !== "unica" && (
              <div className="info-linha">
                <span>Repete até</span>
                <span>{reuniao.ate ? formatarData(reuniao.ate) : "Sem data final"}</span>
              </div>
            )}
            <div className="info-linha">
              <span>Responsável</span>
              <span>{item.responsavelNome || "—"}</span>
            </div>
          </div>

          {proximas.length > 0 && !item.concluido && reuniao.frequencia !== "unica" && (
            <div className="lista-card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-gray)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Próximas datas
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
                {proximas.map((d, i) => (
                  <span key={d.getTime()} style={{ fontWeight: i === 0 ? 700 : 400 }}>
                    {formatarDataRelativa(d)}
                    {reuniao.hora && ` · ${reuniao.hora}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {podeEditar ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link to={`${linkDoItem(frenteId, item.id)}/editar`} className="btn btn-ghost" style={{ justifyContent: "center" }}>
                Editar reunião e preparos
              </Link>
              <button type="button" className="btn btn-ghost" onClick={encerrar} style={{ justifyContent: "center" }}>
                {item.concluido ? "Reabrir reunião" : reuniao.frequencia === "unica" ? "Encerrar reunião" : "Encerrar recorrência"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onExcluir}
                style={{ justifyContent: "center", color: "var(--color-orange)", borderColor: "var(--color-orange-border)" }}
              >
                Excluir
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--color-gray)" }}>
              Seu acesso a esta frente: <b style={{ color: "var(--color-dark)" }}>{PAPEIS[papel] || "Sem acesso"}</b>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
