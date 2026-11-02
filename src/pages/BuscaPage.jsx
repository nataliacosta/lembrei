import { useState } from "react";
import { ListaResultados, useResultadosBusca } from "../components/Busca";

// Busca em tela cheia (celular). No computador a busca fica no topo.
export default function BuscaPage() {
  const [termo, setTermo] = useState("");
  const resultados = useResultadosBusca(termo);
  return (
    <div className="page-shell" style={{ paddingTop: 20, paddingBottom: 48, maxWidth: 720 }}>
      <input
        type="search"
        autoFocus
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Buscar itens, frentes e contratos…"
        aria-label="Buscar itens, frentes e contratos"
        style={{ minHeight: 48, borderRadius: 12 }}
      />
      <div className="lista-card" style={{ marginTop: 12 }}>
        <ListaResultados termo={termo} resultados={resultados} ativo={-1} />
      </div>
    </div>
  );
}
