import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { watchAditivo } from "../lib/contratos";

// "Contrato · X › Aditivo · Prazo" (itens de contrato) — com links.
export default function OrigemDoItem({ origem, item }) {
  const [aditivo, setAditivo] = useState(null);
  useEffect(() => {
    if (origem?.tipo !== "contrato" || !item.aditivoId) return;
    return watchAditivo(item.contratoId, item.aditivoId, setAditivo);
  }, [origem?.tipo, item.contratoId, item.aditivoId]);
  if (origem?.tipo !== "contrato") return null;
  return (
    <div style={{ fontSize: 13, color: "var(--color-gray)", marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
      <span>
        Contrato · <Link to={origem.link}>{origem.nome}</Link>
      </span>
      {item.aditivoId && (
        <span>
          › Aditivo · <Link to={`${origem.link}/aditivos/${item.aditivoId}`}>{(aditivo?.tipo || []).join(", ") || "aditivo"}</Link>
        </span>
      )}
    </div>
  );
}
