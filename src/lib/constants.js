export const TIPOS = [
  { key: "tarefa", label: "Tarefa", plural: "Tarefas", temStatusPrazo: true, cor: "var(--color-primary)" },
  { key: "acompanhamento", label: "Acompanhamento", plural: "Acompanhamentos", temStatusPrazo: true, cor: "var(--color-teal-light)" },
  { key: "urgencia", label: "Urgência", plural: "Urgências", temStatusPrazo: true, cor: "var(--color-orange)" },
  { key: "consulta", label: "Consulta", plural: "Consultas", temStatusPrazo: true, cor: "var(--color-gray)" },
  // Reunião: tem recorrência e preparos próprios (campo `reuniao`), em vez de prazo/lembrete.
  { key: "reuniao", label: "Reunião", plural: "Reuniões", temStatusPrazo: false, cor: "#1f4f8f" },
  { key: "status", label: "Status", plural: "Status", temStatusPrazo: false, cor: "var(--color-gray)" },
  { key: "acontecimento", label: "Acontecimento", plural: "Acontecimentos", temStatusPrazo: false, cor: "var(--color-gray-light)" },
];

export const TIPO_POR_KEY = Object.fromEntries(TIPOS.map((t) => [t.key, t]));

export const STATUS_OPCOES = [
  "A fazer",
  "Em andamento",
  "Aguardando resposta",
  "Concluído",
  "Cancelado",
];

export const PAPEIS = {
  proprietario: "Proprietário",
  editor: "Pode editar",
  visualizador: "Pode visualizar",
};

// ---------- Contratos ----------

export const CONTRATO_STATUS = {
  ativo: { label: "Ativo", cor: "var(--color-primary)" },
  aditivo: { label: "Aditivo em andamento", cor: "var(--color-teal-light)" },
  cancelamento: { label: "Cancelamento em andamento", cor: "var(--color-orange)" },
  cancelado: { label: "Cancelado", cor: "var(--color-gray)" },
};

export const PENDENTE_EM_OPCOES = ["TI", "Governança"];

export const ADITIVO_TIPOS = ["Prazo", "Custo", "Escopo"];

// Cada pessoa tem a própria frente "Contratos", onde ficam os itens que ela
// cria a partir da tela de um contrato (ver garantirFrenteContratos em
// lib/firestore.js). "contratos-padrao" é a frente antiga, que era única e
// compartilhada: continua sendo a frente Contratos de quem a criou.
export const FRENTE_CONTRATOS_LEGADA = "contratos-padrao";
export function idFrenteContratos(uid) {
  return `contratos-${uid}`;
}
export function ehFrenteContratos(frenteId) {
  return frenteId === FRENTE_CONTRATOS_LEGADA || String(frenteId || "").startsWith("contratos-");
}
export const CAMPO_CONTRATO_LABEL = "Contrato";
