export function formatarData(valor) {
  if (!valor) return "";
  const data = valor.toDate ? valor.toDate() : new Date(valor);
  // Sem o ano dá pra confundir datas de anos diferentes que caem no mesmo
  // dia/mês (ex: um lembrete esquecido de 2025 parecendo "no futuro" hoje).
  const opcoes = { day: "2-digit", month: "2-digit" };
  if (data.getFullYear() !== new Date().getFullYear()) opcoes.year = "2-digit";
  return data.toLocaleDateString("pt-BR", opcoes);
}

export function paraInputDate(valor) {
  if (!valor) return "";
  const data = valor.toDate ? valor.toDate() : new Date(valor);
  return data.toISOString().slice(0, 10);
}

export function deInputDate(valorString) {
  if (!valorString) return null;
  const [ano, mes, dia] = valorString.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

export function estaAtrasado(valor) {
  if (!valor) return false;
  const data = valor.toDate ? valor.toDate() : new Date(valor);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return data < hoje;
}

// Alerta de vencimento de contrato:
// vencido -> alerta máximo; dentro da janela (3 meses sem aditivo ativo,
// 1 mês com aditivo em andamento) -> alerta de atenção; fora disso -> nenhum.
export function alertaVencimento(vencimento, temAditivoAtivo) {
  if (!vencimento) return null;
  const data = vencimento.toDate ? vencimento.toDate() : new Date(vencimento);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  if (data < hoje) return "vencido";

  const limite = new Date(hoje);
  if (temAditivoAtivo) {
    limite.setMonth(limite.getMonth() + 1);
  } else {
    limite.setMonth(limite.getMonth() + 3);
  }

  return data <= limite ? "proximo" : null;
}

// ---------- Ajudantes para a visão "O que fazer" ----------

const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function paraDate(valor) {
  if (!valor) return null;
  return valor.toDate ? valor.toDate() : new Date(valor);
}

export function inicioDoDia(data = new Date()) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function somarDias(data, dias) {
  const d = new Date(data);
  d.setDate(d.getDate() + dias);
  return d;
}

// Diferença em dias corridos entre hoje e a data (negativo = já passou).
export function diasAte(valor) {
  const data = paraDate(valor);
  if (!data) return null;
  return Math.round((inicioDoDia(data) - inicioDoDia()) / DIA_MS);
}

// "Hoje", "Amanhã", "Qui 05/11" (próximos 6 dias) ou a data normal.
export function formatarDataRelativa(valor) {
  const data = paraDate(valor);
  if (!data) return "";
  const dias = diasAte(data);
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  if (dias > 1 && dias < 7) return `${DIAS_SEMANA[data.getDay()]} ${formatarData(data)}`;
  return formatarData(data);
}

// "vence em 26 dias", "venceu há 33 dias", "vence hoje", "vence em 7 meses".
export function descreverVencimento(valor) {
  const dias = diasAte(valor);
  if (dias === null) return "";
  if (dias === 0) return "Vence hoje";
  const abs = Math.abs(dias);
  const quanto = abs >= 60 ? `${Math.round(abs / 30)} meses` : `${abs} ${abs === 1 ? "dia" : "dias"}`;
  return dias > 0 ? `Vence em ${quanto}` : `Venceu há ${quanto}`;
}

export function diaDaSemanaPorExtenso(data = new Date()) {
  return data.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}
