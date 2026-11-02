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
