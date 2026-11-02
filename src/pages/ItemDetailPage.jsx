import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Comentarios from "../components/Comentarios";
import LembreteAcoes from "../components/LembreteAcoes";
import ReuniaoDetalhe from "../components/ReuniaoDetalhe";
import { IconeCheck, IconeSino } from "../components/Icones";
import { useAuth } from "../contexts/AuthContext";
import { BotaoVoltar, useVoltar } from "../contexts/HistoricoContext";
import { useUsuarios } from "../hooks/useUsuarios";
import { TIPO_POR_KEY, PAPEIS } from "../lib/constants";
import { diasAte, formatarData, formatarDataRelativa } from "../lib/datas";
import { excluirItem, marcarConcluido, watchFrente, watchItem } from "../lib/firestore";

function descreverPrazo(prazo) {
  const dias = diasAte(prazo);
  if (dias === null) return "";
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias > 1) return `em ${dias} dias`;
  return `atrasado há ${-dias} ${dias === -1 ? "dia" : "dias"}`;
}

export default function ItemDetailPage() {
  const { frenteId, itemId } = useParams();
  const { user } = useAuth();
  const { voltar } = useVoltar(`/frentes/${frenteId}`);

  const [frente, setFrente] = useState(undefined);
  const [item, setItem] = useState(undefined);

  useEffect(() => watchFrente(frenteId, setFrente), [frenteId]);
  useEffect(() => watchItem(frenteId, itemId, setItem), [frenteId, itemId]);

  const membros = useUsuarios(frente?.membrosUids || []);

  if (frente === undefined || item === undefined) return <div className="spinner-wrap">Carregando...</div>;
  if (!frente || !item) return <div className="spinner-wrap">Item não encontrado.</div>;

  const papel = frente.membros?.[user.uid];
  const podeEditar = papel === "proprietario" || papel === "editor";
  const tipo = TIPO_POR_KEY[item.tipo];
  const criador = membros[item.criadoPor];
  const lembreteAtivo = item.lembrete?.ativo && item.lembrete.proximaVerificacao;
  const diasLembrete = lembreteAtivo ? diasAte(item.lembrete.proximaVerificacao) : null;
  const lembreteAtrasado = diasLembrete !== null && diasLembrete < 0;
  const prazoAtrasado = !item.concluido && item.prazo && diasAte(item.prazo) < 0;

  const cartaoLembrete = lembreteAtivo && !item.concluido ? (
            <div
              className="lista-card"
              style={{
                padding: 16,
                background: lembreteAtrasado ? "var(--color-orange-soft)" : "rgba(0,212,192,0.08)",
                borderColor: lembreteAtrasado ? "var(--color-orange-border)" : "rgba(0,212,192,0.4)",
              }}
            >
              <div className={lembreteAtrasado ? "texto-alerta" : ""} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700 }}>
                <IconeSino size={18} />
                {lembreteAtrasado ? "Lembrete atrasado" : "Lembrete"} · {formatarDataRelativa(item.lembrete.proximaVerificacao)}
              </div>
              {item.lembrete.mensagem && <div style={{ fontSize: 14, marginTop: 6 }}>{item.lembrete.mensagem}</div>}
              {item.lembrete.recorrente && (
                <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 6 }}>
                  Ao ter retorno, pergunta se ainda precisa acompanhar.
                </div>
              )}
              {podeEditar && (
                <div style={{ marginTop: 12 }}>
                  <LembreteAcoes item={{ ...item, frenteId }} comOutraData />
                </div>
              )}
            </div>
          ) : null;

  async function alternarConcluido() {
    await marcarConcluido(frenteId, itemId, !item.concluido);
  }

  async function excluir() {
    if (!window.confirm(`Excluir o item "${item.titulo}"? Essa ação não pode ser desfeita.`)) return;
    await excluirItem(frenteId, itemId);
    voltar();
  }

  if (item.tipo === "reuniao" && item.reuniao) {
    return <ReuniaoDetalhe item={item} frenteId={frenteId} papel={papel} podeEditar={podeEditar} onExcluir={excluir} />;
  }


  return (
    <div className={`page-shell ${podeEditar ? "tem-acoes-fixas" : ""}`} style={{ paddingTop: 24, paddingBottom: 60, maxWidth: 1180 }}>
      <BotaoVoltar destinoPadrao={`/frentes/${frenteId}`} />

      <div className="detalhe-layout" style={{ marginTop: 16 }}>
        <div className="detalhe-principal">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <span className="pill pill-tipo">{tipo?.label}</span>
            {item.concluido ? (
              <span className="pill" style={{ background: "#eceeee", color: "var(--color-gray)" }}>
                Concluído
              </span>
            ) : (
              item.status && (
                <span className="pill" style={{ background: "rgba(0,212,192,0.22)", color: "var(--color-dark)" }}>
                  {item.status}
                </span>
              )
            )}
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, lineHeight: 1.3 }}>{item.titulo}</h1>

          {podeEditar ? (
            <div className="acoes-fixas" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
              <button onClick={alternarConcluido} className="btn btn-primary">
                {!item.concluido && <IconeCheck size={18} />}
                {item.concluido ? "Reabrir item" : "Marcar como concluído"}
              </button>
              <Link to={`/frentes/${frenteId}/itens/${itemId}/editar`} className="btn btn-ghost">
                Editar
              </Link>
              <button
                onClick={excluir}
                className="btn btn-ghost so-desktop"
                style={{ color: "var(--color-orange)", borderColor: "var(--color-orange-border)" }}
              >
                Excluir
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 14, fontSize: 13, color: "var(--color-gray)" }}>
              Seu acesso a esta frente: <b style={{ color: "var(--color-dark)" }}>{PAPEIS[papel] || "Sem acesso"}</b>
            </div>
          )}

          {cartaoLembrete && (
            <div className="so-mobile" style={{ marginTop: 18 }}>
              {cartaoLembrete}
            </div>
          )}

          {item.descricao && (
            <>
              <SectionTitle>Descrição</SectionTitle>
              <p style={{ margin: 0, maxWidth: 640, fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{item.descricao}</p>
            </>
          )}

          {item.tags?.length > 0 && (
            <>
              <SectionTitle>Tags</SectionTitle>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {item.tags.map((t) => (
                  <span key={t} className="tag-chip">
                    #{t}
                  </span>
                ))}
              </div>
            </>
          )}

          <div style={{ maxWidth: 640 }}>
            <Comentarios caminhoPai={["frentes", frenteId, "itens", itemId]} />
          </div>
        </div>

        <aside className="detalhe-lateral">
          {cartaoLembrete && <div className="so-desktop">{cartaoLembrete}</div>}

          <div className="lista-card">
            {item.prazo && (
              <div className="info-linha">
                <span>Prazo</span>
                <span className={prazoAtrasado ? "texto-alerta" : ""}>
                  {formatarData(item.prazo)} · {descreverPrazo(item.prazo)}
                </span>
              </div>
            )}
            <div className="info-linha">
              <span>Responsável</span>
              <span>{item.responsavelNome || "—"}</span>
            </div>
            <div className="info-linha">
              <span>Criado por</span>
              <span>
                {criador?.nome || "—"} · {formatarData(item.criadoEm)}
              </span>
            </div>
            <div className="info-linha">
              <span>Atualizado</span>
              <span>{formatarData(item.atualizadoEm)}</span>
            </div>
          </div>

          {item.camposCustom?.length > 0 && (
            <div className="lista-card">
              <div style={{ padding: "10px 16px 0" }}>
                <SectionTitle margem={false}>Campos personalizados</SectionTitle>
              </div>
              {item.camposCustom.map((c, i) => (
                <div key={i} className="info-linha" style={i === 0 ? { borderTop: "none" } : undefined}>
                  <span>{c.label}</span>
                  <span>{c.valor}</span>
                </div>
              ))}
            </div>
          )}

          {podeEditar && (
            <button
              onClick={excluir}
              className="btn btn-ghost so-mobile"
              style={{ color: "var(--color-orange)", borderColor: "var(--color-orange-border)" }}
            >
              Excluir item
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ children, margem = true }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: "var(--color-gray)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        margin: margem ? "24px 0 8px" : "0 0 4px",
      }}
    >
      {children}
    </div>
  );
}
