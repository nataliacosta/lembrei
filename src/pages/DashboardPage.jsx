import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useDados } from "../contexts/DadosContext";
import AgendaRow from "../components/AgendaRow";
import { GRUPOS, agruparAgenda, contratosPedindoAtencao } from "../lib/agenda";
import { entradasDeMedicao } from "../lib/medicao";
import { CONTRATO_STATUS } from "../lib/constants";
import { descreverVencimento, diaDaSemanaPorExtenso, diasAte, formatarData, formatarDataRelativa, inicioDoDia, paraDate } from "../lib/datas";
import { calcularPrevisao, formatarHoras, horasRestantes, ordenarFila } from "../lib/previsao";

function lerFiltro() {
  try {
    return localStorage.getItem("lembrei:filtroPainel") || "meus";
  } catch {
    return "meus";
  }
}

function salvarFiltro(valor) {
  try {
    localStorage.setItem("lembrei:filtroPainel", valor);
  } catch {
    // Sem localStorage (modo privado etc.): só não lembra a escolha.
  }
}

export default function DashboardPage() {
  const { user } = useAuth();
  const {
    itensAbertos,
    carregandoItens,
    erroItens,
    mapaFrentes,
    contratos,
    mapaContratos,
    aditivosTI,
    erroContratos,
    papelNaFrente,
    minhaFila,
    minhasDemandas,
  } = useDados();
  const [filtro, setFiltro] = useState(lerFiltro);
  const [mostrarSemData, setMostrarSemData] = useState(false);

  function escolherFiltro(valor) {
    setFiltro(valor);
    salvarFiltro(valor);
  }

  const medicoes = entradasDeMedicao(contratos, { uid: user.uid, soMeus: filtro === "meus" });
  const { grupos, semData } = agruparAgenda(itensAbertos, { uid: user.uid, soMeus: filtro === "meus", extras: medicoes });
  const contratosAtencao = contratosPedindoAtencao(contratos);
  const podeEditar = (frenteId) => ["proprietario", "editor"].includes(papelNaFrente(frenteId));
  const totalAgenda = GRUPOS.reduce((soma, g) => soma + grupos[g.key].length, 0);

  const hoje = diaDaSemanaPorExtenso();
  const minhaFilaOrdenada = minhaFila ? ordenarFila(minhaFila.ordem, minhasDemandas) : [];
  const previsaoFila = calcularPrevisao(minhaFilaOrdenada.slice(0, 3), minhaFila?.capacidadeHoras || 6).itens;

  return (
    <>
      <div className="page-shell" style={{ flex: "999 1 560px", minWidth: 0, paddingTop: 28, paddingBottom: 48 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--color-gray)", fontWeight: 600 }}>
              {hoje.charAt(0).toUpperCase() + hoje.slice(1)}
            </div>
            <h1 style={{ margin: "2px 0 0", fontSize: 26, fontWeight: 700 }}>O que fazer</h1>
          </div>
          <div className="seg" role="group" aria-label="Mostrar itens">
            <button type="button" aria-pressed={filtro === "meus"} onClick={() => escolherFiltro("meus")}>
              Meus
            </button>
            <button type="button" aria-pressed={filtro === "todos"} onClick={() => escolherFiltro("todos")}>
              Todos
            </button>
          </div>
        </div>

        <div className="tiles" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
          <a href="#grupo-atrasados" className={`tile ${grupos.atrasados.length ? "tile-alerta" : ""}`}>
            <div className="tile-valor">{grupos.atrasados.length}</div>
            <div className="tile-label">Atrasados</div>
          </a>
          <a href="#grupo-hoje" className="tile">
            <div className="tile-valor">{grupos.hoje.length}</div>
            <div className="tile-label">Para hoje</div>
          </a>
          <a href="#grupo-semana" className="tile">
            <div className="tile-valor">{grupos.semana.length}</div>
            <div className="tile-label">Próximos 7 dias</div>
          </a>
          <a href="#contratos-atencao" className="tile">
            <div className="tile-valor">{contratosAtencao.length}</div>
            <div className="tile-label">Contratos pedindo atenção</div>
          </a>
        </div>

        {carregandoItens ? (
          <div className="empty-state">Carregando...</div>
        ) : erroItens ? (
          <div className="empty-state" style={{ color: "var(--color-orange)" }}>
            Não deu pra carregar: {erroItens}
          </div>
        ) : (
          <>
            {totalAgenda === 0 && (
              <div className="empty-state" style={{ marginTop: 24 }}>
                {filtro === "meus"
                  ? "Nada com data para você. Veja “Todos” para o que está com outras pessoas."
                  : "Nenhuma tarefa ou lembrete com data. 🎉"}
              </div>
            )}
            {GRUPOS.map((g) => {
              const entradas = grupos[g.key];
              if (entradas.length === 0) return null;
              return (
                <section key={g.key} id={`grupo-${g.key}`}>
                  <h2 className={`grupo-titulo ${g.alerta ? "grupo-alerta" : ""}`}>
                    {g.label} · {entradas.length}
                  </h2>
                  <div className={`lista-card ${g.alerta ? "alerta" : ""}`}>
                    {entradas.map((entrada) => (
                      <AgendaRow
                        key={entrada.chave}
                        entrada={entrada}
                        frente={entrada.item ? mapaFrentes[entrada.item.frenteId] : undefined}
                        podeEditar={entrada.item ? podeEditar(entrada.item.frenteId) : false}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {semData.length > 0 && (
              <section>
                <button
                  type="button"
                  className="grupo-titulo"
                  onClick={() => setMostrarSemData((v) => !v)}
                  aria-expanded={mostrarSemData}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", minHeight: 32 }}
                >
                  Sem data · {semData.length}
                  <span style={{ fontSize: 10, transform: mostrarSemData ? "none" : "rotate(-90deg)" }}>▾</span>
                </button>
                {mostrarSemData && (
                  <div className="lista-card">
                    {semData.map((item) => (
                      <AgendaRow
                        key={item.id}
                        entrada={{ chave: item.id, tipo: "sem-data", item, data: null }}
                        frente={mapaFrentes[item.frenteId]}
                        podeEditar={podeEditar(item.frenteId)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <aside className="dashboard-aside page-shell" style={{ paddingTop: 28, paddingBottom: 48, paddingLeft: 0, paddingRight: 24, borderLeft: "none" }}>
        <div className="aside-bloco">
        {previsaoFila.length > 0 && (
          <>
            <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
              Minha fila
              <Link to="/demandas" style={{ fontSize: 13, fontWeight: 600 }}>
                ver fila
              </Link>
            </h2>
            <div className="lista-card" style={{ marginBottom: 24 }}>
              {previsaoFila.map((r, i) => {
                const d = r.demanda;
                const estoura = d.prazoPedido && r.fim > inicioDoDia(paraDate(d.prazoPedido));
                return (
                  <Link key={d.id} to={`/demandas/${minhaFila.id}/${d.id}`} className="secao-lateral" style={i === 0 ? { background: "#f3fbfa" } : undefined}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{d.titulo}</span>
                      <span className={estoura ? "texto-alerta" : ""} style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {diasAte(r.fim) === 0 ? "Hoje" : formatarDataRelativa(r.fim)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 2 }}>
                      {i === 0 ? `Em andamento · restam ${formatarHoras(horasRestantes(d))}` : i === 1 ? "Próxima da fila" : `${i + 1}ª da fila`}
                      {estoura && ` · depois do prazo pedido (${formatarData(d.prazoPedido)})`}
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        </div>
        <div className="aside-bloco">
        <h2 id="contratos-atencao" style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700 }}>
          Contratos pedindo atenção
        </h2>
        {erroContratos ? (
          <div className="empty-state" style={{ color: "var(--color-orange)" }}>Não deu pra carregar: {erroContratos}</div>
        ) : contratosAtencao.length === 0 ? (
          <div className="lista-card empty-state" style={{ padding: 20 }}>Nenhum contrato perto do vencimento. 🎉</div>
        ) : (
          <div className="lista-card">
            {contratosAtencao.map((c) => {
              const dias = diasAte(c.vencimento);
              const statusInfo = CONTRATO_STATUS[c.status] || CONTRATO_STATUS.ativo;
              return (
                <Link key={c.id} to={`/contratos/${c.id}`} className="secao-lateral">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{c.titulo}</span>
                    <span className="texto-alerta" style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {dias < 0 ? formatarData(c.vencimento) : `${dias} ${dias === 1 ? "dia" : "dias"}`}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 2 }}>
                    {descreverVencimento(c.vencimento)} · {statusInfo.label.toLowerCase()}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        </div>
        <div className="aside-bloco">
        <h2 style={{ margin: "24px 0 10px", fontSize: 15, fontWeight: 700 }}>Aguardando TI</h2>
        {aditivosTI.length === 0 ? (
          <div className="lista-card empty-state" style={{ padding: 20 }}>Nenhum aditivo parado em TI. 🎉</div>
        ) : (
          <div className="lista-card">
            {aditivosTI.map((a) => {
              const parado = -diasAte(a.dataSolicitacao);
              return (
                <Link key={a.id} to={`/contratos/${a.contratoId}/aditivos/${a.id}`} className="secao-lateral">
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    Aditivo · {mapaContratos[a.contratoId]?.titulo || "Contrato"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 2 }}>
                    {(a.tipo || []).join(", ") || "Aditivo"}
                    {a.dataSolicitacao && ` · parado há ${parado} ${parado === 1 ? "dia" : "dias"}`}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      </aside>
    </>
  );
}
