import { useState } from "react";
import { ListaResultados, useResultadosBusca } from "../components/Busca";

// Busca em tela cheia (celular). No computador a busca fica no topo.
export default function BuscaPage() {
  const [termo, setTermo] = useState("");
  const [filtro, setFiltro] = useState("tudo");
  const busca = useResultadosBusca(termo);
  return (
    <div className="page-shell busca-pagina" style={{ paddingTop: 20, paddingBottom: 48, maxWidth: 720 }}>
      <input
        type="search"
        autoFocus
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value);
          setFiltro("tudo");
        }}
        placeholder="Buscar em tudo…"
        aria-label="Buscar em itens, demandas, frentes, contratos e aditivos"
        style={{ minHeight: 48, borderRadius: 12, fontSize: 16 }}
      />
      <div style={{ marginTop: 12 }}>
        <ListaResultados termo={termo} busca={busca} filtro={filtro} onFiltro={setFiltro} ativo={-1} porGrupo={5} />
      </div>
    </div>
  );
}
