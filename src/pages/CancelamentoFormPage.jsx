import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { criarCancelamento, watchContrato } from "../lib/contratos";
import { deInputDate } from "../lib/datas";

export default function CancelamentoFormPage() {
  const { contratoId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contrato, setContrato] = useState(undefined);

  const [dataSolicitacao, setDataSolicitacao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const unsub = watchContrato(contratoId, setContrato);
    return unsub;
  }, [contratoId]);

  if (contrato === undefined) return <div className="spinner-wrap">Carregando...</div>;
  if (!contrato) return <div className="spinner-wrap">Contrato não encontrado.</div>;

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    await criarCancelamento(contratoId, {
      uid: user.uid,
      dataSolicitacao: deInputDate(dataSolicitacao),
      motivo: motivo.trim(),
    });
    setSalvando(false);
    navigate(`/contratos/${contratoId}`);
  }

  function cancelar() {
    navigate(`/contratos/${contratoId}`);
  }

  return (
    <div className="modal-overlay" style={{ width: "100%", minHeight: "100vh", background: "rgba(0,51,45,0.55)", display: "flex", justifyContent: "center" }}>
      <form onSubmit={salvar} className="card" style={{ width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(0,51,45,0.25)", overflow: "hidden" }}>
        <div className="modal-body-pad" style={{ paddingTop: 24, paddingBottom: 24, borderBottom: "1px solid var(--color-gray-light)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Solicitar cancelamento</h2>
            <div style={{ fontSize: 13, color: "var(--color-gray)", marginTop: 2 }}>{contrato.titulo}</div>
          </div>
          <button type="button" onClick={cancelar} style={{ fontSize: 20, color: "var(--color-gray)", background: "none", border: "none" }} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-body-pad" style={{ paddingTop: 24, paddingBottom: 8 }}>
          <div style={{ marginBottom: 18, maxWidth: 220 }}>
            <label>Data da solicitação</label>
            <input type="date" value={dataSolicitacao} onChange={(e) => setDataSolicitacao(e.target.value)} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label>Motivo do cancelamento</label>
            <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ resize: "vertical" }} />
          </div>

          <div style={{ padding: "10px 14px", background: "rgba(238,115,27,0.1)", borderRadius: 8, fontSize: 12, color: "var(--color-orange)" }}>
            O contrato vai pra "Cancelamento em andamento" até você finalizar esse cancelamento na tela do contrato.
          </div>
        </div>

        <div className="modal-body-pad" style={{ paddingTop: 20, paddingBottom: 20, borderTop: "1px solid var(--color-gray-light)", display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button type="button" onClick={cancelar} className="btn btn-ghost">
            Voltar
          </button>
          <button type="submit" disabled={salvando} className="btn btn-primary">
            {salvando ? "Salvando..." : "Solicitar cancelamento"}
          </button>
        </div>
      </form>
    </div>
  );
}
