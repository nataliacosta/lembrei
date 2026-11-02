import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Comentarios from "../components/Comentarios";
import { useAuth } from "../contexts/AuthContext";
import { useUsuarios } from "../hooks/useUsuarios";
import { TIPO_POR_KEY, PAPEIS } from "../lib/constants";
import { formatarData } from "../lib/datas";
import { excluirItem, marcarConcluido, watchFrente, watchItem } from "../lib/firestore";

export default function ItemDetailPage() {
  const { frenteId, itemId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const veioDoPainel = location.state?.from === "dashboard";
  const veioDoContrato = location.state?.from === "contrato" && location.state?.contratoId;
  const [frente, setFrente] = useState(undefined);
  const [item, setItem] = useState(undefined);

  useEffect(() => {
    const unsub = watchFrente(frenteId, setFrente);
    return unsub;
  }, [frenteId]);

  useEffect(() => {
    const unsub = watchItem(frenteId, itemId, setItem);
    return unsub;
  }, [frenteId, itemId]);

  const membros = useUsuarios(frente?.membrosUids || []);

  if (frente === undefined || item === undefined) return <div className="spinner-wrap">Carregando...</div>;
  if (!frente || !item) return <div className="spinner-wrap">Item não encontrado.</div>;

  const papel = frente.membros?.[user.uid];
  const podeEditar = papel === "proprietario" || papel === "editor";
  const tipo = TIPO_POR_KEY[item.tipo];
  const criador = membros[item.criadoPor];

  async function alternarConcluido() {
    await marcarConcluido(frenteId, itemId, !item.concluido);
  }

  async function excluir() {
    if (!window.confirm(`Excluir o item "${item.titulo}"? Essa ação não pode ser desfeita.`)) return;
    await excluirItem(frenteId, itemId);
    navigate(`/frentes/${frenteId}`);
  }

  return (
    <div className="page-shell" style={{ maxWidth: 780, margin: "0 auto", paddingTop: 32, paddingBottom: 80 }}>
        <Link
          to={veioDoPainel ? "/dashboard" : veioDoContrato ? `/contratos/${location.state.contratoId}` : `/frentes/${frenteId}`}
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          {veioDoPainel ? "← Voltar para o Painel geral" : veioDoContrato ? "← Voltar para o contrato" : `← Voltar para ${frente.nome}`}
        </Link>

        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <span className="pill" style={{ background: "rgba(0,153,146,0.12)", color: "var(--color-primary)" }}>
              {tipo?.label}
            </span>
            {item.concluido ? (
              <span className="pill" style={{ background: "#F3F3F3", color: "var(--color-gray)" }}>
                Concluído
              </span>
            ) : (
              item.status && (
                <span className="pill" style={{ background: "rgba(0,212,192,0.2)", color: "var(--color-dark)" }}>
                  {item.status}
                </span>
              )
            )}
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, lineHeight: 1.3 }}>{item.titulo}</h1>
        </div>

        {item.descricao && (
          <p style={{ margin: "18px 0 0 0", maxWidth: 600, fontSize: 14, lineHeight: 1.6 }}>{item.descricao}</p>
        )}

        <div style={{ margin: "28px 0 28px 0", display: "flex", gap: 10, flexWrap: "wrap" }}>
          {podeEditar && (
            <Link to={`/frentes/${frenteId}/itens/${itemId}/editar`} className="btn btn-primary">
              Editar
            </Link>
          )}
          {podeEditar && (
            <button onClick={alternarConcluido} className="btn btn-outline">
              {item.concluido ? "Reabrir item" : "Marcar como concluído"}
            </button>
          )}
          {podeEditar && (
            <button onClick={excluir} className="btn btn-ghost" style={{ color: "var(--color-orange)", borderColor: "var(--color-orange)" }}>
              Excluir item
            </button>
          )}
          {!podeEditar && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 4px", fontSize: 12, color: "var(--color-gray)" }}>
              Seu acesso a esta frente: <b style={{ color: "var(--color-dark)" }}>{PAPEIS[papel] || "Sem acesso"}</b>
            </div>
          )}
        </div>

        {podeEditar && (
          <div style={{ padding: "10px 14px", background: "var(--color-bg-soft)", borderRadius: 8, fontSize: 12, color: "var(--color-gray)", maxWidth: 560, marginBottom: 28 }}>
            Itens concluídos saem dos alertas do painel geral e passam para a aba "Concluídos" desta frente.
          </div>
        )}

        <div className="meta-grid" style={{ padding: "20px 0", borderTop: "1px solid var(--color-gray-light)", borderBottom: "1px solid var(--color-gray-light)" }}>
          <Meta label="Responsável" valor={item.responsavelNome || "—"} />
          <Meta label="Criado por" valor={`${criador?.nome || "—"} · ${formatarData(item.criadoEm)}`} />
          <Meta label="Última atualização" valor={formatarData(item.atualizadoEm)} />
          {item.prazo && <Meta label="Prazo" valor={formatarData(item.prazo)} />}
        </div>

        {item.camposCustom?.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <SectionTitle>Campos personalizados</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
              {item.camposCustom.map((c, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 14 }}>
                  <span style={{ color: "var(--color-gray)" }}>{c.label}</span>
                  <span style={{ fontWeight: 500, textAlign: "right" }}>{c.valor}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {item.tags?.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionTitle>Tags</SectionTitle>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {item.tags.map((t) => (
                <span key={t} className="tag-chip">
                  #{t}
                </span>
              ))}
            </div>
          </div>
        )}

        {item.lembrete?.ativo && (
          <div style={{ marginTop: 28, maxWidth: 560, background: "rgba(0,212,192,0.1)", border: "1px solid rgba(0,212,192,0.4)", borderRadius: 10, padding: "18px 20px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Lembrete</div>
            <div className="sub-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12 }}>
              <Meta label="Próxima verificação" valor={formatarData(item.lembrete.proximaVerificacao)} />
              <Meta label="Status do lembrete" valor={item.lembrete.status === "pendente" ? "Pendente" : item.lembrete.status} />
            </div>
            {item.lembrete.mensagem && <Meta label="Mensagem" valor={item.lembrete.mensagem} />}
            {item.lembrete.recorrente && (
              <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 10 }}>Repete se não houver retorno até a data.</div>
            )}
          </div>
        )}

        <Comentarios caminhoPai={["frentes", frenteId, "itens", itemId]} />
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
