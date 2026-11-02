import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "../components/Avatar";
import NovaFrenteModal from "../components/NovaFrenteModal";
import { useAuth } from "../contexts/AuthContext";
import { useDados } from "../contexts/DadosContext";
import { useUsuarios } from "../hooks/useUsuarios";
import { entradasDaAgenda } from "../lib/agenda";
import { diasAte, formatarDataRelativa } from "../lib/datas";

const PAPEL_TEXTO = {
  proprietario: "Criada por você",
  editor: "Você pode editar",
  visualizador: "Você pode visualizar",
};

const GRUPOS = [
  { key: "atrasados", label: "Com itens atrasados", alerta: true },
  { key: "em-dia", label: "Em dia" },
  { key: "vazias", label: "Sem itens abertos" },
];

// Todas as frentes, como a página de Contratos: agrupadas pelo que está
// pendente em cada uma. No celular, é a aba "Frentes".
export default function FrentesListPage() {
  const { user } = useAuth();
  const { frentes, itensAbertos, contagemPorFrente } = useDados();
  const [filtro, setFiltro] = useState("todas");
  const [mostrarNovaFrente, setMostrarNovaFrente] = useState(false);

  const todosUids = useMemo(() => Array.from(new Set(frentes.flatMap((f) => f.membrosUids || []))).slice(0, 30), [frentes]);
  const usuarios = useUsuarios(todosUids);

  // Próxima data de cada frente: o prazo, lembrete, reunião ou preparo mais próximo.
  const proximaPorFrente = useMemo(() => {
    const mapa = {};
    for (const e of entradasDaAgenda(itensAbertos, { uid: user.uid })) {
      if (!mapa[e.item.frenteId]) mapa[e.item.frenteId] = e.data;
    }
    return mapa;
  }, [itensAbertos, user.uid]);

  const visiveis = frentes.filter((f) =>
    filtro === "minhas" ? f.donoId === user.uid : filtro === "compartilhadas" ? f.donoId !== user.uid : true
  );
  const porGrupo = { atrasados: [], "em-dia": [], vazias: [] };
  for (const f of visiveis) {
    const c = contagemPorFrente[f.id] || { abertos: 0, atrasados: 0 };
    porGrupo[c.atrasados > 0 ? "atrasados" : c.abertos > 0 ? "em-dia" : "vazias"].push(f);
  }

  return (
    <div className="page-shell" style={{ paddingTop: 28, paddingBottom: 60, maxWidth: 1180 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 700 }}>Frentes</h1>
          <p style={{ margin: 0, color: "var(--color-gray)", fontSize: 14 }}>Todos os assuntos que você acompanha, com o que está pendente em cada um.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="seg" role="group" aria-label="Mostrar">
            {[
              ["todas", "Todas"],
              ["minhas", "Minhas"],
              ["compartilhadas", "Compartilhadas comigo"],
            ].map(([k, l]) => (
              <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>
                {l}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setMostrarNovaFrente(true)}>
            + Nova frente
          </button>
        </div>
      </div>

      <Link to="/buscar" className="so-mobile" style={{ marginTop: 16 }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            minHeight: 48,
            padding: "0 14px",
            borderRadius: 12,
            border: "1px solid var(--color-gray-light)",
            background: "var(--color-white)",
            color: "var(--color-gray)",
            fontSize: 15,
          }}
        >
          Buscar em todas as frentes…
        </span>
      </Link>

      {visiveis.length === 0 ? (
        <div className="empty-state">
          {filtro === "compartilhadas" ? "Ninguém compartilhou uma frente com você ainda." : "Nenhuma frente ainda."}
        </div>
      ) : (
        GRUPOS.map((g) =>
          porGrupo[g.key].length === 0 ? null : (
            <section key={g.key}>
              <h2 className={`grupo-titulo ${g.alerta ? "grupo-alerta" : ""}`}>
                {g.label} · {porGrupo[g.key].length}
              </h2>
              <div className={`lista-card ${g.alerta ? "alerta" : ""}`} style={g.key === "vazias" ? { opacity: 0.85 } : undefined}>
                {porGrupo[g.key].map((f) => {
                  const c = contagemPorFrente[f.id] || { abertos: 0, atrasados: 0 };
                  const proxima = proximaPorFrente[f.id];
                  const atrasada = proxima && diasAte(proxima) < 0;
                  return (
                    <Link key={f.id} to={`/frentes/${f.id}`} className="frente-linha">
                      <div style={{ minWidth: 0, display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <span style={{ width: 12, height: 12, borderRadius: "50%", background: f.cor, flex: "0 0 auto", marginTop: 5 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{f.nome}</div>
                          {f.descricao && <div style={{ fontSize: 13, color: "var(--color-gray)", marginTop: 2 }}>{f.descricao}</div>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {c.atrasados > 0 && (
                          <span className="pill" style={{ background: "var(--color-orange-soft)", color: "var(--color-orange)" }}>
                            {c.atrasados} {c.atrasados === 1 ? "atrasado" : "atrasados"}
                          </span>
                        )}
                        {c.abertos > 0 ? (
                          <span className="pill" style={{ background: "#eceeee", color: "var(--color-dark)" }}>
                            {c.abertos} {c.abertos === 1 ? "aberto" : "abertos"}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--color-gray)" }}>nada pendente</span>
                        )}
                      </div>
                      <div className="col-membros" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ display: "flex", paddingLeft: 6 }}>
                          {(f.membrosUids || []).slice(0, 5).map((uid) => (
                            <Avatar
                              key={uid}
                              nome={usuarios[uid]?.nome}
                              url={usuarios[uid]?.avatarUrl}
                              tamanho={26}
                              decorativo
                              style={{ border: "2px solid #fff", marginLeft: -6 }}
                            />
                          ))}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--color-gray)" }}>{PAPEL_TEXTO[f.membros?.[user.uid]] || ""}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: "var(--color-gray)" }}>Próxima data</div>
                        <div className={atrasada ? "texto-alerta" : ""} style={{ fontSize: 15, fontWeight: 700, color: proxima ? undefined : "var(--color-gray)" }}>
                          {proxima ? formatarDataRelativa(proxima) : "—"}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )
        )
      )}

      {mostrarNovaFrente && <NovaFrenteModal onClose={() => setMostrarNovaFrente(false)} />}
    </div>
  );
}
