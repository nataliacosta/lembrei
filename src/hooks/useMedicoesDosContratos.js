import { useEffect, useMemo, useState } from "react";
import { watchMedicoes } from "../lib/medicoesContrato";

// Medições salvas de todos os contratos que a pessoa vê (com o nome do contrato).
export function useMedicoesDosContratos(contratos) {
  const [porContrato, setPorContrato] = useState({});
  const chave = contratos.map((c) => c.id).join(",");
  useEffect(() => {
    const unsubs = contratos.map((c) => watchMedicoes(c.id, (lista) => setPorContrato((x) => ({ ...x, [c.id]: lista }))));
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return useMemo(() => {
    const titulos = Object.fromEntries(contratos.map((c) => [c.id, c.titulo]));
    const lista = [];
    for (const [cid, meds] of Object.entries(porContrato)) {
      if (!(cid in titulos)) continue;
      for (const m of meds) lista.push({ ...m, contratoId: cid, contratoTitulo: titulos[cid] });
    }
    return { medicoes: lista, carregando: contratos.some((c) => !porContrato[c.id]) };
  }, [porContrato, contratos]);
}
