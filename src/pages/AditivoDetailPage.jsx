import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Comentarios from "../components/Comentarios";
import { useAuth } from "../contexts/AuthContext";
import { PAPEIS } from "../lib/constants";
import { formatarData } from "../lib/datas";
import { finalizarAditivo, watchAditivo, watchContrato } from "../lib/contratos";

export default function AditivoDetailPage() {
  const { contratoId, aditivoId } = useParams();
  const { user } = useAuth();
  const [contrato, setContrato] = useState(undefined);
  const [aditivo, setAditivo] = useState(undefined);

  useEffect(() => {
    const unsub = watchContrato(contratoId, setContrato);
    return unsub;
  }, [contratoId]);

  useEffect(() => {
    const unsub = watchAditivo(contratoId, aditivoId, setAditivo);
    return unsub;
  }, [contratoId, aditivoId]);

  if (contrato === undefined || aditivo === undefined) return <div className="spinner-wrap">Carregando...</div>;
  if (!contrato || !aditivo) return <div className="spinner-wrap">Aditivo não encontrado.</div>;

  const papel = contrato.membros?.[user.uid];
  const podeEditar = papel === "proprietario" || papel === "editor";

  async function concluir() {
    if (!window.confirm("Finalizar este aditivo e voltar o contrato para Ativo?")) return;
    await finalizarAditivo(contratoId, aditivoId);
  }

  return (
    <div className="page-shell" style={{ maxWidth: 780, margin: "0 auto", paddingTop: 32, paddingBottom: 80 }}>
        <Link to={`/contratos/${contratoId}`} style={{ fontSize: 13, fontWeight: 600 }}>
          ← Voltar para {contrato.titulo}
        </Link>

        <div style={{ marginTop: 20, marginBottom: 8 }}>
          <span className="pill" style={{ background: aditivo.finalizado ? "#F3F3F3" : "rgba(0,212,192,0.2)", color: aditivo.finalizado ? "var(--color-gray)" : "var(--color-dark)" }}>
            {aditivo.finalizado ? "Finalizado" : "Em andamento"}
          </span>
          <h1 style={{ margin: "10px 0 0 0", fontSize: 22, fontWeight: 700 }}>
            Aditivo · {(aditivo.tipo || []).join(", ") || "—"}
          </h1>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "20px 0 28px 0" }}>
          {podeEditar && (
            <Link to={`/contratos/${contratoId}/aditivos/${aditivoId}/editar`} className="btn btn-primary">
              Editar
            </Link>
          )}
          {podeEditar && !aditivo.finalizado && (
            <button onClick={concluir} className="btn btn-outline">
              Finalizar aditivo
            </button>
          )}
          {!podeEditar && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 4px", fontSize: 12, color: "var(--color-gray)" }}>
              Seu acesso: <b style={{ color: "var(--color-dark)" }}>{PAPEIS[papel] || "Sem acesso"}</b>
            </div>
          )}
        </div>

        <div className="meta-grid" style={{ padding: "16px 0", borderTop: "1px solid var(--color-gray-light)", borderBottom: "1px solid var(--color-gray-light)" }}>
          <Meta label="Data da solicitação" valor={aditivo.dataSolicitacao ? formatarData(aditivo.dataSolicitacao) : "—"} />
          <Meta label="Pendente em" valor={aditivo.pendenteEm || "—"} />
          <Meta label="Número da RQS" valor={aditivo.numeroRQS || "—"} />
          {aditivo.finalizado && <Meta label="Finalizado em" valor={formatarData(aditivo.finalizadoEm)} />}
        </div>

        {aditivo.motivo && (
          <div style={{ marginTop: 24 }}>
            <SectionTitle>Motivo</SectionTitle>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, maxWidth: 600 }}>{aditivo.motivo}</p>
          </div>
        )}

        <Comentarios caminhoPai={["contratos", contratoId, "aditivos", aditivoId]} />
      </div>
  );
}

function Meta({ label, valor }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--color-gray)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{valor}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-gray)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
      {children}
    </div>
  );
}
