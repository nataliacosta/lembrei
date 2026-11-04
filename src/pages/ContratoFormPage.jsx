import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useVoltar } from "../contexts/HistoricoContext";

import { atualizarContrato, criarContrato, watchContrato } from "../lib/contratos";
import { deInputDate, paraInputDate } from "../lib/datas";
import { useUsuarios } from "../hooks/useUsuarios";
import { MEDICAO_PADRAO } from "../lib/medicao";

export default function ContratoFormPage() {
  const { contratoId } = useParams();
  const editando = Boolean(contratoId);
  const navigate = useNavigate();
  const { voltar, temAnterior } = useVoltar(contratoId ? `/contratos/${contratoId}` : "/contratos");
  const { user } = useAuth();

  const [contratoOriginal, setContratoOriginal] = useState(editando ? undefined : null);
  const [titulo, setTitulo] = useState("");
  const [numero, setNumero] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [escopo, setEscopo] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [medicao, setMedicao] = useState(MEDICAO_PADRAO);
  // "__outro__" = pessoa de fora do sistema (só o nome fica registrado).
  const [medicaoResp, setMedicaoResp] = useState(user.uid);
  const membros = useUsuarios(contratoOriginal?.membrosUids || [user.uid]);
  const mudarMedicao = (campos) => setMedicao((m) => ({ ...m, ...campos }));

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
        if (c.medicao) {
          setMedicao({ ...MEDICAO_PADRAO, ...c.medicao });
          setMedicaoResp(c.medicao.responsavelId || (c.medicao.responsavelNome ? "__outro__" : user.uid));
        }
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
      medicao: medicao.ativa
        ? {
            ativa: true,
            quem: medicao.quem,
            responsavelId: medicaoResp === "__outro__" ? null : medicaoResp,
            responsavelNome:
              medicaoResp === "__outro__"
                ? (medicao.responsavelNome || "").trim()
                : membros[medicaoResp]?.nome || (medicaoResp === user.uid ? user.displayName : "") || "",
            lightPlus: Boolean(medicao.lightPlus),
            diaPrazo: Math.min(31, Math.max(1, parseInt(medicao.diaPrazo, 10) || 10)),
            diasAntes: Math.min(27, Math.max(0, parseInt(medicao.diasAntes, 10) || 0)),
            // Mantém o histórico de meses já medidos.
            feitas: contratoOriginal?.medicao?.feitas || {},
          }
        : contratoOriginal?.medicao
          ? { ...contratoOriginal.medicao, ativa: false }
          : null,
    };
    if (editando) {
      await atualizarContrato(contratoId, dados);
      if (temAnterior) voltar();
      else navigate(`/contratos/${contratoId}`, { replace: true });
    } else {
      const ref = await criarContrato({ ...dados, uid: user.uid });
      navigate(`/contratos/${ref.id}`, { replace: true });
    }
    setSalvando(false);
  }

  function cancelar() {
    voltar();
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

          <div className={`caixa-medicao ${medicao.ativa ? "ativa" : ""}`}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, margin: 0, fontSize: 14, fontWeight: 700, minHeight: 32 }}>
              <input type="checkbox" checked={medicao.ativa} onChange={(e) => mudarMedicao({ ativa: e.target.checked })} style={{ width: 18, height: 18 }} />
              Tem medição mensal
            </label>
            {medicao.ativa && (
              <>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, alignItems: "flex-end" }}>
                  <div>
                    <label>Quem realiza</label>
                    <span className="segmentado" role="radiogroup" aria-label="Quem realiza a medição">
                      {["TI", "Negócio"].map((q) => (
                        <button key={q} type="button" role="radio" aria-checked={medicao.quem === q} className={medicao.quem === q ? "ativo" : ""} onClick={() => mudarMedicao({ quem: q })}>
                          {q}
                        </button>
                      ))}
                    </span>
                  </div>
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <label>Pessoa responsável</label>
                    <select value={medicaoResp} onChange={(e) => setMedicaoResp(e.target.value)} aria-label="Pessoa responsável pela medição">
                      <option value={user.uid}>Eu ({user.displayName || user.email})</option>
                      {Object.values(membros)
                        .filter((u) => u.id !== user.uid)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nome || u.email}
                          </option>
                        ))}
                      <option value="__outro__">Outra pessoa (digitar nome)</option>
                    </select>
                  </div>
                </div>
                {medicaoResp === "__outro__" && (
                  <input
                    value={medicao.responsavelNome || ""}
                    onChange={(e) => mudarMedicao({ responsavelNome: e.target.value })}
                    placeholder="Nome de quem faz a medição"
                    aria-label="Nome de quem faz a medição"
                    style={{ marginTop: 10 }}
                  />
                )}
                <div className="medicao-prazo">
                  <label className="inline">
                    Prazo: dia
                    <input type="number" min={1} max={31} value={medicao.diaPrazo} onChange={(e) => mudarMedicao({ diaPrazo: e.target.value })} aria-label="Dia do prazo da medição" />
                    de cada mês
                  </label>
                  <label className="inline">
                    Me lembrar
                    <input type="number" min={0} max={27} value={medicao.diasAntes} onChange={(e) => mudarMedicao({ diasAntes: e.target.value })} aria-label="Dias de antecedência do lembrete" />
                    dias antes
                  </label>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 0, fontSize: 14, fontWeight: 500 }}>
                  <input type="checkbox" checked={Boolean(medicao.lightPlus)} onChange={(e) => mudarMedicao({ lightPlus: e.target.checked })} style={{ width: 18, height: 18 }} />
                  Está no processo do Light+
                </label>
                <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 10 }}>
                  {medicaoResp === user.uid
                    ? `Como a medição está com você, ela aparece no seu “O que fazer” todo mês, ${medicao.diasAntes || 0} dias antes do dia ${medicao.diaPrazo || 10}.`
                    : medicaoResp === "__outro__"
                      ? "Pessoa de fora do Lembrei!: o nome fica registrado, mas ninguém recebe o lembrete."
                      : `A medição aparece no “O que fazer” de ${membros[medicaoResp]?.nome || "quem é responsável"} todo mês, ${medicao.diasAntes || 0} dias antes do dia ${medicao.diaPrazo || 10}.`}{" "}
                  Se o dia {medicao.diaPrazo || 10} cair em fim de semana ou feriado, o prazo vai para o dia útil anterior.
                </div>
              </>
            )}
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
