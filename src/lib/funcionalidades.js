// Funcionalidades que cada pessoa pode desligar para si (usuarios/{uid}.funcionalidades).
// Desligar só esconde: nada é apagado. Sem Firebase: usado no app e nas functions.

export const FUNCIONALIDADES = [
  { chave: "frentes", titulo: "Frentes", detalhe: "Organizar os itens por assunto" },
  { chave: "contratos", titulo: "Contratos", detalhe: "Contratos, aditivos, medição e itens de contrato" },
  { chave: "demandas", titulo: "Demandas", detalhe: "Fila de demandas com previsão de entrega" },
];

export const FUNCIONALIDADES_PADRAO = { frentes: true, contratos: true, demandas: true };

export function mesclarFuncionalidades(f) {
  return { ...FUNCIONALIDADES_PADRAO, ...(f || {}) };
}

// Item de frente ou de contrato (ver lib/itens.js: frenteId "contrato:<id>").
export function itemVisivel(item, f) {
  const deContrato = String(item?.frenteId || "").startsWith("contrato:");
  return deContrato ? f.contratos : f.frentes;
}

// Notificação do sino (e push): pelo tipo e pelo link.
export function notificacaoVisivel(n, f) {
  const tipo = n?.tipo || "";
  const link = n?.link || "";
  if (tipo === "aditivo" || link.startsWith("/contratos")) return f.contratos;
  if (tipo.startsWith("demanda") || tipo === "fila_repriorizada" || link.startsWith("/demandas")) return f.demandas;
  if (link.startsWith("/frentes")) return f.frentes;
  return true;
}
