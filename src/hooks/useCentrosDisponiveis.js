import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useDados } from "../contexts/DadosContext";
import { chaveCentro } from "../lib/alocacoes";
import { importarCentrosDosContratos, watchCentrosFora } from "../lib/centros";
import { useOrcamentosVigentes } from "./useOrcamentosVigentes";

// Lista única de CCs/ODIs para as alocações: as ODIs da última versão
// efetivada de cada ano ("do orçamento") e as cadastradas à mão ("fora").
// Cada opção tem id = "ODI:123" (o mesmo que fica gravado na alocação).
export function useCentrosDisponiveis() {
  const { user } = useAuth();
  const { contratos } = useDados();
  const { porAno, carregando } = useOrcamentosVigentes();
  const [fora, setFora] = useState(null);

  useEffect(() => watchCentrosFora(user.uid, setFora), [user.uid]);

  // Uma vez por pessoa: traz os CCs/ODIs que estavam dentro dos contratos.
  useEffect(() => {
    if (!fora || !contratos.length) return;
    const marca = `lembrei:centrosImportados:${user.uid}`;
    try {
      if (localStorage.getItem(marca)) return;
    } catch {
      /* sem armazenamento: tenta de novo na próxima vez */
    }
    importarCentrosDosContratos(user.uid, contratos, fora)
      .then(() => {
        try {
          localStorage.setItem(marca, "1");
        } catch {
          /* ignora */
        }
      })
      .catch((e) => console.error("Falha ao importar CCs/ODIs dos contratos:", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fora === null, contratos.length, user.uid]);

  return useMemo(() => {
    const mapa = new Map();
    const anos = Object.keys(porAno).map(Number).sort((a, b) => b - a);
    for (const ano of anos) {
      for (const l of porAno[ano].linhas) {
        const codigo = String(l.odi || "").trim();
        if (!codigo) continue;
        const id = chaveCentro("ODI", codigo);
        const atual = mapa.get(id);
        if (atual && atual.ano !== ano) continue; // fica o ano mais recente
        if (atual) {
          atual.linhas.push(l);
          continue;
        }
        mapa.set(id, { id, tipo: "ODI", codigo, origem: "orcamento", ano, linhas: [l], linha: l.linha, projeto: l.projeto, fornecedor: l.fornecedor });
      }
    }
    for (const op of mapa.values()) {
      op.descricao = [op.linha, op.projeto].filter(Boolean).join(" · ") + (op.linhas.length > 1 ? ` (+${op.linhas.length - 1})` : "");
    }
    for (const c of fora || []) {
      const id = chaveCentro(c.tipo, c.codigo);
      if (!c.codigo || mapa.has(id)) continue;
      mapa.set(id, { ...c, id, docId: c.id, origem: "fora" });
    }
    const opcoes = [...mapa.values()].sort((a, b) => (a.origem === b.origem ? String(a.codigo).localeCompare(String(b.codigo)) : a.origem === "orcamento" ? -1 : 1));
    return { opcoes, porId: Object.fromEntries(opcoes.map((o) => [o.id, o])), fora: fora || [], carregando: carregando || fora === null };
  }, [porAno, fora, carregando]);
}
