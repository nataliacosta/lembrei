import { useEffect, useState } from "react";
import { watchContrato } from "../lib/contratos";
import { watchFrente } from "../lib/firestore";
import { contratoDaBase, linkDaOrigem } from "../lib/itens";

// De onde o item é: a frente ou o contrato. Devolve undefined enquanto
// carrega, null se não existir (ou sem acesso), ou
// { tipo, id, nome, membros, membrosUids, link, contrato? }.
export function useOrigemDoItem(base) {
  const [origem, setOrigem] = useState(undefined);
  useEffect(() => {
    if (!base) return;
    setOrigem(undefined);
    const contratoId = contratoDaBase(base);
    if (contratoId) {
      return watchContrato(contratoId, (c) =>
        setOrigem(
          c
            ? { tipo: "contrato", id: base, nome: c.titulo, membros: c.membros || {}, membrosUids: c.membrosUids || [], link: linkDaOrigem(base), contrato: c }
            : null
        )
      );
    }
    return watchFrente(base, (f) => setOrigem(f ? { tipo: "frente", ...f, id: base, link: linkDaOrigem(base) } : null));
  }, [base]);
  return origem;
}
