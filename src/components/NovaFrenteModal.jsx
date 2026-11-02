import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { criarFrente } from "../lib/firestore";

const CORES = ["#009992", "#EE731B", "#00D4C0", "#00332D", "#7F7F7F", "#C3FF24"];

export default function NovaFrenteModal({ onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    const ref = await criarFrente({ nome: nome.trim(), descricao: descricao.trim(), cor, uid: user.uid });
    setSalvando(false);
    onClose();
    navigate(`/frentes/${ref.id}`);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,51,45,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 20,
      }}
    >
      <form
        onSubmit={salvar}
        className="card"
        style={{ width: "100%", maxWidth: 480, padding: 28, boxShadow: "0 20px 60px rgba(0,51,45,0.25)" }}
      >
        <h2 style={{ margin: "0 0 20px 0", fontSize: 18, fontWeight: 700 }}>Nova frente</h2>

        <label>Nome</label>
        <input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Renovação contrato Fornecedor ABC"
          style={{ marginBottom: 16 }}
        />

        <label>Descrição (opcional)</label>
        <textarea
          rows={3}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          style={{ marginBottom: 16, resize: "vertical" }}
        />

        <label>Cor</label>
        <div style={{ display: "flex", gap: 10, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
          {CORES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCor(c)}
              title={c}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: c,
                border: cor === c ? "2px solid var(--color-dark)" : "2px solid transparent",
                padding: 0,
              }}
            />
          ))}
          <label
            title="Escolher outra cor"
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              cursor: "pointer",
              border: CORES.includes(cor) ? "2px solid var(--color-gray-light)" : "2px solid var(--color-dark)",
              background: CORES.includes(cor)
                ? "conic-gradient(from 0deg, #e4572e, #f3a712, #a8c256, #2a9d8f, #3772ff, #a259c6, #e4572e)"
                : cor,
            }}
          >
            <input
              type="color"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }}
            />
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className="btn btn-primary">
            {salvando ? "Criando..." : "Criar frente"}
          </button>
        </div>
      </form>
    </div>
  );
}
