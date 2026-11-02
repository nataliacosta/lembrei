import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useVoltar } from "../contexts/HistoricoContext";
import { useDados } from "../contexts/DadosContext";
import { useUsuarios } from "../hooks/useUsuarios";
import { CAMPO_CONTRATO_LABEL, FRENTE_CONTRATOS_ID, TIPOS, STATUS_OPCOES, TIPO_POR_KEY } from "../lib/constants";
import { deInputDate, inicioDoDia, paraInputDate, somarDias } from "../lib/datas";
import { atualizarItem, criarItem, watchFrente, watchItem } from "../lib/firestore";
import { notificar } from "../lib/notificacoes";
import { watchContrato } from "../lib/contratos";
import TagInput from "../components/TagInput";
import CustomFieldsEditor from "../components/CustomFieldsEditor";
import ReuniaoCampos, { formularioParaReuniao, reuniaoParaFormulario } from "../components/ReuniaoCampos";

const LEMBRETE_VAZIO = { ativo: false, proximaVerificacao: null, mensagem: "", recorrente: false, status: "pendente" };
const CHAVE_ULTIMA_FRENTE = "lembrei:ultimaFrente";

// Datas locais em "AAAA-MM-DD" (sem passar por UTC, que pode trocar o dia).
function paraInput(data) {
  const p = (n) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

function proximoDiaDaSemana(diaSemana) {
  const hoje = inicioDoDia();
  const faltam = (diaSemana - hoje.getDay() + 7) % 7 || 7;
  return somarDias(hoje, faltam);
}

function atalhosDePrazo() {
  const hoje = inicioDoDia();
  const sexta = proximoDiaDaSemana(5);
  return [
    { label: "Hoje", valor: paraInput(hoje) },
    { label: "Amanhã", valor: paraInput(somarDias(hoje, 1)) },
    { label: `Sexta (${String(sexta.getDate()).padStart(2, "0")}/${String(sexta.getMonth() + 1).padStart(2, "0")})`, valor: paraInput(sexta) },
    { label: "Próx. segunda", valor: paraInput(proximoDiaDaSemana(1)) },
    { label: "Sem prazo", valor: "" },
  ];
}

function atalhosDeLembrete() {
  const hoje = inicioDoDia();
  return [
    { label: "Em 2 dias", valor: paraInput(somarDias(hoje, 2)) },
    { label: "Em 1 semana", valor: paraInput(somarDias(hoje, 7)) },
    { label: "Em 2 semanas", valor: paraInput(somarDias(hoje, 14)) },
  ];
}

function lerUltimaFrente() {
  try {
    return localStorage.getItem(CHAVE_ULTIMA_FRENTE) || "";
  } catch {
    return "";
  }
}

function salvarUltimaFrente(id) {
  try {
    localStorage.setItem(CHAVE_ULTIMA_FRENTE, id);
  } catch {
    // Sem localStorage: só não lembra a última frente.
  }
}

export default function ItemFormPage() {
  const { frenteId: frenteIdParam, contratoId, itemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { voltar, temAnterior } = useVoltar(
    itemId ? `/frentes/${frenteIdParam}/itens/${itemId}` : contratoId ? `/contratos/${contratoId}` : frenteIdParam ? `/frentes/${frenteIdParam}` : "/dashboard"
  );
  const { frentes } = useDados();
  const editando = Boolean(itemId);
  // Criado a partir da tela de um contrato: a frente é sempre a "Contratos",
  // e o item já nasce com o campo personalizado "Contrato" preenchido.
  const viaContrato = Boolean(contratoId) && !editando;
  // Criado pelo botão "+ Novo item" geral (/novo): a pessoa escolhe a frente.
  const escolheFrente = !frenteIdParam && !viaContrato && !editando;

  const frentesEditaveis = frentes.filter((f) => ["proprietario", "editor"].includes(f.membros?.[user.uid]));
  const [frenteEscolhida, setFrenteEscolhida] = useState(lerUltimaFrente);
  const frenteEscolhidaValida = frentesEditaveis.some((f) => f.id === frenteEscolhida)
    ? frenteEscolhida
    : frentesEditaveis[0]?.id || "";

  const frenteId = viaContrato ? FRENTE_CONTRATOS_ID : escolheFrente ? frenteEscolhidaValida : frenteIdParam;

  const [frente, setFrente] = useState(null);
  const [contrato, setContrato] = useState(viaContrato ? undefined : null);
  const [itemOriginal, setItemOriginal] = useState(editando ? undefined : null);

  const [tipo, setTipo] = useState("tarefa");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState(STATUS_OPCOES[0]);
  const [prazo, setPrazo] = useState("");
  const [responsavelId, setResponsavelId] = useState(editando ? "" : user.uid);
  const [responsavelLivre, setResponsavelLivre] = useState("");
  const [camposCustom, setCamposCustom] = useState(
    viaContrato ? [{ label: CAMPO_CONTRATO_LABEL, valor: contratoId }] : []
  );
  const [tags, setTags] = useState([]);
  const [lembrete, setLembrete] = useState(LEMBRETE_VAZIO);
  const [reuniao, setReuniao] = useState(() => reuniaoParaFormulario(null));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!frenteId) return;
    return watchFrente(frenteId, setFrente);
  }, [frenteId]);

  useEffect(() => {
    if (!viaContrato) return;
    return watchContrato(contratoId, setContrato);
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
        setReuniao(reuniaoParaFormulario(item.reuniao));
      }
    });
    return unsub;
  }, [editando, frenteId, itemId]);

  const membros = useUsuarios(frente?.membrosUids || []);
  const temStatusPrazo = TIPO_POR_KEY[tipo]?.temStatusPrazo;
  const ehReuniao = tipo === "reuniao";
  const nomeDe = (uid) => membros[uid]?.nome || (uid === user.uid ? user.displayName : "") || "";

  if (escolheFrente && frentesEditaveis.length === 0) {
    return (
      <div className="spinner-wrap" style={{ flexDirection: "column", gap: 12, textAlign: "center", padding: 24 }}>
        {frentes.length === 0 ? "Carregando..." : "Você ainda não pode criar itens em nenhuma frente. Crie uma frente primeiro."}
      </div>
    );
  }

  if (!frente || frente.id !== frenteId || (editando && itemOriginal === undefined) || (viaContrato && contrato === undefined)) {
    return <div className="spinner-wrap">Carregando...</div>;
  }

  async function salvar(e) {
    e?.preventDefault();
    if (!titulo.trim() || salvando) return;
    if (ehReuniao && !reuniao.inicio) {
      window.alert("Escolha a data da reunião.");
      return;
    }
    setSalvando(true);

    let respId = null;
    let respNome = null;
    if (responsavelId === "__outro__") {
      respNome = responsavelLivre.trim() || null;
    } else if (responsavelId) {
      respId = responsavelId;
      respNome = membros[responsavelId]?.nome || (responsavelId === user.uid ? user.displayName : null) || null;
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
      lembrete: !ehReuniao && lembrete.ativo && lembrete.proximaVerificacao ? { ...lembrete, status: "pendente" } : null,
      reuniao: ehReuniao ? formularioParaReuniao(reuniao, { original: itemOriginal?.reuniao, nomeDe }) : null,
    };

    // Avisa a nova pessoa responsável (só quando muda para alguém da frente).
    const avisarAtribuicao = (id) => {
      if (respId && respId !== user.uid && respId !== itemOriginal?.responsavelId) {
        notificar([respId], {
          tipo: "atribuido",
          alvo: dados.titulo,
          contexto: frente.nome,
          link: `/frentes/${frenteId}/itens/${id}`,
        });
      }
    };

    try {
      if (editando) {
        await atualizarItem(frenteId, itemId, dados);
        avisarAtribuicao(itemId);
        // Volta para o detalhe de onde veio (sem empilhar o formulário).
        if (temAnterior) voltar();
        else navigate(`/frentes/${frenteId}/itens/${itemId}`, { replace: true });
      } else {
        const ref = await criarItem(frenteId, {
          ...dados,
          uid: user.uid,
          membrosUids: frente.membrosUids,
          contratoVinculado: viaContrato ? contratoId : null,
        });
        avisarAtribuicao(ref.id);
        if (escolheFrente) salvarUltimaFrente(frenteId);
        // Criado a partir do contrato: volta para ele. Senão, abre o item
        // novo no lugar do formulário — o "voltar" dele leva para onde a
        // pessoa estava antes de clicar em "+ Novo item".
        if (viaContrato) voltar();
        else navigate(`/frentes/${frenteId}/itens/${ref.id}`, { replace: true });
      }
    } catch (erro) {
      console.error("Erro ao salvar item:", erro);
      window.alert("Não deu pra salvar o item. Tente de novo.");
      setSalvando(false);
    }
  }

  function cancelar() {
    voltar();
  }

  function atalhoTeclado(e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) salvar(e);
    if (e.key === "Escape") cancelar();
  }

  const lembreteValor = paraInputDate(lembrete.proximaVerificacao);
  const temDetalhes = descricao || tags.length > 0 || camposCustom.some((c) => c.label && c.label !== CAMPO_CONTRATO_LABEL);

  return (
    <div className="modal-overlay" style={{ width: "100%", minHeight: "100vh", background: "rgba(0,51,45,0.55)", display: "flex", justifyContent: "center" }}>
      <form
        onSubmit={salvar}
        onKeyDown={atalhoTeclado}
        className="card"
        style={{ width: "100%", maxWidth: 720, boxShadow: "0 20px 60px rgba(0,51,45,0.25)", overflow: "hidden", alignSelf: "flex-start" }}
      >
        <div className="modal-body-pad" style={{ paddingTop: 18, paddingBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-gray)" }}>
            {editando ? "Editar item" : "Novo item"}
            {viaContrato && ` · Contrato: ${contrato.titulo}`}
            {!viaContrato && !escolheFrente && ` · ${frente.nome}`}
          </div>
          <button
            type="button"
            onClick={cancelar}
            style={{ fontSize: 22, color: "var(--color-gray)", background: "none", border: "none", width: 44, height: 44 }}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="modal-body-pad" style={{ paddingBottom: 8 }}>
          <label style={{ margin: 0 }}>
            <span style={{ position: "absolute", left: -9999 }}>Título</span>
            <input
              autoFocus={!editando}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="O que você precisa lembrar?"
              required
              style={{
                fontSize: 22,
                fontWeight: 600,
                border: "none",
                borderBottom: "1px solid var(--color-border)",
                borderRadius: 0,
                padding: "4px 0 12px",
              }}
            />
          </label>

          <div className="field-row" style={{ marginTop: 20 }}>
            {escolheFrente && (
              <div>
                <Rotulo>Frente</Rotulo>
                <select value={frenteId} onChange={(e) => setFrenteEscolhida(e.target.value)} aria-label="Frente">
                  {frentesEditaveis.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Rotulo>Responsável</Rotulo>
              <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} aria-label="Responsável">
                <option value="">— ninguém —</option>
                {(frente.membrosUids || []).map((uid) => (
                  <option key={uid} value={uid}>
                    {uid === user.uid ? `Eu (${membros[uid]?.nome || user.displayName || "você"})` : membros[uid]?.nome || "..."}
                  </option>
                ))}
                <option value="__outro__">Outro (digitar nome)</option>
              </select>
            </div>
          </div>
          {responsavelId === "__outro__" && (
            <input
              value={responsavelLivre}
              onChange={(e) => setResponsavelLivre(e.target.value)}
              placeholder="Nome do responsável"
              aria-label="Nome do responsável"
              style={{ marginTop: 10 }}
            />
          )}

          <div style={{ marginTop: 20 }}>
            <Rotulo>Tipo</Rotulo>
            <div className="chips-row" role="group" aria-label="Tipo de item">
              {TIPOS.map((t) => (
                <button key={t.key} type="button" className="chip" aria-pressed={t.key === tipo} onClick={() => setTipo(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {temStatusPrazo && (
            <div style={{ marginTop: 20 }}>
              <Rotulo>Prazo</Rotulo>
              <div className="prazo-rapido" role="group" aria-label="Prazo">
                {atalhosDePrazo().map((a) => (
                  <button key={a.label} type="button" className="chip" aria-pressed={prazo === a.valor} onClick={() => setPrazo(a.valor)}>
                    {a.label}
                  </button>
                ))}
                <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} aria-label="Outra data de prazo" />
              </div>
            </div>
          )}

          {ehReuniao && (
            <ReuniaoCampos
              valor={reuniao}
              onChange={setReuniao}
              membrosUids={frente.membrosUids || []}
              nomeDe={nomeDe}
              uidAtual={user.uid}
            />
          )}

          {!ehReuniao && (
            <div
              style={{
                marginTop: 20,
                padding: "14px 16px",
                borderRadius: 12,
                background: lembrete.ativo ? "rgba(0,212,192,0.08)" : "var(--color-bg-soft)",
                border: `1px solid ${lembrete.ativo ? "rgba(0,212,192,0.4)" : "var(--color-border)"}`,
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 10, margin: 0, fontSize: 14, minHeight: 32 }}>
                <input
                  type="checkbox"
                  checked={lembrete.ativo}
                  onChange={(e) =>
                    setLembrete({
                      ...lembrete,
                      ativo: e.target.checked,
                      proximaVerificacao: lembrete.proximaVerificacao || (e.target.checked ? somarDias(inicioDoDia(), 7) : null),
                    })
                  }
                  style={{ width: 18, height: 18 }}
                />
                Me lembrar de verificar
              </label>
              {lembrete.ativo && (
                <>
                  <div className="prazo-rapido" style={{ marginTop: 10 }} role="group" aria-label="Quando lembrar">
                    {atalhosDeLembrete().map((a) => (
                      <button
                        key={a.label}
                        type="button"
                        className="chip"
                        aria-pressed={lembreteValor === a.valor}
                        onClick={() => setLembrete({ ...lembrete, proximaVerificacao: deInputDate(a.valor) })}
                      >
                        {a.label}
                      </button>
                    ))}
                    <input
                      type="date"
                      value={lembreteValor}
                      onChange={(e) => setLembrete({ ...lembrete, proximaVerificacao: deInputDate(e.target.value) })}
                      aria-label="Outra data do lembrete"
                    />
                  </div>
                  <input
                    value={lembrete.mensagem}
                    onChange={(e) => setLembrete({ ...lembrete, mensagem: e.target.value })}
                    placeholder="Mensagem do lembrete. Ex: Cobrar retorno do fornecedor"
                    aria-label="Mensagem do lembrete"
                    style={{ marginTop: 10 }}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500, marginTop: 10, marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={lembrete.recorrente}
                      onChange={(e) => setLembrete({ ...lembrete, recorrente: e.target.checked })}
                      style={{ width: "auto" }}
                    />
                    Quando tiver retorno, perguntar se ainda preciso acompanhar
                  </label>
                </>
              )}
            </div>
          )}

          <details open={editando || Boolean(temDetalhes)} style={{ marginTop: 18, borderTop: "1px solid var(--color-border)", paddingTop: 14 }}>
            <summary style={{ fontSize: 14, fontWeight: 600, color: "var(--color-primary)", cursor: "pointer", minHeight: 32 }}>
              Mais detalhes: {temStatusPrazo ? "status, " : ""}descrição, tags e campos personalizados
            </summary>
            <div style={{ paddingTop: 12 }}>
              {temStatusPrazo && (
                <div style={{ marginBottom: 18 }}>
                  <Rotulo>Status</Rotulo>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
                    {STATUS_OPCOES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: 18 }}>
                <Rotulo>Descrição</Rotulo>
                <textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} style={{ resize: "vertical" }} aria-label="Descrição" />
              </div>
              <div style={{ marginBottom: 18 }}>
                <Rotulo>Tags</Rotulo>
                <TagInput tags={tags} onChange={setTags} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <Rotulo>Campos personalizados</Rotulo>
                <CustomFieldsEditor campos={camposCustom} onChange={setCamposCustom} />
              </div>
            </div>
          </details>
        </div>

        <div
          className="modal-body-pad"
          style={{
            paddingTop: 16,
            paddingBottom: 16,
            marginTop: 12,
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span className="so-desktop" style={{ fontSize: 12, color: "var(--color-gray)" }}>
            Ctrl + Enter para salvar
          </span>
          <span style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
            <button type="button" onClick={cancelar} className="btn btn-ghost">
              Cancelar
            </button>
            <button type="submit" disabled={salvando || !titulo.trim()} className="btn btn-primary">
              {salvando ? "Salvando..." : ehReuniao ? "Salvar reunião" : "Salvar item"}
            </button>
          </span>
        </div>
      </form>
    </div>
  );
}

function Rotulo({ children }) {
  return (
    <span
      style={{
        display: "block",
        fontSize: 12,
        fontWeight: 700,
        color: "var(--color-gray)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: 8,
      }}
    >
      {children}
    </span>
  );
}
