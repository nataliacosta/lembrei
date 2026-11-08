// Orçamentos (lógica pura, sem Firebase).
//
// planejamentos/{id}: um por ano (compartilhado como os contratos)
//   versoes/{vid}: { ano, versao: "v3", dataCriacao: "2026-11-12", observacao,
//                    situacao: "planejamento" | "efetivada", visao: "completa" | "condensada",
//                    totalAnual, totalTI, totalCliente, qtdCompleta, qtdCondensada }
//     conteudo/principal: { completa: [linha], condensada: [linha], extras: { chave: {...} } }
//
// Na visão completa, a condensada é montada agrupando por Projeto + Fornecedor +
// Linha; os campos que só existem na condensada (ODI, tipo, classificação...)
// ficam em "extras", pela chave do grupo, e são aproveitados nas versões novas.

import { lerNumero, normalizarNome } from "./alocacoes.js";

export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const TIPOS = ["Projeto", "Licenciamento", "MOP", "Serviço/sustentação", "N/A"];
export const CLASSIFICACOES = ["Obrigatório", "Mandatório", "Desejável", "N/A"];
export const RESPONSAVEIS = ["TI", "Cliente"];

// Colunas das planilhas (modelo, upload e download usam as mesmas).
export const COLUNAS_COMPLETA = [
  { chave: "agrupamento", titulo: "Agrupamento" },
  { chave: "tipo", titulo: "Tipo" },
  { chave: "item", titulo: "Item" },
  { chave: "pessoa", titulo: "Pessoa" },
  { chave: "tiPaga", titulo: "TI paga?", tipo: "simnao" },
  { chave: "quemPaga", titulo: "Quem paga" },
  { chave: "quemSeBeneficia", titulo: "Quem se beneficia" },
  { chave: "valorUnitario", titulo: "Valor unitário", tipo: "numero" },
  { chave: "quantidade", titulo: "Quantidade", tipo: "numero" },
  ...MESES.map((m, i) => ({ chave: `m${i}`, titulo: m[0].toUpperCase() + m.slice(1), tipo: "numero", mes: i })),
  { chave: "anual", titulo: "Valor anual", tipo: "numero", calculado: true },
  { chave: "projeto", titulo: "Projeto" },
  { chave: "fornecedor", titulo: "Fornecedor" },
  { chave: "linha", titulo: "Linha" },
];

export const COLUNAS_CONDENSADA = [
  { chave: "projeto", titulo: "Projeto" },
  { chave: "fornecedor", titulo: "Fornecedor" },
  { chave: "linha", titulo: "Linha" },
  { chave: "odi", titulo: "ODI" },
  { chave: "capexAnoAnterior", titulo: "Capex ano anterior", tipo: "numero" },
  { chave: "tipo", titulo: "Tipo", opcoes: TIPOS },
  { chave: "classificacao", titulo: "Classificação", opcoes: CLASSIFICACOES },
  { chave: "diretoria", titulo: "Diretoria" },
  { chave: "area", titulo: "Área atendida" },
  { chave: "responsavel", titulo: "Responsável orçamento", opcoes: RESPONSAVEIS },
  ...MESES.map((m, i) => ({ chave: `m${i}`, titulo: m[0].toUpperCase() + m.slice(1), tipo: "numero", mes: i })),
  { chave: "anual", titulo: "Valor anual", tipo: "numero", calculado: true },
];

// Campos da condensada que não vêm da completa.
export const CAMPOS_EXTRAS = ["odi", "capexAnoAnterior", "tipo", "classificacao", "diretoria", "area", "responsavel"];
const OBRIGATORIOS_EXTRAS = ["odi", "tipo", "classificacao", "diretoria", "area", "responsavel"];

const centavos = (v) => Math.round((Number(v) || 0) * 100);
const deCentavos = (c) => c / 100;

export const novoIdLinha = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function mesesVazios() {
  return Array(12).fill(0);
}

export function anualDe(linha) {
  return deCentavos((linha.meses || []).reduce((s, v) => s + centavos(v), 0));
}

export function chaveGrupo(l) {
  return [l.projeto, l.fornecedor, l.linha].map((x) => normalizarNome(x)).join("|");
}

// Opções de lista aceitando o que vier escrito diferente ("obrigatorio", "ti"...).
export function casarOpcao(valor, opcoes) {
  const n = normalizarNome(valor);
  if (!n) return "";
  return opcoes.find((o) => normalizarNome(o) === n) || opcoes.find((o) => normalizarNome(o).startsWith(n)) || String(valor).trim();
}

export function lerSimNao(valor) {
  if (typeof valor === "boolean") return valor;
  const n = normalizarNome(valor);
  return ["sim", "s", "x", "yes", "true", "1"].includes(n);
}

// Agrupa a completa por Projeto + Fornecedor + Linha, somando os meses.
export function condensar(completa, extras = {}) {
  const grupos = new Map();
  for (const l of completa) {
    const chave = chaveGrupo(l);
    const g = grupos.get(chave) || { chave, projeto: l.projeto || "", fornecedor: l.fornecedor || "", linha: l.linha || "", mesesC: Array(12).fill(0), qtdRecursos: 0 };
    (l.meses || []).forEach((v, i) => (g.mesesC[i] += centavos(v)));
    g.qtdRecursos++;
    grupos.set(chave, g);
  }
  return [...grupos.values()].map(({ mesesC, ...g }) => {
    const meses = mesesC.map(deCentavos);
    return { ...vaziosExtras(), ...(extras[g.chave] || {}), ...g, meses, anual: deCentavos(mesesC.reduce((s, v) => s + v, 0)) };
  });
}

function vaziosExtras() {
  return { odi: "", capexAnoAnterior: null, tipo: "", classificacao: "", diretoria: "", area: "", responsavel: "" };
}

export function camposPendentes(linhaCondensada) {
  return OBRIGATORIOS_EXTRAS.filter((k) => !String(linhaCondensada[k] ?? "").trim());
}

// Linhas da condensada da versão (montada da completa, ou a própria condensada).
export function linhasCondensadas(versao, conteudo) {
  if (!conteudo) return [];
  if (versao?.visao === "condensada") return (conteudo.condensada || []).map((l) => ({ ...l, chave: l.chave || chaveGrupo(l), anual: anualDe(l) }));
  return condensar(conteudo.completa || [], conteudo.extras || {});
}

export function totaisDoOrcamento(versao, conteudo) {
  let anual = 0;
  let ti = 0;
  let cliente = 0;
  if (versao?.visao === "condensada") {
    for (const l of conteudo?.condensada || []) {
      const v = centavos(anualDe(l));
      anual += v;
      if (l.responsavel === "TI") ti += v;
      else if (l.responsavel === "Cliente") cliente += v;
    }
  } else {
    for (const l of conteudo?.completa || []) {
      const v = centavos(anualDe(l));
      anual += v;
      if (l.tiPaga) ti += v;
      else cliente += v;
    }
  }
  return { totalAnual: deCentavos(anual), totalTI: deCentavos(ti), totalCliente: deCentavos(cliente) };
}

// Resumo gravado na versão (para a lista não precisar abrir o conteúdo).
export function resumoDaVersao(versao, conteudo) {
  const condensada = linhasCondensadas(versao, conteudo);
  return {
    ...totaisDoOrcamento(versao, conteudo),
    qtdCompleta: versao.visao === "completa" ? (conteudo.completa || []).length : 0,
    qtdCondensada: condensada.length,
    pendentes: condensada.filter((l) => camposPendentes(l).length).length,
  };
}

// Totais por mês (para a linha de total das tabelas).
export function totaisPorMes(linhas) {
  const c = Array(12).fill(0);
  for (const l of linhas) (l.meses || []).forEach((v, i) => (c[i] += centavos(v)));
  return { meses: c.map(deCentavos), anual: deCentavos(c.reduce((s, v) => s + v, 0)) };
}

// Ordena as versões: a mais recente primeiro (data de criação, depois criadoEm).
function tempo(v) {
  const c = v.criadoEm?.toMillis ? v.criadoEm.toMillis() : v.criadoEm?.seconds ? v.criadoEm.seconds * 1000 : 0;
  return [v.dataCriacao || "", c];
}

export function ordenarVersoes(versoes) {
  return [...versoes].sort((a, b) => {
    const [da, ca] = tempo(a);
    const [db, cb] = tempo(b);
    return db.localeCompare(da) || cb - ca;
  });
}

// A efetivada que conta: a última cadastrada.
export function versaoVigente(versoes) {
  return ordenarVersoes(versoes).find((v) => v.situacao === "efetivada") || null;
}

export function proximaVersao(versoes) {
  const n = versoes.reduce((m, v) => Math.max(m, parseInt(String(v.versao || "").replace(/\D/g, ""), 10) || 0), 0);
  return `v${n + 1}`;
}

// ---------- Planilhas ----------

function indicesDasColunas(titulos, colunas) {
  const norm = titulos.map((t) => normalizarNome(t).replace(/[?:.]/g, "").trim());
  const idx = {};
  for (const c of colunas) {
    const nomes = [normalizarNome(c.titulo).replace(/[?:.]/g, "").trim()];
    if (c.mes !== undefined) nomes.push(MESES[c.mes], MESES_LONGOS[c.mes]);
    if (c.chave === "tiPaga") nomes.push("ti paga");
    if (c.chave === "responsavel") nomes.push("responsavel", "responsavel pelo orcamento");
    if (c.chave === "area") nomes.push("area");
    if (c.chave === "capexAnoAnterior") nomes.push("capex");
    if (c.chave === "anual") nomes.push("anual", "total", "valor total");
    let i = norm.findIndex((t) => nomes.includes(t));
    // "jan/27", "janeiro 2027"...
    if (i < 0 && c.mes !== undefined) i = norm.findIndex((t) => t.startsWith(MESES[c.mes] + "/") || t.startsWith(MESES[c.mes] + " ") || t.startsWith(MESES_LONGOS[c.mes] + " "));
    idx[c.chave] = i;
  }
  return idx;
}

// Lê a planilha (primeira linha com os títulos). Devolve { linhas, faltando }.
export function lerPlanilhaOrcamento(linhasBrutas, visao) {
  const colunas = visao === "condensada" ? COLUNAS_CONDENSADA : COLUNAS_COMPLETA;
  const marcador = visao === "condensada" ? "projeto" : "item";
  const iTit = linhasBrutas.findIndex((l) => (l || []).some((c) => normalizarNome(c) === marcador));
  if (iTit < 0) return { linhas: [], faltando: [visao === "condensada" ? "Projeto" : "Item"] };
  const idx = indicesDasColunas(linhasBrutas[iTit], colunas);
  const essenciais = visao === "condensada" ? ["projeto", "fornecedor", "linha"] : ["item", "projeto", "fornecedor", "linha"];
  const faltando = essenciais.filter((k) => idx[k] < 0).map((k) => colunas.find((c) => c.chave === k).titulo);
  if (faltando.length) return { linhas: [], faltando };
  const temMeses = MESES.some((_, i) => idx[`m${i}`] >= 0);
  const texto = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
  const linhas = [];
  for (const bruta of linhasBrutas.slice(iTit + 1)) {
    if (!bruta) continue;
    const pegar = (k) => (idx[k] >= 0 ? bruta[idx[k]] : null);
    const meses = MESES.map((_, i) => lerNumero(pegar(`m${i}`)) || 0);
    const anualPlanilha = lerNumero(pegar("anual")) || 0;
    // Sem valores por mês: divide o anual igualmente pelos 12 meses.
    if ((!temMeses || meses.every((v) => !v)) && anualPlanilha) {
      const base = Math.floor((centavos(anualPlanilha) / 12)) / 100;
      for (let i = 0; i < 11; i++) meses[i] = base;
      meses[11] = deCentavos(centavos(anualPlanilha) - centavos(base) * 11);
    }
    const linha = { id: novoIdLinha(), meses };
    for (const c of colunas) {
      if (c.mes !== undefined || c.chave === "anual") continue;
      const v = pegar(c.chave);
      if (c.tipo === "numero") linha[c.chave] = lerNumero(v);
      else if (c.tipo === "simnao") linha[c.chave] = lerSimNao(v);
      else if (c.opcoes) linha[c.chave] = casarOpcao(v, c.opcoes);
      else linha[c.chave] = texto(v);
    }
    const vazia = visao === "condensada" ? !linha.projeto && !linha.fornecedor && !linha.linha && !anualDe(linha) : !linha.item && !anualDe(linha);
    if (vazia) continue;
    linhas.push(linha);
  }
  return { linhas, faltando: [] };
}

// Dados de uma aba (para write-excel-file): títulos + linhas.
export function abaDaPlanilha(colunas, linhas) {
  const cab = colunas.map((c) => ({ value: c.titulo, fontWeight: "bold" }));
  const corpo = linhas.map((l) =>
    colunas.map((c) => {
      if (c.mes !== undefined) return { value: Number(l.meses?.[c.mes] || 0), type: Number, format: "#,##0.00" };
      if (c.chave === "anual") return { value: anualDe(l), type: Number, format: "#,##0.00" };
      const v = l[c.chave];
      if (c.tipo === "simnao") return { value: v ? "Sim" : "Não" };
      if (c.tipo === "numero") return v == null || v === "" ? null : { value: Number(v), type: Number, format: c.chave === "quantidade" ? "#,##0.##" : "#,##0.00" };
      return { value: v == null ? "" : String(v) };
    })
  );
  return [cab, ...corpo];
}

export function larguras(colunas) {
  return colunas.map((c) => ({ width: c.mes !== undefined ? 12 : c.chave === "item" || c.chave === "projeto" ? 28 : c.chave === "anual" ? 14 : 18 }));
}
