// Preferências de push de cada pessoa (usuarios/{uid}.prefsNotificacoes).
// Sem Firebase: usado no app e nas Cloud Functions.

export const PREFS_PADRAO = {
  tipos: { comentarios: true, atribuidos: true, contratos: true, demandas: true, convites: true },
  resumo: { ativo: true, hora: "08:00", dias: [1, 2, 3, 4, 5] },
  reunioes: { ativo: true, minutosAntes: 15 },
};

export const TIPOS_DE_AVISO = [
  { chave: "comentarios", titulo: "Comentários e menções", detalhe: "Quando comentarem em algo seu ou te mencionarem com @" },
  { chave: "atribuidos", titulo: "Itens atribuídos a você" },
  { chave: "contratos", titulo: "Contratos e aditivos", detalhe: "Aditivo criado em contrato que você acompanha" },
  { chave: "demandas", titulo: "Demandas", detalhe: "Demanda criada ou priorizada e fila repriorizada" },
  { chave: "convites", titulo: "Convites", detalhe: "Compartilharam algo com você ou aceitaram seu convite" },
];

export function mesclarPrefs(prefs) {
  const p = prefs || {};
  return {
    tipos: { ...PREFS_PADRAO.tipos, ...(p.tipos || {}) },
    resumo: { ...PREFS_PADRAO.resumo, ...(p.resumo || {}) },
    reunioes: { ...PREFS_PADRAO.reunioes, ...(p.reunioes || {}) },
  };
}

// Em qual chave de "O que avisar" cada tipo de notificação se encaixa.
export function categoriaDoTipo(tipo) {
  if (tipo === "comentario" || tipo === "mencao") return "comentarios";
  if (tipo === "atribuido") return "atribuidos";
  if (tipo === "aditivo") return "contratos";
  if (tipo?.startsWith("demanda") || tipo === "fila_repriorizada") return "demandas";
  if (tipo?.startsWith("convite")) return "convites";
  return null;
}
