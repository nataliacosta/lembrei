// Funcionalidades que cada pessoa pode desligar para si (usuarios/{uid}.funcionalidades).
// Desligar só esconde: nada é apagado. Sem Firebase: usado no app e nas functions.

export const FUNCIONALIDADES = [
  { chave: "frentes", titulo: "Frentes", detalhe: "Organizar os itens por assunto" },
  { chave: "contratos", titulo: "Contratos", detalhe: "Contratos, aditivos, medição e itens de contrato" },
  { chave: "demandas", titulo: "Demandas", detalhe: "Fila de demandas com previsão de entrega" },
  { chave: "orcamentos", titulo: "Orçamentos", detalhe: "Planejamento orçamentário anual e versões efetivadas" },
];

export const FUNCIONALIDADES_PADRAO = { frentes: true, contratos: true, demandas: true, orcamentos: true };

export function mesclarFuncionalidades(f) {
  return { ...FUNCIONALIDADES_PADRAO, ...(f || {}) };
}

// Item de frente ou de contrato (ver lib/itens.js: frenteId "contrato:<id>").
export function itemVisivel(item, f) {
  const deContrato = String(item?.frenteId || "").startsWith("contrato:");
  return deContrato ? f.contratos : f.frentes;
}

// Notificação do sino (e push): pelo tipo e pelo link.
export function notificacaoVisivel(n, f, contratosSoMedicao = []) {
  const tipo = n?.tipo || "";
  const link = n?.link || "";
  const doContrato = link.match(/^\/contratos\/([^/]+)\/aditivos/);
  if (doContrato && contratosSoMedicao.includes(doContrato[1])) return false;
  if (tipo === "aditivo" || link.startsWith("/contratos")) return f.contratos;
  if (tipo.startsWith("demanda") || tipo === "fila_repriorizada" || link.startsWith("/demandas")) return f.demandas;
  if (link.startsWith("/frentes")) return f.frentes;
  if (link.startsWith("/orcamentos")) return f.orcamentos;
  return true;
}

// Serviços do menu (O que fazer + as funcionalidades), na ordem que a pessoa
// escolhe em Configurações (usuarios/{uid}.ordemMenu). Vale no celular e no computador.
export const SERVICOS = [
  { chave: "hoje", titulo: "O que fazer", curto: "Hoje", detalhe: "Seus lembretes e prazos do dia" },
  { chave: "demandas", titulo: "Demandas", curto: "Demandas", detalhe: "Fila de demandas com previsão de entrega" },
  { chave: "frentes", titulo: "Frentes", curto: "Frentes", detalhe: "Itens organizados por assunto" },
  { chave: "contratos", titulo: "Contratos", curto: "Contratos", detalhe: "Contratos, aditivos, medição e itens de contrato" },
  { chave: "orcamentos", titulo: "Controle orçamentário", curto: "Orçamento", detalhe: "Orçado × realizado e orçamentos" },
];
export const ORDEM_PADRAO = SERVICOS.map((s) => s.chave);

// Ordem completa: a escolhida (só chaves conhecidas, sem repetir) e, no fim, as que faltarem.
export function ordemCompleta(ordem) {
  const validas = (Array.isArray(ordem) ? ordem : []).filter((k) => ORDEM_PADRAO.includes(k));
  return [...new Set([...validas, ...ORDEM_PADRAO])];
}

// Serviços ligados, na ordem escolhida ("O que fazer" está sempre ligado).
export function servicosAtivos(f, ordem) {
  return ordemCompleta(ordem).filter((k) => k === "hoje" || f?.[k]);
}

export function moverNaOrdem(ordem, chave, delta) {
  const lista = ordemCompleta(ordem);
  const i = lista.indexOf(chave);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= lista.length) return lista;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return lista;
}

// No celular, com 5 ou mais serviços, os 3 primeiros ficam na barra e o resto vai para "Mais".
export function dividirBarra(ativos) {
  return ativos.length >= 5 ? { barra: ativos.slice(0, 3), mais: ativos.slice(3) } : { barra: ativos, mais: [] };
}
