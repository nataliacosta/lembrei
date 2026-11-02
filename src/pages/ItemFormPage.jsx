import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useUsuarios } from "../hooks/useUsuarios";
import { CAMPO_CONTRATO_LABEL, FRENTE_CONTRATOS_ID, TIPOS, STATUS_OPCOES, TIPO_POR_KEY } from "../lib/constants";
import { deInputDate, paraInputDate } from "../lib/datas";
import { atualizarItem, criarItem, watchFrente, watchItem } from "../lib/firestore";
import { watchContrato } from "../lib/contratos";
import TagInput from "../components/TagInput";
import CustomFieldsEditor from "../components/CustomFieldsEditor";

const LEMBRETE_VAZIO = { ativo: false, proximaVerificacao: null, mensagem: "", recorrente: false, status: "pendente" };

export default function ItemFormPage() {
  const { frenteId: frenteIdParam, contratoId, itemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const editando = Boolean(itemId);
  // Criado a partir da tela de um contrato: a frente é sempre a "Contratos",
  // e o item já nasce com o campo personalizado "Contrato" preenchido.
  const viaContrato = Boolean(contratoId) && !editando;
  const frenteId = viaContrato ? FRENTE_CONTRATOS_ID : frenteIdParam;

  const [frente, setFrente] = useState(null);
  const [contrato, setContrato] = useState(viaContrato ? undefined : null);
  const [itemOriginal, setItemOriginal] = useState(editando ? undefined : null);

  const [tipo, setTipo] = useState("tarefa");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState(STATUS_OPCOES[0]);
  const [prazo, setPrazo] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [responsavelLivre, setResponsavelLivre] = useState("");
  const [camposCustom, setCamposCustom] = useState(
    viaContrato ? [{ label: CAMPO_CONTRATO_LABEL, valor: contratoId }] : []
  );
  const [tags, setTags] = useState([]);
  const [lembrete, setLembrete] = useState(LEMBRETE_VAZIO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const unsub = watchFrente(frenteId, setFrente);
    return unsub;
  }, [frenteId]);

  useEffect(() => {
    if (!viaContrato) return;
    const unsub = watchContrato(contratoId, setContrato);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viaContrato, contratoId]);

  useEffect(() => {
    if (!editando) return;
    const unsub = watchItem(frenteId, itemId, (item) => {
      setItemOriginal(item);
      if (item) {
        setTipo(item.tipo);
        setTitulo(item.titulo);
        setDescricao(item.descricao || "");
        setStatus(item.status || STATUS_OPCOES[0]);
        setPrazo(paraInputDate(item.prazo));
        if (item.responsavelId) {
          setResponsavelId(item.responsavelId);
          setResponsavelLivre("");
        } else if (item.responsavelNome) {
          setResponsavelId("__outro__");
          setResponsavelLivre(item.responsavelNome);
        } else {
          setResponsavelId("");
          setResponsavelLivre("");
        }
        setCamposCustom(item.camposCustom || []);
        setTags(item.tags || []);
        setLembrete(item.lembrete || LEMBRETE_VAZIO);
      }
    });
    return unsub;
  }, [editando, frenteId, itemId]);

  const membros = useUsuarios(frente?.membrosUids || []);
  const temStatusPrazo = TIPO_POR_KEY[tipo]?.temStatusPrazo;

  if (!frente || (editando && itemOriginal === undefined) || (viaContrato && contrato === undefined)) {
    return <div className="spinner-wrap">Carregando...</div>;
  }

  async function salvar(e) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setSalvando(true);

    let respId = null;
    let respNome = null;
    if (responsavelId === "__outro__") {
      respNome = responsavelLivre.trim() || null;
    } else if (responsavelId) {
      respId = responsavelId;
      respNome = membros[responsavelId]?.nome || null;
    }

    const dados = {
      tipo,
      titulo: titulo.trim(),
      descricao,
      status: temStatusPrazo ? status : null,
      prazo: temStatusPrazo ? deInputDate(prazo) : null,
      responsavelId: respId,
      responsavelNome: respNome,
      camposCustom: camposCustom.filter((c) => c.label.trim()),
      tags,
      lembrete: lembrete.ativo ? lembrete : null,
    };

    if (editando) {
      await atualizarItem(frenteId, itemId, dados);
      navigate(`/frentes/${frenteId}/itens/${itemId}`);
    } else {
      const ref = await criarItem(frenteId, {
        ...dados,
        uid: user.uid,
        membrosUids: frente.membrosUids,
        contratoVinculado: viaContrato ? contratoId : null,
      });
      navigate(viaContrato ? `/contratos/${contratoId}` : `/frentes/${frenteId}/itens/${ref.id}`);
    }
    setSalvando(false);
  }

  function cancelar() {
    if (editando) navigate(`/frentes/${frenteId}/itens/${itemId}`);
    else if (viaContrato) navigate(`/contratos/${contratoId}`);
    else navigate(`/frentes/${frenteId}`);
  }

  return (
    <div className="modal-overlay" style={{ width: "100%", minHeight: "100vh", background: "rgba(0,51,45,0.55)", display: "flex", justifyContent: "center" }}>
      <form
        onSubmit={salvar}
        className="card"
        style={{ width: "100%", maxWidth: 720, boxShadow: "0 20px 60px rgba(0,51,45,0.25)", overflow: "hidden" }}
      >
        <div className="modal-body-pad" style={{ paddingTop: 24, paddingBottom: 24, borderBottom: "1px solid var(--color-gray-light)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editando ? "Editar item" : "Novo item"}</h2>
            <div style={{ fontSize: 13, color: "var(--color-gray)", marginTop: 2 }}>
              {viaContrato ? `Contrato: ${contrato.titulo}` : `Frente: ${frente.nome}`}
            </div>
          </div>
          <button type="button" onClick={cancelar} style={{ fontSize: 20, color: "var(--color-gray)", background: "none", border: "none" }} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-body-pad" style={{ paddingTop: 28, paddingBottom: 8 }}>
          <label>Tipo de item</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            {TIPOS.map((t) => {
              const selecionado = t.key === tipo;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTipo(t.key)}
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
                  {t.label}
                </button>
              );
            })}
          </div>

          <div style={{ marginBottom: 18 }}>
            <label>Título</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label>Descrição</label>
            <textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} style={{ resize: "vertical" }} />
          </div>

          <div className="field-row" style={{ marginBottom: responsavelId === "__outro__" ? 10 : 18 }}>
            <div>
              <label>Responsável</label>
              <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
                <option value="">— selecionar —</option>
                {(frente.membrosUids || []).map((uid) => (
                  <option key={uid} value={uid}>
                    {membros[uid]?.nome || "..."}
                  </option>
                ))}
                <option value="__outro__">Outro (digitar nome)</option>
              </select>
            </div>
            {temStatusPrazo && (
              <div>
                <label>Prazo</label>
                <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              </div>
            )}
          </div>

          {responsavelId === "__outro__" && (
            <div style={{ marginBottom: 18 }}>
              <input
                value={responsavelLivre}
                onChange={(e) => setResponsavelLivre(e.target.value)}
                placeholder="Nome do responsável"
              />
            </div>
          )}

          {temStatusPrazo && (
            <div style={{ marginBottom: 18 }}>
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPCOES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <label>Campos personalizados</label>
            <CustomFieldsEditor campos={camposCustom} onChange={setCamposCustom} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label>Tags</label>
            <TagInput tags={tags} onChange={setTags} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={lembrete.ativo}
                onChange={(e) => setLembrete({ ...lembrete, ativo: e.target.checked })}
                style={{ width: "auto" }}
              />
              Adicionar lembrete de verificação a este item
            </label>
          </div>

          {lembrete.ativo && (
            <div style={{ background: "rgba(0,212,192,0.1)", border: "1px solid rgba(0,212,192,0.4)", borderRadius: 10, padding: "18px 20px", marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Lembrete deste item</div>
              <div className="field-row" style={{ marginBottom: 14 }}>
                <div>
                  <label>Próxima verificação</label>
                  <input
                    type="date"
                    value={paraInputDate(lembrete.proximaVerificacao)}
                    onChange={(e) => setLembrete({ ...lembrete, proximaVerificacao: deInputDate(e.target.value) })}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label>Mensagem do lembrete</label>
                <input
                  value={lembrete.mensagem}
                  onChange={(e) => setLembrete({ ...lembrete, mensagem: e.target.value })}
                  placeholder="Ex: Cobrar retorno do fornecedor"
                />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={lembrete.recorrente}
                  onChange={(e) => setLembrete({ ...lembrete, recorrente: e.target.checked })}
                  style={{ width: "auto" }}
                />
                Se houver retorno, perguntar se ainda preciso acompanhar antes de encerrar
              </label>
            </div>
          )}
        </div>

        <div className="modal-body-pad" style={{ paddingTop: 20, paddingBottom: 20, borderTop: "1px solid var(--color-gray-light)", display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button type="button" onClick={cancelar} className="btn btn-ghost">
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className="btn btn-primary">
            {salvando ? "Salvando..." : "Salvar item"}
          </button>
        </div>
      </form>
    </div>
  );
}
