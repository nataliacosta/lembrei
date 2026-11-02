import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { buscarItensAbertosDoUsuario, watchFrentes } from "../lib/firestore";
import { buscarAditivosPendentesTI, watchContratos } from "../lib/contratos";
import { TIPO_POR_KEY } from "../lib/constants";
import { alertaVencimento, estaAtrasado, formatarData } from "../lib/datas";

export default function DashboardPage() {
  const { user } = useAuth();
  const [frentes, setFrentes] = useState([]);
  const [itensAbertos, setItensAbertos] = useState([]);
  const [carregandoItens, setCarregandoItens] = useState(true);
  const [erroItens, setErroItens] = useState("");
  const [soMeus, setSoMeus] = useState(false);
  const [contratos, setContratos] = useState([]);
  const [aditivosTI, setAditivosTI] = useState([]);
  const [erroContratos, setErroContratos] = useState("");

  useEffect(() => {
    if (!user) return;
    const unsub = watchFrentes(user.uid, setFrentes);
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setCarregandoItens(true);
    setErroItens("");
    buscarItensAbertosDoUsuario(user.uid)
      .then((itens) => {
        setItensAbertos(itens);
        setCarregandoItens(false);
      })
      .catch((e) => {
        console.error("Erro ao buscar itens abertos:", e);
        setErroItens(e.message || String(e));
        setCarregandoItens(false);
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = watchContratos(user.uid, setContratos, (e) => setErroContratos(e.message || String(e)));
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    buscarAditivosPendentesTI(user.uid).then(setAditivosTI);
  }, [user]);

  const mapaFrentes = Object.fromEntries(frentes.map((f) => [f.id, f]));

  const urgenciasAbertas = itensAbertos.filter((i) => i.tipo === "urgencia").length;
  const lembretesAtrasados = itensAbertos.filter((i) => i.lembrete?.ativo && estaAtrasado(i.lembrete.proximaVerificacao)).length;
  const consultasSemResposta = itensAbertos.filter((i) => i.tipo === "consulta").length;
  const tarefasAbertas = itensAbertos.filter((i) => i.tipo === "tarefa").length;

  const lembretesProximos = itensAbertos
    .filter((i) => i.lembrete?.ativo && i.lembrete.proximaVerificacao)
    .sort((a, b) => a.lembrete.proximaVerificacao.toMillis() - b.lembrete.proximaVerificacao.toMillis())
    .slice(0, 6);

  const tarefasEUrgencias = itensAbertos.filter(
    (i) => (i.tipo === "tarefa" || i.tipo === "urgencia") && (!soMeus || i.responsavelId === user.uid)
  );
  const itensComPrazo = [
    ...tarefasEUrgencias.filter((i) => i.prazo).sort((a, b) => a.prazo.toMillis() - b.prazo.toMillis()),
    ...tarefasEUrgencias.filter((i) => !i.prazo),
  ].slice(0, 10);

  const mapaContratos = Object.fromEntries(contratos.map((c) => [c.id, c]));

  const contratosAlerta = contratos
    .filter((c) => c.status !== "cancelado")
    .map((c) => ({ ...c, alerta: alertaVencimento(c.vencimento, c.status === "aditivo") }))
    .filter((c) => c.alerta)
    .sort((a, b) => {
      if (a.alerta !== b.alerta) return a.alerta === "vencido" ? -1 : 1;
      return (a.vencimento?.toMillis() || 0) - (b.vencimento?.toMillis() || 0);
    });

  return (
    <>
      <div className="page-shell" style={{ flex: "999 1 560px", minWidth: 0, paddingTop: 32, paddingBottom: 32, display: "flex", flexDirection: "column", gap: 32 }}>
          <div>
            <h1 style={{ margin: "0 0 4px 0", fontSize: 24, fontWeight: 700 }}>Painel geral</h1>
            <p style={{ margin: 0, color: "var(--color-gray)", fontSize: 14 }}>
              Visão geral de tudo o que está em aberto nas suas frentes.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            <StatTile valor={urgenciasAbertas} label="Urgências abertas" cor="var(--color-orange)" />
            <StatTile valor={lembretesAtrasados} label="Lembretes atrasados" cor="var(--color-accent)" />
            <StatTile valor={consultasSemResposta} label="Consultas sem resposta" cor="var(--color-primary)" />
            <StatTile valor={tarefasAbertas} label="Tarefas abertas" cor="var(--color-gray)" />
            <StatTile valor={aditivosTI.length} label="Pendências de TI" cor="var(--color-teal-light)" />
            <StatTile valor={contratosAlerta.length} label="Contratos a vencer" cor="var(--color-accent)" />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Tarefas e urgências em aberto</h2>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-dark)" }}>
                <input type="checkbox" checked={soMeus} onChange={(e) => setSoMeus(e.target.checked)} style={{ width: "auto" }} />
                Só os meus
              </label>
            </div>
            {carregandoItens ? (
              <div className="empty-state">Carregando...</div>
            ) : erroItens ? (
              <div className="empty-state" style={{ color: "var(--color-orange)" }}>
                Não deu pra carregar: {erroItens}
              </div>
            ) : itensComPrazo.length === 0 ? (
              <div className="empty-state">Nenhuma tarefa ou urgência em aberto. 🎉</div>
            ) : (
              <div className="card table-scroll" style={{ overflowY: "hidden" }}>
                {itensComPrazo.map((item) => (
                  <Link
                    key={item.id}
                    to={`/frentes/${item.frenteId}/itens/${item.id}`}
                    state={{ from: "dashboard" }}
                    className="table-row"
                    style={{
                      padding: "12px 20px",
                      borderTop: "1px solid #F0F0F0",
                      color: "inherit",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{item.titulo}</span>
                    <span style={{ fontSize: 12, color: "var(--color-gray)" }}>{mapaFrentes[item.frenteId]?.nome || "—"}</span>
                    <span
                      className="pill"
                      style={{ background: "rgba(0,153,146,0.12)", color: "var(--color-primary)", justifySelf: "start" }}
                    >
                      {TIPO_POR_KEY[item.tipo]?.label}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--color-gray)" }}>{item.status || "—"}</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: estaAtrasado(item.prazo) ? "var(--color-orange)" : "var(--color-dark)",
                      }}
                    >
                      {item.prazo ? formatarData(item.prazo) : "—"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 700 }}>Pendências de TI (aditivos)</h2>
            {aditivosTI.length === 0 ? (
              <div className="empty-state">Nenhum aditivo pendente em TI. 🎉</div>
            ) : (
              <div className="card table-scroll" style={{ overflowY: "hidden" }}>
                {aditivosTI.map((a) => (
                  <Link
                    key={a.id}
                    to={`/contratos/${a.contratoId}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1.4fr 1fr",
                      gap: 12,
                      minWidth: 420,
                      padding: "12px 20px",
                      borderTop: "1px solid #F0F0F0",
                      color: "inherit",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{mapaContratos[a.contratoId]?.titulo || "Contrato"}</span>
                    <span style={{ fontSize: 12, color: "var(--color-gray)" }}>{(a.tipo || []).join(", ") || "Aditivo"}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-dark)" }}>
                      {a.dataSolicitacao ? formatarData(a.dataSolicitacao) : "—"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 700 }}>Contratos — atenção com o vencimento</h2>
            {erroContratos ? (
              <div className="empty-state" style={{ color: "var(--color-orange)" }}>Não deu pra carregar: {erroContratos}</div>
            ) : contratosAlerta.length === 0 ? (
              <div className="empty-state">Nenhum contrato perto do vencimento. 🎉</div>
            ) : (
              <div className="card table-scroll" style={{ overflowY: "hidden" }}>
                {contratosAlerta.map((c) => (
                  <Link
                    key={c.id}
                    to={`/contratos/${c.id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1.4fr 1fr 1fr",
                      gap: 12,
                      minWidth: 480,
                      padding: "12px 20px",
                      borderTop: "1px solid #F0F0F0",
                      color: "inherit",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{c.titulo}</span>
                    <span style={{ fontSize: 12, color: "var(--color-gray)" }}>{c.fornecedor || "—"}</span>
                    <span
                      className="pill"
                      style={{
                        justifySelf: "start",
                        background: c.alerta === "vencido" ? "var(--color-accent)" : "rgba(238,115,27,0.14)",
                        color: c.alerta === "vencido" ? "var(--color-dark)" : "var(--color-orange)",
                      }}
                    >
                      {c.alerta === "vencido" ? "Vencido" : "Vence em breve"}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-orange)" }}>
                      {c.vencimento ? formatarData(c.vencimento) : "—"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-aside" style={{ padding: "32px 24px" }}>
          <h2 style={{ margin: "0 0 14px 0", fontSize: 15, fontWeight: 700 }}>Lembretes próximos</h2>
          {lembretesProximos.length === 0 ? (
            <div className="empty-state">Nenhum lembrete pendente.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {lembretesProximos.map((item) => {
                const atrasado = estaAtrasado(item.lembrete.proximaVerificacao);
                return (
                  <Link
                    key={item.id}
                    to={`/frentes/${item.frenteId}/itens/${item.id}`}
                    state={{ from: "dashboard" }}
                    className="card"
                    style={{ padding: "12px 14px", borderLeft: `3px solid ${atrasado ? "var(--color-orange)" : "var(--color-primary)"}`, color: "inherit" }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.lembrete.mensagem || item.titulo}</div>
                    <div style={{ fontSize: 12, color: "var(--color-gray)", margin: "4px 0 0 0" }}>
                      {mapaFrentes[item.frenteId]?.nome || "—"}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: atrasado ? "var(--color-orange)" : "var(--color-gray)", marginTop: 6 }}>
                      {atrasado ? "Atrasado · venceu " : "Verificar em "}
                      {formatarData(item.lembrete.proximaVerificacao)}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
    </>
  );
}

function StatTile({ valor, label, cor }) {
  return (
    <div className="card" style={{ flex: "1 1 220px", padding: "18px 20px", borderLeft: `4px solid ${cor}` }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{valor}</div>
      <div style={{ fontSize: 13, color: "var(--color-gray)", marginTop: 2 }}>{label}</div>
    </div>
  );
}
