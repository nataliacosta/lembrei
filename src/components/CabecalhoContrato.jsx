import { Link } from "react-router-dom";

// Nome do contrato com as abas Resumo | Medições (usado nas telas de medição).
export function AbasContrato({ contratoId, aba }) {
  return (
    <nav className="abas-contrato" aria-label="Seções do contrato">
      <Link to={`/contratos/${contratoId}`} aria-current={aba === "resumo" ? "page" : undefined} replace>
        Resumo
      </Link>
      <Link to={`/contratos/${contratoId}/medicoes`} aria-current={aba === "medicoes" ? "page" : undefined} replace>
        Medições
      </Link>
    </nav>
  );
}

export default function CabecalhoContrato({ contrato, aba = "medicoes", compacto = false }) {
  return (
    <>
      <div style={{ fontSize: compacto ? 20 : 26, fontWeight: 700, marginTop: compacto ? 12 : 0 }} role={compacto ? undefined : "heading"} aria-level={compacto ? undefined : 1}>
        {contrato.titulo}
      </div>
      <div style={{ fontSize: compacto ? 13 : 14, color: "var(--color-gray)", marginTop: 2 }}>
        {[contrato.fornecedor, contrato.numero && `Nº ${contrato.numero}`].filter(Boolean).join(" · ")}
      </div>
      <AbasContrato contratoId={contrato.id} aba={aba} />
    </>
  );
}
