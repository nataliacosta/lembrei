import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useVoltar } from "../contexts/HistoricoContext";

import { useUsuarios } from "../hooks/useUsuarios";
import { PAPEIS } from "../lib/constants";
import { alterarPapel, cancelarConvite, convidarMembro, removerMembro, watchFrente } from "../lib/firestore";

export default function SharingPage() {
  const { frenteId } = useParams();
  const { user } = useAuth();
  const { voltar } = useVoltar(`/frentes/${frenteId}`);
  const [frente, setFrente] = useState(undefined);
  const [email, setEmail] = useState("");
  const [papelConvite, setPapelConvite] = useState("editor");
  const [erro, setErro] = useState("");

  useEffect(() => {
    const unsub = watchFrente(frenteId, setFrente);
    return unsub;
  }, [frenteId]);

  const membros = useUsuarios(frente?.membrosUids || []);

  if (frente === undefined) return <div className="spinner-wrap">Carregando...</div>;
  if (!frente) return <div className="spinner-wrap">Frente não encontrada.</div>;

  const souProprietario = frente.donoId === user.uid;

  async function enviarConvite(e) {
    e.preventDefault();
    setErro("");
    const emailLimpo = email.trim().toLowerCase();
    if (!emailLimpo) return;
    if (frente.membrosUids?.some((uid) => membros[uid]?.email?.toLowerCase() === emailLimpo)) {
      setErro("Essa pessoa já tem acesso a esta frente.");
      return;
    }
    await convidarMembro(frenteId, emailLimpo, papelConvite);
    setEmail("");
  }

  return (
    <div className="modal-overlay" style={{ width: "100%", minHeight: "100vh", background: "rgba(0,51,45,0.55)", display: "flex", justifyContent: "center" }}>
      <div className="card" style={{ width: "100%", maxWidth: 640, boxShadow: "0 20px 60px rgba(0,51,45,0.25)", overflow: "hidden" }}>
        <div className="modal-body-pad" style={{ paddingTop: 24, paddingBottom: 24, borderBottom: "1px solid var(--color-gray-light)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Compartilhar frente</h2>
            <div style={{ fontSize: 13, color: "var(--color-gray)", marginTop: 2 }}>{frente.nome}</div>
          </div>
          <button type="button" onClick={voltar} style={{ fontSize: 20, color: "var(--color-gray)", background: "none", border: "none", width: 44, height: 44 }} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-body-pad" style={{ paddingTop: 24, paddingBottom: 24 }}>
          {souProprietario ? (
            <form onSubmit={enviarConvite}>
              <label>Convidar pessoa</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  type="email"
                  placeholder="nome@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ flex: "1 1 160px" }}
                />
                <select value={papelConvite} onChange={(e) => setPapelConvite(e.target.value)} style={{ width: "auto" }}>
                  <option value="visualizador">Pode visualizar</option>
                  <option value="editor">Pode editar</option>
                </select>
                <button type="submit" className="btn btn-primary">
                  Convidar
                </button>
              </div>
              {erro && <p style={{ color: "var(--color-orange)", fontSize: 13, marginTop: 8 }}>{erro}</p>}
              <p style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 8 }}>
                A pessoa precisa ter uma conta e entrar com o mesmo e-mail — o acesso é liberado automaticamente no
                próximo login dela.
              </p>
            </form>
          ) : (
            <p style={{ fontSize: 13, color: "var(--color-gray)" }}>
              Só o proprietário da frente pode convidar ou remover pessoas.
            </p>
          )}

          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Com acesso
            </div>

            {(frente.membrosUids || []).map((uid) => {
              const m = membros[uid];
              const papel = frente.membros?.[uid];
              return (
                <div key={uid} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: "10px 0", borderBottom: "1px solid #F0F0F0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                      {(m?.nome || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {m?.nome} {uid === user.uid ? "(você)" : ""}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-gray)" }}>{m?.email}</div>
                    </div>
                  </div>
                  {papel === "proprietario" || !souProprietario || uid === user.uid ? (
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray)" }}>{PAPEIS[papel]}</span>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <select
                        value={papel}
                        onChange={(e) => alterarPapel(frenteId, frente.membros, uid, e.target.value)}
                        style={{ width: "auto", fontSize: 13 }}
                      >
                        <option value="visualizador">Pode visualizar</option>
                        <option value="editor">Pode editar</option>
                      </select>
                      <button
                        onClick={() => removerMembro(frenteId, frente.membros, frente.membrosUids, uid)}
                        aria-label={`Remover acesso de ${m?.nome}`}
                        style={{ background: "none", border: "none", color: "var(--color-gray)", fontSize: 16 }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {(frente.convitesPendentes || []).map((convite) => (
              <div key={convite.email} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: "10px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="avatar" style={{ width: 34, height: 34, fontSize: 12, background: "var(--color-gray-light)", color: "var(--color-dark)" }}>
                    {convite.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{convite.email}</div>
                    <div style={{ fontSize: 12, color: "var(--color-orange)" }}>
                      Convite enviado · aguardando primeiro login ({PAPEIS[convite.papel]})
                    </div>
                  </div>
                </div>
                {souProprietario && (
                  <button onClick={() => cancelarConvite(frenteId, convite)} style={{ fontSize: 13, fontWeight: 600, background: "none", border: "none", color: "var(--color-primary)" }}>
                    Cancelar
                  </button>
                )}
              </div>
            ))}
          </div>

          <p style={{ margin: "24px 0 0 0", fontSize: 12, color: "var(--color-gray)", lineHeight: 1.5 }}>
            O acesso vale pra frente inteira, incluindo todos os itens dela.
          </p>
        </div>

        <div className="modal-body-pad" style={{ paddingTop: 20, paddingBottom: 20, borderTop: "1px solid var(--color-gray-light)", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={voltar} className="btn btn-primary">
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}
