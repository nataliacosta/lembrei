import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { atualizarContrato, criarContrato, watchContrato } from "../lib/contratos";
import { deInputDate, paraInputDate } from "../lib/datas";

export default function ContratoFormPage() {
  const { contratoId } = useParams();
  const editando = Boolean(contratoId);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [contratoOriginal, setContratoOriginal] = useState(editando ? undefined : null);
  const [titulo, setTitulo] = useState("");
  const [numero, setNumero] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [escopo, setEscopo] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!editando) return;
    const unsub = watchContrato(contratoId, (c) => {
      setContratoOriginal(c);
      if (c) {
        setTitulo(c.titulo || "");
        setNumero(c.numero || "");
        setFornecedor(c.fornecedor || "");
        setEscopo(c.escopo || "");
        setVencimento(paraInputDate(c.vencimento));
      }
    });
    return unsub;
  }, [editando, contratoId]);

  if (editando && contratoOriginal === undefined) {
    return <div className="spinner-wrap">Carregando...</div>;
  }

  async function salvar(e) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setSalvando(true);
    const dados = {
      titulo: titulo.trim(),
      numero: numero.trim(),
      fornecedor: fornecedor.trim(),
      escopo: escopo.trim(),
      vencimento: deInputDate(vencimento),
    };
    if (editando) {
      await atualizarContrato(contratoId, dados);
      navigate(`/contratos/${contratoId}`);
    } else {
      const ref = await criarContrato({ ...dados, uid: user.uid });
      navigate(`/contratos/${ref.id}`);
    }
    setSalvando(false);
  }

  function cancelar() {
    navigate(editando ? `/contratos/${contratoId}` : "/contratos");
  }

  return (
    <div className="modal-overlay" style={{ width: "100%", minHeight: "100vh", background: "rgba(0,51,45,0.55)", display: "flex", justifyContent: "center" }}>
      <form onSubmit={salvar} className="card" style={{ width: "100%", maxWidth: 640, boxShadow: "0 20px 60px rgba(0,51,45,0.25)", overflow: "hidden" }}>
        <div className="modal-body-pad" style={{ paddingTop: 24, paddingBottom: 24, borderBottom: "1px solid var(--color-gray-light)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editando ? "Editar contrato" : "Novo contrato"}</h2>
          <button type="button" onClick={cancelar} style={{ fontSize: 20, color: "var(--color-gray)", background: "none", border: "none" }} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-body-pad" style={{ paddingTop: 24, paddingBottom: 8 }}>
          <div style={{ marginBottom: 18 }}>
            <label>Título</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Licenciamento de software XPTO" required />
          </div>

          <div className="field-row" style={{ marginBottom: 18 }}>
            <div>
              <label>Número do contrato</label>
              <input value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div>
              <label>Fornecedor</label>
              <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label>Escopo</label>
            <textarea rows={3} value={escopo} onChange={(e) => setEscopo(e.target.value)} style={{ resize: "vertical" }} />
          </div>

          <div style={{ marginBottom: 18, maxWidth: 220 }}>
            <label>Vencimento</label>
            <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          </div>
        </div>

        <div className="modal-body-pad" style={{ paddingTop: 20, paddingBottom: 20, borderTop: "1px solid var(--color-gray-light)", display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button type="button" onClick={cancelar} className="btn btn-ghost">
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className="btn btn-primary">
            {salvando ? "Salvando..." : "Salvar contrato"}
          </button>
        </div>
      </form>
    </div>
  );
}
