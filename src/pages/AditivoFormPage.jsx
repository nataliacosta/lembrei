import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useVoltar } from "../contexts/HistoricoContext";

import { atualizarAditivo, atualizarContrato, criarAditivo, watchAditivo, watchContrato } from "../lib/contratos";
import { notificar } from "../lib/notificacoes";
import { ADITIVO_TIPOS, PENDENTE_EM_OPCOES } from "../lib/constants";
import { deInputDate, paraInputDate } from "../lib/datas";

export default function AditivoFormPage() {
  const { contratoId, aditivoId } = useParams();
  const editando = Boolean(aditivoId);
  const navigate = useNavigate();
  const { voltar: voltarHistorico, temAnterior } = useVoltar(
    aditivoId ? `/contratos/${contratoId}/aditivos/${aditivoId}` : `/contratos/${contratoId}`
  );
  const { user } = useAuth();
  const [contrato, setContrato] = useState(undefined);
  const [aditivoOriginal, setAditivoOriginal] = useState(editando ? undefined : null);

  const [dataSolicitacao, setDataSolicitacao] = useState("");
  const [pendenteEm, setPendenteEm] = useState(PENDENTE_EM_OPCOES[0]);
  const [tipos, setTipos] = useState([]);
  const [numeroRQS, setNumeroRQS] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const unsub = watchContrato(contratoId, setContrato);
    return unsub;
  }, [contratoId]);

  useEffect(() => {
    if (!editando) return;
    const unsub = watchAditivo(contratoId, aditivoId, (a) => {
      setAditivoOriginal(a);
      if (a) {
        setDataSolicitacao(paraInputDate(a.dataSolicitacao));
        setPendenteEm(a.pendenteEm || PENDENTE_EM_OPCOES[0]);
        setTipos(a.tipo || []);
        setNumeroRQS(a.numeroRQS || "");
        setMotivo(a.motivo || "");
      }
    });
    return unsub;
  }, [editando, contratoId, aditivoId]);

  if (contrato === undefined || (editando && aditivoOriginal === undefined)) {
    return <div className="spinner-wrap">Carregando...</div>;
  }
  if (!contrato || (editando && !aditivoOriginal)) {
    return <div className="spinner-wrap">Aditivo não encontrado.</div>;
  }

  function alternarTipo(t) {
    setTipos((atual) => (atual.includes(t) ? atual.filter((x) => x !== t) : [...atual, t]));
  }

  function voltar() {
    voltarHistorico();
  }

  async function salvar(e) {
    e.preventDefault();
    if (tipos.length === 0) return;
    setSalvando(true);
    const dados = {
      dataSolicitacao: deInputDate(dataSolicitacao),
      pendenteEm,
      tipo: tipos,
      numeroRQS: numeroRQS.trim(),
      motivo: motivo.trim(),
    };
    if (editando) {
      await atualizarAditivo(contratoId, aditivoId, dados);
      // Se esse é o aditivo ativo, mantém o "pendente em" copiado no
      // contrato em dia (é o que a lista de contratos mostra).
      if (!aditivoOriginal.finalizado) {
        await atualizarContrato(contratoId, { aditivoAtivoPendenteEm: pendenteEm });
      }
      if (temAnterior) voltarHistorico();
      else navigate(`/contratos/${contratoId}/aditivos/${aditivoId}`, { replace: true });
    } else {
      const ref = await criarAditivo(contratoId, { ...dados, uid: user.uid, membrosUids: contrato.membrosUids });
      notificar(contrato.membrosUids || [], {
        tipo: "aditivo",
        alvo: tipos.join(", "),
        contexto: contrato.titulo,
        trecho: dados.motivo,
        link: `/contratos/${contratoId}/aditivos/${ref.id}`,
      });
      navigate(`/contratos/${contratoId}/aditivos/${ref.id}`, { replace: true });
    }
    setSalvando(false);
  }

  return (
    <div className="modal-overlay" style={{ width: "100%", minHeight: "100vh", background: "rgba(0,51,45,0.55)", display: "flex", justifyContent: "center" }}>
      <form onSubmit={salvar} className="card" style={{ width: "100%", maxWidth: 640, boxShadow: "0 20px 60px rgba(0,51,45,0.25)", overflow: "hidden" }}>
        <div className="modal-body-pad" style={{ paddingTop: 24, paddingBottom: 24, borderBottom: "1px solid var(--color-gray-light)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editando ? "Editar aditivo" : "Novo aditivo"}</h2>
            <div style={{ fontSize: 13, color: "var(--color-gray)", marginTop: 2 }}>{contrato.titulo}</div>
          </div>
          <button type="button" onClick={voltar} style={{ fontSize: 20, color: "var(--color-gray)", background: "none", border: "none" }} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-body-pad" style={{ paddingTop: 24, paddingBottom: 8 }}>
          <div className="field-row" style={{ marginBottom: 18 }}>
            <div>
              <label>Data da solicitação</label>
              <input type="date" value={dataSolicitacao} onChange={(e) => setDataSolicitacao(e.target.value)} />
            </div>
            <div>
              <label>Pendente em</label>
              <select value={pendenteEm} onChange={(e) => setPendenteEm(e.target.value)}>
                {PENDENTE_EM_OPCOES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label>Tipo (selecione uma ou mais)</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ADITIVO_TIPOS.map((t) => {
                const selecionado = tipos.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => alternarTipo(t)}
                    style={{
                      background: selecionado ? "var(--color-primary)" : "#fff",
                      color: selecionado ? "#fff" : "var(--color-dark)",
                      border: `1px solid ${selecionado ? "var(--color-primary)" : "var(--color-gray-light)"}`,
                      padding: "9px 16px",
                      borderRadius: 20,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            {tipos.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--color-orange)", marginTop: 6 }}>Selecione pelo menos um tipo.</div>
            )}
          </div>

          <div style={{ marginBottom: 18 }}>
            <label>Número da RQS</label>
            <input value={numeroRQS} onChange={(e) => setNumeroRQS(e.target.value)} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label>Motivo do aditivo</label>
            <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ resize: "vertical" }} />
          </div>
        </div>

        <div className="modal-body-pad" style={{ paddingTop: 20, paddingBottom: 20, borderTop: "1px solid var(--color-gray-light)", display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button type="button" onClick={voltar} className="btn btn-ghost">
            Cancelar
          </button>
          <button type="submit" disabled={salvando || tipos.length === 0} className="btn btn-primary">
            {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Criar aditivo"}
          </button>
        </div>
      </form>
    </div>
  );
}
