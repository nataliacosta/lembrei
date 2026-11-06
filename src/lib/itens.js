// Onde um item mora. Itens de frente: frentes/{frenteId}/itens/{id}, com
// item.frenteId = frenteId. Itens de contrato (e de aditivo):
// contratos/{contratoId}/itens/{id}, com item.frenteId = "contrato:<id>",
// item.contratoId e, se for de um aditivo, item.aditivoId.
// Sem Firebase: usado no app e nas Cloud Functions.

export const PREFIXO_CONTRATO = "contrato:";

export function baseDoContrato(contratoId) {
  return PREFIXO_CONTRATO + contratoId;
}

export function ehBaseContrato(base) {
  return String(base || "").startsWith(PREFIXO_CONTRATO);
}

export function contratoDaBase(base) {
  return ehBaseContrato(base) ? base.slice(PREFIXO_CONTRATO.length) : null;
}

// Segmentos da coleção de itens no Firestore.
export function colecaoDeItens(base) {
  const contratoId = contratoDaBase(base);
  return contratoId ? ["contratos", contratoId, "itens"] : ["frentes", base, "itens"];
}

export function caminhoDoItem(base, itemId) {
  return [...colecaoDeItens(base), itemId];
}

// Link da página do item no app.
export function linkDoItem(base, itemId) {
  const contratoId = contratoDaBase(base);
  return contratoId ? `/contratos/${contratoId}/itens/${itemId}` : `/frentes/${base}/itens/${itemId}`;
}

// Página "de onde o item é" (frente ou contrato).
export function linkDaOrigem(base) {
  const contratoId = contratoDaBase(base);
  return contratoId ? `/contratos/${contratoId}` : `/frentes/${base}`;
}
