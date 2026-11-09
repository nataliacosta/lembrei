// Controle orçamentário (lógica pura): orçado na última versão efetivada ×
// realizado nas medições lançadas no sistema. A medição das horas de um mês
// é paga no mês seguinte, e é nesse mês que ela consome o orçamento.

import { chaveCentro, chaveParte, somarMeses } from "./alocacoes.js";

const centavos = (v) => Math.round((Number(v) || 0) * 100);
const deCentavos = (c) => c / 100;
const zeros = () => Array(12).fill(0);

export function mesDePagamento(mesDasHoras) {
  return somarMeses(mesDasHoras, 1);
}

// Orçado por ODI (soma das linhas da condensada com aquela ODI).
export function orcadoPorOdi(linhasCondensadas) {
  const mapa = new Map();
  for (const l of linhasCondensadas || []) {
    const codigo = String(l.odi || "").trim();
    if (!codigo) continue;
    const id = chaveCentro("ODI", codigo);
    const g = mapa.get(id) || { id, tipo: "ODI", codigo, linhas: [], mesesC: zeros() };
    g.linhas.push(l);
    (l.meses || []).forEach((v, i) => (g.mesesC[i] += centavos(v)));
    mapa.set(id, g);
  }
  return mapa;
}

// medicoes: [{ ...medição, contratoId, contratoTitulo }]
// Devolve, por chave de CC/ODI: realizado por mês (lançadas) e os lançamentos,
// e as medições ainda não lançadas (que não contam).
export function realizadoPorCentro(medicoes, ano) {
  const mapa = new Map();
  const pegar = (id, p) => {
    let g = mapa.get(id);
    if (!g) {
      g = { id, tipo: p.tipo, codigo: p.codigo, mesesC: zeros(), lancamentos: [], pendentes: [] };
      mapa.set(id, g);
    }
    return g;
  };
  for (const m of medicoes || []) {
    if (!m?.mes) continue;
    const pag = mesDePagamento(m.mes);
    if (Number(pag.slice(0, 4)) !== Number(ano)) continue;
    const idx = Number(pag.slice(5, 7)) - 1;
    // Soma por CC/ODI dentro desta medição.
    const porCentro = new Map();
    for (const l of m.linhas || []) {
      for (const p of l.partes || []) {
        const id = chaveParte(p);
        if (!id || id === "sem") continue;
        const atual = porCentro.get(id) || { p, valorC: 0 };
        atual.valorC += centavos(p.valor);
        porCentro.set(id, atual);
      }
    }
    for (const [id, { p, valorC }] of porCentro) {
      const g = pegar(id, p);
      const item = { contratoId: m.contratoId, contratoTitulo: m.contratoTitulo, medicaoId: m.id || m.mes, nome: m.nome || "", mes: m.mes, mesPagamento: pag, valor: deCentavos(valorC), lancadaEm: m.lancadaEm || null };
      if (m.status === "lancada") {
        g.mesesC[idx] += valorC;
        g.lancamentos.push(item);
      } else g.pendentes.push(item);
    }
  }
  for (const g of mapa.values()) g.lancamentos.sort((a, b) => b.mes.localeCompare(a.mes));
  return mapa;
}

function fechar(mesesC) {
  const meses = mesesC.map(deCentavos);
  return { meses, total: deCentavos(mesesC.reduce((s, v) => s + v, 0)) };
}

// Junta tudo para a tela: ODIs do orçamento (com orçado, realizado e saldo) e
// os CCs/ODIs fora do orçamento (só o lançado, para referência).
export function controleDoAno(linhasCondensadas, medicoes, ano) {
  const orc = orcadoPorOdi(linhasCondensadas);
  const real = realizadoPorCentro(medicoes, ano);
  const odis = [...orc.values()].map((g) => {
    const r = real.get(g.id);
    const o = fechar(g.mesesC);
    const rz = fechar(r ? r.mesesC : zeros());
    return {
      id: g.id,
      codigo: g.codigo,
      linhas: g.linhas,
      orcado: o,
      realizado: rz,
      saldo: deCentavos(centavos(o.total) - centavos(rz.total)),
      lancamentos: r?.lancamentos || [],
      pendentes: r?.pendentes || [],
    };
  });
  odis.sort((a, b) => b.orcado.total - a.orcado.total);
  const fora = [...real.values()]
    .filter((g) => !orc.has(g.id) && (g.lancamentos.length || g.pendentes.length))
    .map((g) => ({ id: g.id, tipo: g.tipo, codigo: g.codigo, realizado: fechar(g.mesesC), lancamentos: g.lancamentos, pendentes: g.pendentes, contratos: [...new Set([...g.lancamentos, ...g.pendentes].map((x) => x.contratoTitulo).filter(Boolean))] }))
    .sort((a, b) => b.realizado.total - a.realizado.total);
  const totOrc = odis.reduce((s, x) => s + centavos(x.orcado.total), 0);
  const totReal = odis.reduce((s, x) => s + centavos(x.realizado.total), 0);
  return { odis, fora, totais: { orcado: deCentavos(totOrc), realizado: deCentavos(totReal), saldo: deCentavos(totOrc - totReal) } };
}
