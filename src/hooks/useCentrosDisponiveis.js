import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useDados } from "../contexts/DadosContext";
import { chaveCentro } from "../lib/alocacoes";
import { anoDoCentroFora, importarCentrosDosContratos, watchCentrosFora } from "../lib/centros";
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
    // Uma opção por ODI do orçamento, com os anos em que ela aparece (cada ano
    // com as suas linhas): no seletor, só entra no ano a que o custo se refere.
    const mapa = new Map();
    const anos = Object.keys(porAno).map(Number).sort((a, b) => b - a);
    for (const ano of anos) {
      for (const l of porAno[ano].linhas) {
        const codigo = String(l.odi || "").trim();
        if (!codigo) continue;
        const id = chaveCentro("ODI", codigo);
        let op = mapa.get(id);
        if (!op) {
          op = { id, tipo: "ODI", codigo, origem: "orcamento", ano, anos: [], porAno: {} };
          mapa.set(id, op);
        }
        if (!op.porAno[ano]) {
          op.anos.push(ano);
          op.porAno[ano] = { ano, linhas: [] };
        }
        op.porAno[ano].linhas.push(l);
      }
    }
    for (const op of mapa.values()) {
      for (const d of Object.values(op.porAno)) {
        const l = d.linhas[0];
        Object.assign(d, { linha: l.linha, projeto: l.projeto, fornecedor: l.fornecedor });
        d.descricao = [l.linha, l.projeto].filter(Boolean).join(" · ") + (d.linhas.length > 1 ? ` (+${d.linhas.length - 1})` : "");
      }
      // Os campos de cima (descrição, fornecedor...) são os do ano mais recente.
      Object.assign(op, { ...op.porAno[op.ano], ano: op.ano });
    }
    const doOrcamento = [...mapa.values()].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
    // Os de fora ficam todos (mesmo os que são ODI do orçamento de outro ano).
    const deFora = (fora || [])
      .filter((c) => c.codigo)
      .map((c) => ({ ...c, id: chaveCentro(c.tipo, c.codigo), docId: c.id, origem: "fora", anoFora: anoDoCentroFora(c) }))
      .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
    const opcoes = [...doOrcamento, ...deFora];
    const porId = {};
    for (const o of [...deFora, ...doOrcamento]) porId[o.id] = o; // o do orçamento vale mais
    return { opcoes, porId, fora: fora || [], carregando: carregando || fora === null };
  }, [porAno, fora, carregando]);
}

// Ano do orçamento que um custo consome: o do mês de pagamento (as horas de
// um mês são pagas no seguinte; as de dezembro entram no ano seguinte).
export function anoDoOrcamento(mesDasHoras) {
  if (!mesDasHoras) return null;
  const [a, m] = String(mesDasHoras).split("-").map(Number);
  return m === 12 ? a + 1 : a;
}

// Opções do seletor para um ano: as ODIs do orçamento daquele ano, os CCs e as
// ODIs de fora cadastradas para aquele ano (menos as que já estão no orçamento).
export function opcoesDoAno(opcoes, ano) {
  if (ano == null) return opcoes;
  const doAno = opcoes
    .filter((o) => o.origem === "orcamento" && o.anos?.includes(ano))
    .map((o) => ({ ...o, ...o.porAno[ano], ano }));
  const ids = new Set(doAno.map((o) => o.id));
  // CC vale sempre; ODI de fora do orçamento, só no ano dela.
  return [...doAno, ...opcoes.filter((o) => o.origem !== "orcamento" && !ids.has(o.id) && (o.anoFora == null || o.anoFora === ano))];
}
