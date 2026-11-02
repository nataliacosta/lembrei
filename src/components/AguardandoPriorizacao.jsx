import { useState } from "react";
import { Link } from "react-router-dom";
import { formatarData, formatarDataRelativa } from "../lib/datas";
import { priorizarDemanda } from "../lib/filas";
import { formatarEstimativa, opcoesDePosicao, temEstimativa } from "../lib/previsao";

function quandoChegou(criadoEm) {
  if (!criadoEm?.toDate) return "";
  const d = criadoEm.toDate();
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return "chegou hoje";
  if (d.toDateString() === ontem.toDateString()) return "chegou ontem";
  return `chegou ${formatarData(d)}`;
}

function Opcao({ titulo, detalhe, data, alerta, selecionada, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selecionada}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        width: "100%",
        textAlign: "left",
        background: selecionada ? "#f3fbfa" : "var(--color-white)",
        border: `1px solid ${selecionada ? "var(--color-primary)" : "var(--color-border)"}`,
        borderRadius: 10,
        padding: "8px 12px",
        fontSize: 13,
        color: "var(--color-dark)",
        minHeight: 44,
        marginTop: 6,
      }}
    >
      <span>
        {titulo}
        {detalhe && <small style={{ display: "block", color: "var(--color-gray)" }}>{detalhe}</small>}
      </span>
      <span className={alerta ? "texto-alerta" : ""} style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
        {data}
      </span>
    </button>
  );
}

function CartaoAguardando({ demanda, fila, capacidade, podeEditar, donoId, ordem, aberto, onAbrir, onFechar, onPriorizado, onArrastar }) {
  const [posicao, setPosicao] = useState(null);
  const estimada = temEstimativa(demanda);
  const linkEditar = `/demandas/${donoId}/${demanda.id}`;
  const opcoes = aberto && estimada ? opcoesDePosicao(fila, demanda, capacidade) : null;

  function rotuloData(fim) {
    const texto = formatarDataRelativa(fim);
    if (!opcoes?.prazo) return texto;
    return fim > opcoes.prazo ? `${texto} · depois do prazo` : `${texto} · ok`;
  }

  const escolhida = posicao ?? (opcoes ? (opcoes.posicaoPrazo ?? fila.length) : null);

  async function confirmar() {
    await priorizarDemanda(donoId, ordem, demanda.id, escolhida);
    onPriorizado(`“${demanda.titulo}” entrou na ${escolhida + 1}ª posição da fila.`);
    onFechar();
  }

  return (
    <div
      className="lista-card"
      draggable={podeEditar && estimada}
      onDragStart={(e) => {
        // Sem estimativa não dá para calcular a previsão: precisa estimar antes.
        if (!podeEditar || !estimada) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        onArrastar(demanda.id);
      }}
      onDragEnd={() => onArrastar(null)}
      style={{
        padding: "12px 14px",
        marginTop: 10,
        cursor: podeEditar && estimada ? "grab" : "default",
        borderColor: aberto ? "var(--color-primary)" : undefined,
        boxShadow: aberto ? "0 6px 18px rgba(0,51,45,.12)" : undefined,
        overflow: "visible",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <Link to={linkEditar} style={{ color: "inherit", minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>{demanda.titulo}</div>
          <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 2 }}>
            {[demanda.solicitante, estimada && formatarEstimativa(demanda), quandoChegou(demanda.criadoEm)].filter(Boolean).join(" · ")}
          </div>
          {demanda.prazoPedido && (
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-orange)", marginTop: 4 }}>Prazo pedido: {formatarData(demanda.prazoPedido)}</div>
          )}
          {!estimada && <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-orange)", marginTop: 4 }}>Sem estimativa — estime para priorizar</div>}
        </Link>
        {podeEditar && !aberto && (
          <span style={{ flex: "0 0 auto" }}>
            {estimada ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onAbrir}>
                Priorizar
              </button>
            ) : (
              <Link to={linkEditar} className="btn btn-ghost btn-sm">
                Estimar
              </Link>
            )}
          </span>
        )}
      </div>

      {opcoes && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f0f0f0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-gray)", textTransform: "uppercase", letterSpacing: ".05em" }}>Onde entra na fila</div>
          <Opcao
            titulo="No fim da fila"
            data={rotuloData(opcoes.fimNoFim)}
            alerta={opcoes.prazo && opcoes.fimNoFim > opcoes.prazo}
            selecionada={escolhida === fila.length}
            onClick={() => setPosicao(fila.length)}
          />
          {opcoes.posicaoPrazo !== null && opcoes.posicaoPrazo > 0 && opcoes.posicaoPrazo < fila.length && (
            <Opcao
              titulo={`Na ${opcoes.posicaoPrazo + 1}ª posição`}
              detalhe={`mais tarde possível para o prazo · atrasa ${fila.length - opcoes.posicaoPrazo}`}
              data={rotuloData(opcoes.simular(opcoes.posicaoPrazo))}
              selecionada={escolhida === opcoes.posicaoPrazo}
              onClick={() => setPosicao(opcoes.posicaoPrazo)}
            />
          )}
          {fila.length > 0 && (
            <Opcao
              titulo="Em 1º (agora)"
              detalhe={`pausa a atual · atrasa ${fila.length}`}
              data={rotuloData(opcoes.simular(0))}
              alerta={opcoes.prazo && opcoes.simular(0) > opcoes.prazo}
              selecionada={escolhida === 0}
              onClick={() => setPosicao(0)}
            />
          )}
          {fila.length > 1 && (
            <select
              value={escolhida > 0 && escolhida < fila.length ? String(escolhida) : ""}
              onChange={(e) => e.target.value && setPosicao(Number(e.target.value))}
              aria-label="Depois de qual demanda"
              style={{ marginTop: 6, fontSize: 13 }}
            >
              <option value="">Depois de…</option>
              {fila.slice(0, -1).map((d, i) => (
                <option key={d.id} value={String(i + 1)}>
                  {i + 1}. {d.titulo} → pronta {formatarData(opcoes.simular(i + 1))}
                </option>
              ))}
            </select>
          )}
          {opcoes.prazo && opcoes.posicaoPrazo === null && opcoes.fimNoFim > opcoes.prazo && (
            <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 8 }}>Nem em 1º lugar dá para entregar até {formatarData(opcoes.prazo)}.</div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={confirmar}>
              Priorizar na {escolhida + 1}ª
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AguardandoPriorizacao({ aguardando, fila, capacidade, podeEditar, donoId, ordem, onPriorizado, onArrastar }) {
  const [aberto, setAberto] = useState(null);
  return (
    <aside className="coluna-aguardando" aria-label="Aguardando priorização">
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
        Aguardando priorização
        {aguardando.length > 0 && <span className="sidebar-badge alerta" style={{ marginLeft: 0 }}>{aguardando.length}</span>}
      </h2>
      <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 6 }}>
        {aguardando.length === 0
          ? "Nada esperando. Demandas novas aparecem aqui até alguém decidir onde elas entram na fila."
          : podeEditar
            ? (
              <>
                Priorize escolhendo a posição<span className="so-desktop"> ou arrastando o cartão para a fila</span>.
              </>
            )
            : "Quem pode editar a fila decide onde elas entram."}
      </div>
      {aguardando.map((d) => (
        <CartaoAguardando
          key={d.id}
          demanda={d}
          fila={fila}
          capacidade={capacidade}
          podeEditar={podeEditar}
          donoId={donoId}
          ordem={ordem}
          aberto={aberto === d.id}
          onAbrir={() => setAberto(d.id)}
          onFechar={() => setAberto(null)}
          onPriorizado={onPriorizado}
          onArrastar={onArrastar}
        />
      ))}
    </aside>
  );
}
