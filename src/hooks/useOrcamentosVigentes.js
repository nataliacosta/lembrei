import { useEffect, useMemo, useState } from "react";
import { useDados } from "../contexts/DadosContext";
import { watchConteudo, watchVersoes } from "../lib/orcamentosDb";
import { linhasCondensadas, versaoVigente } from "../lib/orcamentos";

// Para cada ano: a última versão efetivada e as linhas da condensada dela.
export function useOrcamentosVigentes() {
  const { planejamentos } = useDados();
  const [versoes, setVersoes] = useState({}); // pid → versões
  const [conteudos, setConteudos] = useState({}); // "pid/vid" → conteúdo

  const chave = planejamentos.map((p) => p.id).join(",");
  useEffect(() => {
    const unsubs = planejamentos.map((p) => watchVersoes(p.id, (lista) => setVersoes((v) => ({ ...v, [p.id]: lista }))));
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const vigentes = useMemo(
    () =>
      planejamentos
        .map((p) => ({ planejamento: p, versao: versaoVigente(versoes[p.id] || []) }))
        .filter((x) => x.versao),
    [planejamentos, versoes]
  );
  const chaveVig = vigentes.map((x) => `${x.planejamento.id}/${x.versao.id}`).join(",");
  useEffect(() => {
    const unsubs = vigentes.map(({ planejamento, versao }) =>
      watchConteudo(planejamento.id, versao.id, (c) => setConteudos((x) => ({ ...x, [`${planejamento.id}/${versao.id}`]: c })))
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveVig]);

  return useMemo(() => {
    const porAno = {};
    let carregando = planejamentos.some((p) => !versoes[p.id]);
    for (const { planejamento, versao } of vigentes) {
      const c = conteudos[`${planejamento.id}/${versao.id}`];
      if (!c) {
        carregando = true;
        continue;
      }
      // Se houver dois planejamentos do mesmo ano (compartilhados), fica o mais recente.
      const atual = porAno[planejamento.ano];
      if (atual && String(atual.versao.dataCriacao || "") > String(versao.dataCriacao || "")) continue;
      porAno[planejamento.ano] = { planejamento, versao, linhas: linhasCondensadas(versao, c) };
    }
    return { porAno, carregando };
  }, [vigentes, conteudos, planejamentos, versoes]);
}
