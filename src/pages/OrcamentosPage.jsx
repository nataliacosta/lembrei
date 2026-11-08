import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useDados } from "../contexts/DadosContext";
import { useUsuarios } from "../hooks/useUsuarios";
import { formatarReais } from "../lib/alocacoes";
import { ordenarVersoes, versaoVigente } from "../lib/orcamentos";
import { baixarModelos } from "../lib/orcamentosExcel";
import { watchVersoes } from "../lib/orcamentosDb";

export function PillSituacao({ situacao }) {
  return situacao === "efetivada" ? (
    <span className="pill" style={{ background: "#e0f5ef", color: "var(--color-primary-dark)" }}>
      Efetivada
    </span>
  ) : (
    <span className="pill" style={{ background: "#eceeee", color: "var(--color-gray)" }}>
      Planejamento
    </span>
  );
}

export function dataBr(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

export default function OrcamentosPage() {
  const { planejamentoId } = useParams();
  const { planejamentos } = useDados();
  const lista = planejamentoId ? planejamentos.filter((p) => p.id === planejamentoId) : planejamentos;
  const [baixando, setBaixando] = useState(false);

  return (
    <div className="page-shell" style={{ paddingTop: 24, paddingBottom: 80, maxWidth: 1180 }}>
      {planejamentoId && (
        <Link to="/orcamentos" style={{ fontSize: 13, fontWeight: 600 }}>
          ← Todos os orçamentos
        </Link>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginTop: planejamentoId ? 12 : 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>{planejamentoId && lista[0] ? `Orçamento ${lista[0].ano}` : "Orçamentos"}</h1>
          <div style={{ fontSize: 14, color: "var(--color-gray)", marginTop: 4 }}>Planejamento anual e versões efetivadas</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={baixando}
            onClick={async () => {
              setBaixando(true);
              try {
                await baixarModelos();
              } catch (e) {
                console.error(e);
                window.alert("Não deu pra gerar o modelo.");
              }
              setBaixando(false);
            }}
          >
            Baixar modelo (.xlsx)
          </button>
          <Link to="/orcamentos/novo" className="btn btn-primary">
            + Novo orçamento
          </Link>
        </div>
      </div>

      {lista.length === 0 && (
        <div className="empty-state" style={{ marginTop: 24 }}>
          {planejamentoId ? "Orçamento não encontrado (ou você não tem acesso)." : "Nenhum orçamento ainda. Comece pelo “+ Novo orçamento”."}
        </div>
      )}
      {lista.map((p) => (
        <GrupoAno key={p.id} planejamento={p} />
      ))}
      {lista.length > 0 && <div className="texto-ajuda">O painel vai usar a última versão efetivada de cada ano.</div>}
    </div>
  );
}

function GrupoAno({ planejamento }) {
  const { user } = useAuth();
  const [versoes, setVersoes] = useState(null);
  useEffect(() => watchVersoes(planejamento.id, setVersoes), [planejamento.id]);
  const membros = useUsuarios(planejamento.membrosUids || []);
  const ordenadas = ordenarVersoes(versoes || []);
  const vigente = versaoVigente(versoes || []);
  const outros = (planejamento.membrosUids || []).filter((u) => u !== user.uid);

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "26px 0 8px", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--color-gray)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {planejamento.ano} · {ordenadas.length} {ordenadas.length === 1 ? "versão" : "versões"}
        </h2>
        <span style={{ fontSize: 13 }}>
          <Link to={`/orcamentos/${planejamento.id}/compartilhar`} style={{ fontWeight: 600 }}>
            Compartilhar
          </Link>
          <span style={{ color: "var(--color-gray)" }}> · {outros.length ? ["você", ...outros.map((u) => membros[u]?.nome || "…")].join(", ") : "só você"}</span>
        </span>
      </div>
      <div className="lista-card">
        {versoes === null && <div className="secao-lateral" style={{ color: "var(--color-gray)", fontSize: 13 }}>Carregando…</div>}
        {versoes?.length === 0 && <div className="secao-lateral" style={{ color: "var(--color-gray)", fontSize: 13 }}>Nenhuma versão.</div>}
        {ordenadas.map((v) => {
          const substituida = v.situacao === "efetivada" && vigente && vigente.id !== v.id;
          return (
            <Link
              key={v.id}
              to={`/orcamentos/${planejamento.id}/${v.id}`}
              className="secao-lateral"
              style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", color: "inherit", flexWrap: "wrap", background: vigente?.id === v.id ? "#f7fbfa" : undefined }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <b style={{ fontSize: 14 }}>{v.versao}</b>
                  <PillSituacao situacao={v.situacao} />
                  {substituida && <span style={{ fontSize: 12, color: "var(--color-gray)" }}>(substituída pela {vigente.versao})</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 3 }}>
                  criada em {dataBr(v.dataCriacao)} ·{" "}
                  {v.visao === "completa"
                    ? `Completa · ${plural(v.qtdCompleta || 0, "recurso", "recursos")} → ${plural(v.qtdCondensada || 0, "linha condensada", "linhas condensadas")}`
                    : `Condensada · ${plural(v.qtdCondensada || 0, "linha", "linhas")}`}
                  {v.observacao && ` · ${v.observacao}`}
                </div>
              </div>
              <b style={{ fontSize: 14 }}>{formatarReais(v.totalAnual || 0)}</b>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
