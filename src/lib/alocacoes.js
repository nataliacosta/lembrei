// Medições de contrato por planilha do fornecedor (lógica pura, sem Firebase).
//
// Dentro de cada contrato:
// - centros/{id}:  { tipo: "CC" | "ODI", codigo, descricao, responsavel,
//                    orcamentoMensal, orcamentoAnual }   (orçamentos podem ser null)
// - equipes/{id}:  { nome, responsavel, frentes: [{ id, nome }] }
// - recursos/{id}: { nome, perfil, valorHH,
//                    alocacoes: [{ desde: "2026-10", partes: [{ centroId, equipeId?, frenteId?, pct }] }] }
//   Equipe e frente são opcionais; a frente pertence a uma equipe.
//   Cada alocação vale do mês "desde" até a próxima; assim as mudanças de um
//   mês não alteram os meses anteriores.
// - medicoes/{mes}: { mes: "2026-10", arquivoNome, linhas, total, horas,
//                     status: "a_lancar" | "lancada", ... }
//   Cada linha guarda as partes já calculadas (com tipo e código do CC/ODI),
//   para a medição salva não mudar quando as alocações mudarem depois.

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function normalizarNome(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// "2026-10" a partir de uma data (no fuso local) ou de ano/mês (0–11).
export function mesDe(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

export function somarMeses(mes, n) {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function rotuloMes(mes) {
  const [a, m] = String(mes || "").split("-").map(Number);
  if (!a || !m) return "";
  return `${MESES[m - 1]}/${a}`;
}

export function rotuloMesCurto(mes) {
  const [a, m] = String(mes || "").split("-").map(Number);
  if (!a || !m) return "";
  return `${MESES[m - 1].slice(0, 3).toLowerCase()}/${a}`;
}

// ---------- Alocações ----------

export function alocacoesOrdenadas(recurso) {
  return [...(recurso?.alocacoes || [])].sort((a, b) => a.desde.localeCompare(b.desde));
}

// A alocação que vale no mês (a última com "desde" até esse mês), ou null.
export function alocacaoNoMes(recurso, mes) {
  let atual = null;
  for (const a of alocacoesOrdenadas(recurso)) {
    if (a.desde <= mes) atual = a;
  }
  return atual;
}

// A próxima mudança agendada depois do mês, ou null.
export function proximaAlocacao(recurso, mes) {
  return alocacoesOrdenadas(recurso).find((a) => a.desde > mes) || null;
}

// Grava (ou troca) a alocação que começa no mês "desde".
export function definirAlocacao(recurso, desde, partes) {
  const outras = (recurso?.alocacoes || []).filter((a) => a.desde !== desde);
  return [...outras, { desde, partes }].sort((a, b) => a.desde.localeCompare(b.desde));
}

// Histórico para mostrar: do mais recente ao mais antigo, com o mês final de cada período.
export function historicoDeAlocacoes(recurso) {
  const lista = alocacoesOrdenadas(recurso);
  return lista
    .map((a, i) => ({ ...a, ate: lista[i + 1] ? somarMeses(lista[i + 1].desde, -1) : null }))
    .reverse();
}

export function somaPct(partes) {
  return Math.round((partes || []).reduce((s, p) => s + (Number(p.pct) || 0), 0) * 100) / 100;
}

// ---------- Números da planilha ----------

export function lerNumero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (valor == null) return null;
  let t = String(valor).replace(/[R$\s]/g, "");
  if (!t) return null;
  // "1.234,56" → 1234.56 ; "1234.56" continua igual.
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Datas da planilha chegam como Date em UTC (meia-noite) ou como texto dd/mm/aaaa.
export function lerData(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return new Date(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate());
  }
  const m = String(valor ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const ano = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return new Date(ano, Number(m[2]) - 1, Number(m[1]));
  }
  return null;
}

const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const centavos = (v) => Math.round(v * 100);
const deCentavos = (c) => c / 100;

// ---------- Leitura da planilha ----------

// Colunas que o app usa, com os nomes aceitos (comparados sem acento/maiúsculas).
export const COLUNAS = {
  inicio: ["data inicio", "data de inicio", "inicio"],
  fim: ["data fim", "data final", "data de fim", "fim"],
  recurso: ["nome do recurso", "recurso", "nome"],
  perfil: ["perfil do recurso", "perfil"],
  valorHH: ["valor hh (perfil)", "valor hh", "valor perfil", "valor hora"],
  horas: ["quantidade de horas", "qtd horas", "qtd. horas", "horas"],
  valorTotal: ["valor total", "total"],
  justificativa: ["justificativa"],
};
const OBRIGATORIAS = ["recurso", "horas", "valorTotal"];
const NOMES_COLUNAS = { recurso: "Nome do Recurso", horas: "Quantidade de Horas", valorTotal: "Valor Total" };

// Texto da célula sem espaços nas pontas nem caracteres invisíveis.
function limparTexto(valor) {
  return String(valor ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Recebe as linhas da planilha (a 1ª com os títulos) e devolve as linhas da
// medição. Linhas sem recurso e sem valor (rodapé, linhas vazias) são ignoradas.
export function lerPlanilha(linhasBrutas) {
  const idxTitulo = linhasBrutas.findIndex((l) => (l || []).some((c) => COLUNAS.recurso.includes(normalizarNome(c))));
  if (idxTitulo < 0) {
    return { linhas: [], faltando: OBRIGATORIAS.map((k) => NOMES_COLUNAS[k]) };
  }
  const titulos = linhasBrutas[idxTitulo].map((c) => normalizarNome(c));
  const indice = {};
  for (const [chave, nomes] of Object.entries(COLUNAS)) {
    // Primeiro um título exatamente igual; depois, um que comece com o nome.
    let i = titulos.findIndex((t) => nomes.includes(t));
    if (i < 0) i = titulos.findIndex((t) => nomes.some((n) => t.startsWith(n)));
    indice[chave] = i;
  }
  const faltando = OBRIGATORIAS.filter((k) => indice[k] < 0).map((k) => NOMES_COLUNAS[k]);
  if (faltando.length) return { linhas: [], faltando };

  const pegar = (linha, chave) => (indice[chave] >= 0 ? linha[indice[chave]] : null);
  const linhas = [];
  for (const linha of linhasBrutas.slice(idxTitulo + 1)) {
    if (!linha) continue;
    const recurso = limparTexto(pegar(linha, "recurso"));
    const valorTotal = lerNumero(pegar(linha, "valorTotal"));
    const horas = lerNumero(pegar(linha, "horas"));
    // Linha em branco (sem recurso, ou sem horas e sem valor): fica de fora.
    if (!recurso || (!horas && !valorTotal)) continue;
    const inicio = lerData(pegar(linha, "inicio"));
    const fim = lerData(pegar(linha, "fim"));
    const justificativa = String(pegar(linha, "justificativa") ?? "").trim();
    linhas.push({
      inicio: inicio ? isoLocal(inicio) : null,
      fim: fim ? isoLocal(fim) : null,
      recurso,
      perfil: String(pegar(linha, "perfil") ?? "").trim(),
      valorHH: lerNumero(pegar(linha, "valorHH")),
      horas: horas || 0,
      valorTotal: valorTotal || 0,
      justificativa,
    });
  }
  return { linhas, faltando: [] };
}

// Mês mais comum entre as datas de início das linhas (para sugerir o mês da medição).
export function mesDasLinhas(linhas) {
  const contagem = {};
  for (const l of linhas) if (l.inicio) contagem[l.inicio.slice(0, 7)] = (contagem[l.inicio.slice(0, 7)] || 0) + 1;
  return Object.entries(contagem).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

// ---------- Preencher CC/ODI ----------

// Equipe e frente (nomes copiados na medição, para ela não mudar se renomearem depois).
function equipeEFrente(p, equipesPorId) {
  const equipe = p.equipeId ? equipesPorId?.[p.equipeId] : null;
  const frente = equipe && p.frenteId ? (equipe.frentes || []).find((f) => f.id === p.frenteId) : null;
  return {
    equipeId: equipe ? p.equipeId : null,
    equipe: equipe?.nome || "",
    frenteId: frente ? p.frenteId : null,
    frente: frente?.nome || "",
  };
}

// Divide horas e valor pelas partes (em %); os centavos que sobram ficam na última.
export function dividir(linha, partes, centrosPorId, equipesPorId = {}) {
  const validas = (partes || []).filter((p) => p.centroId && Number(p.pct) > 0);
  if (!validas.length) return [];
  const totalC = centavos(linha.valorTotal);
  const horasC = centavos(linha.horas);
  let restoV = totalC;
  let restoH = horasC;
  return validas.map((p, i) => {
    const ultima = i === validas.length - 1;
    const v = ultima ? restoV : Math.round((totalC * Number(p.pct)) / 100);
    const h = ultima ? restoH : Math.round((horasC * Number(p.pct)) / 100);
    restoV -= v;
    restoH -= h;
    const centro = centrosPorId[p.centroId];
    return {
      centroId: p.centroId,
      tipo: centro?.tipo || "",
      codigo: centro?.codigo || "",
      ...equipeEFrente(p, equipesPorId),
      pct: Number(p.pct),
      horas: deCentavos(h),
      valor: deCentavos(v),
    };
  });
}

// Divide pelas horas de cada parte: o valor sai proporcional às horas, e o %
// é calculado (com 2 casas; a última parte fecha os 100%).
export function dividirPorHoras(linha, partes, centrosPorId, equipesPorId = {}) {
  const validas = (partes || []).filter((p) => p.centroId && Number(p.horas) > 0);
  if (!validas.length) return [];
  const totalC = centavos(linha.valorTotal);
  const horasTotalC = centavos(linha.horas);
  let restoV = totalC;
  let restoPct = 10000;
  return validas.map((p, i) => {
    const ultima = i === validas.length - 1;
    const hC = centavos(Number(p.horas));
    const v = ultima ? restoV : horasTotalC ? Math.round((totalC * hC) / horasTotalC) : 0;
    const pctC = ultima ? restoPct : horasTotalC ? Math.round((hC * 10000) / horasTotalC) : 0;
    restoV -= v;
    restoPct -= pctC;
    const centro = centrosPorId[p.centroId];
    return {
      centroId: p.centroId,
      tipo: centro?.tipo || "",
      codigo: centro?.codigo || "",
      ...equipeEFrente(p, equipesPorId),
      pct: pctC / 100,
      horas: deCentavos(hC),
      valor: deCentavos(v),
    };
  });
}

// Partes de uma linha já dividida, no formato da alocação (para "salvar como alocação").
export function partesParaAlocacao(partes) {
  return (partes || []).map((p) => {
    const a = { centroId: p.centroId, pct: p.pct };
    if (p.equipeId) a.equipeId = p.equipeId;
    if (p.frenteId) a.frenteId = p.frenteId;
    return a;
  });
}

// Liga cada linha ao recurso (pelo nome) e preenche as partes com a alocação do mês.
export function preencherLinhas(linhas, recursos, centros, mes, equipes = []) {
  const porNome = {};
  for (const r of recursos) porNome[normalizarNome(r.nome)] = r;
  const centrosPorId = Object.fromEntries(centros.map((c) => [c.id, c]));
  const equipesPorId = Object.fromEntries(equipes.map((e) => [e.id, e]));
  return linhas.map((linha) => {
    const recurso = porNome[normalizarNome(linha.recurso)] || null;
    const alocacao = recurso ? alocacaoNoMes(recurso, mes) : null;
    const partes = alocacao ? dividir(linha, alocacao.partes, centrosPorId, equipesPorId) : [];
    const valorCadastrado = recurso?.valorHH != null && recurso.valorHH !== "" ? Number(recurso.valorHH) : null;
    const valorDiferente = valorCadastrado != null && linha.valorHH != null && Math.abs(valorCadastrado - linha.valorHH) > 0.005;
    return { ...linha, recursoId: recurso?.id || null, partes, valorCadastrado: valorDiferente ? valorCadastrado : null };
  });
}

export function totaisDaMedicao(linhas) {
  const total = deCentavos(linhas.reduce((s, l) => s + centavos(l.valorTotal || 0), 0));
  const horas = deCentavos(linhas.reduce((s, l) => s + centavos(l.horas || 0), 0));
  return { total, horas };
}

// Total por CC/ODI. Linhas sem parte entram em "sem" (centroId null).
export function totaisPorCentro(linhas) {
  const mapa = new Map();
  const somar = (chave, base, horas, valor) => {
    const atual = mapa.get(chave) || { ...base, horasC: 0, valorC: 0 };
    atual.horasC += centavos(horas);
    atual.valorC += centavos(valor);
    mapa.set(chave, atual);
  };
  for (const l of linhas) {
    if (!l.partes?.length) somar("sem", { centroId: null, tipo: "", codigo: "" }, l.horas, l.valorTotal);
    else for (const p of l.partes) somar(p.centroId, { centroId: p.centroId, tipo: p.tipo, codigo: p.codigo }, p.horas, p.valor);
  }
  return [...mapa.values()]
    .map(({ horasC, valorC, ...resto }) => ({ ...resto, horas: deCentavos(horasC), valor: deCentavos(valorC) }))
    .sort((a, b) => (a.centroId === null) - (b.centroId === null) || a.tipo.localeCompare(b.tipo) || a.codigo.localeCompare(b.codigo));
}

// Total por equipe ou por frente (equipe › frente). Sem equipe/frente entra em "sem".
function totaisPor(linhas, chaveDe, baseDe) {
  const mapa = new Map();
  for (const l of linhas) {
    const partes = l.partes?.length ? l.partes : [{ horas: l.horas, valor: l.valorTotal }];
    for (const p of partes) {
      const chave = chaveDe(p) || "sem";
      const atual = mapa.get(chave) || { ...(chave === "sem" ? { sem: true } : baseDe(p)), horasC: 0, valorC: 0 };
      atual.horasC += centavos(p.horas || 0);
      atual.valorC += centavos(p.valor || 0);
      mapa.set(chave, atual);
    }
  }
  return [...mapa.entries()]
    .map(([chave, { horasC, valorC, ...resto }]) => ({ chave, ...resto, horas: deCentavos(horasC), valor: deCentavos(valorC) }))
    .sort((a, b) => Boolean(a.sem) - Boolean(b.sem) || b.valor - a.valor);
}

export function totaisPorEquipe(linhas) {
  return totaisPor(linhas, (p) => (p.equipe ? p.equipeId || p.equipe : null), (p) => ({ equipe: p.equipe }));
}

export function totaisPorFrente(linhas) {
  return totaisPor(linhas, (p) => (p.frente ? `${p.equipeId || p.equipe}|${p.frenteId || p.frente}` : null), (p) => ({ equipe: p.equipe, frente: p.frente }));
}

// Quanto cada CC/ODI usou no mês e no ano (somando as medições salvas do contrato).
export function usoDosCentros(medicoes, mes) {
  const ano = mes.slice(0, 4);
  const uso = {};
  for (const m of medicoes) {
    if (!m.mes || m.mes.slice(0, 4) !== ano || m.mes > mes) continue;
    for (const t of totaisPorCentro(m.linhas || [])) {
      if (!t.centroId) continue;
      const u = (uso[t.centroId] ||= { mesC: 0, anoC: 0 });
      u.anoC += centavos(t.valor);
      if (m.mes === mes) u.mesC += centavos(t.valor);
    }
  }
  return Object.fromEntries(Object.entries(uso).map(([k, v]) => [k, { mes: deCentavos(v.mesC), ano: deCentavos(v.anoC) }]));
}

export function formatarReais(valor) {
  if (valor == null || valor === "") return "—";
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarNumero(valor, casas = 2) {
  if (valor == null || valor === "") return "—";
  return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function formatarHoras(valor) {
  const n = Number(valor) || 0;
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} h`;
}

// "01–31/10" a partir das datas ISO da linha.
export function periodoCurto(inicio, fim) {
  const d = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
  if (!inicio && !fim) return "—";
  if (inicio && fim && inicio.slice(0, 7) === fim.slice(0, 7)) return `${inicio.slice(8, 10)}–${d(fim)}`;
  return [d(inicio), d(fim)].filter(Boolean).join("–");
}

// Linhas para a planilha preenchida: uma linha por parte (as divididas viram várias).
export function linhasParaExportar(linhas) {
  const saida = [];
  for (const l of linhas) {
    const base = { inicio: l.inicio, fim: l.fim, recurso: l.recurso, perfil: l.perfil, valorHH: l.valorHH, justificativa: l.justificativa };
    if (!l.partes?.length) saida.push({ ...base, horas: l.horas, valor: l.valorTotal, tipoPagamento: "", centro: "", equipe: "", frente: "" });
    else
      for (const p of l.partes)
        saida.push({ ...base, horas: p.horas, valor: p.valor, tipoPagamento: p.tipo === "CC" ? "Centro de Custo" : "ODI", centro: p.codigo, equipe: p.equipe || "", frente: p.frente || "" });
  }
  return saida;
}
