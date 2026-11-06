// Passos de uma demanda e o estado "parada, aguardando retorno". Sem Firebase.
//
// demanda.passos: [{ id, titulo, quem: "eu" | "outro", nomeOutro, horas, feito, feitoEm }]
// demanda.espera: { ativa, de, desde, retornoPrevisto, cobrarEm, passoId }
//   (passoId = parou por causa de um passo de outra pessoa; null = parada manual)
// demanda.esperaHistorico: [{ de, desde, ate }]

export function novoIdPasso() {
  return Math.random().toString(36).slice(2, 10);
}

// Primeiro passo ainda não feito.
export function passoAtual(passos = []) {
  return passos.find((p) => !p.feito) || null;
}

function horasDeEu(passos, soFeitos) {
  return passos.filter((p) => p.quem !== "outro" && (!soFeitos || p.feito)).reduce((s, p) => s + (Number(p.horas) || 0), 0);
}

// Aplica uma nova lista de passos: recalcula estimativa e horas feitas (pela
// soma dos passos "eu") e abre/fecha a espera quando a demanda chega (ou
// passa) de um passo de outra pessoa. Devolve só os campos que mudam, mais
// `evento`: "parou" | "retomou" | null (para avisar quem acompanha a fila).
export function aplicarPassos(demanda, passos, agora = new Date()) {
  const campos = { passos };
  const total = horasDeEu(passos, false);
  if (total > 0) {
    campos.estimativaHoras = total;
    campos.estimativaValor = total;
    campos.estimativaUnidade = "h";
    campos.horasFeitas = horasDeEu(passos, true);
  }
  const espera = demanda.espera?.ativa ? demanda.espera : null;
  const atual = passoAtual(passos);
  const historico = [...(demanda.esperaHistorico || [])];
  let evento = null;

  const fechar = () => {
    historico.push({ de: espera.de, desde: espera.desde, ate: agora });
    campos.espera = null;
    campos.esperaHistorico = historico;
  };

  if (atual?.quem === "outro") {
    if (!espera || espera.passoId !== atual.id) {
      if (espera) fechar();
      campos.espera = { ativa: true, de: atual.nomeOutro || "outra pessoa", desde: agora, retornoPrevisto: atual.retornoPrevisto || null, cobrarEm: null, passoId: atual.id };
      evento = "parou";
    }
  } else if (espera?.passoId) {
    // Parou por um passo que já foi resolvido (ou removido): retoma.
    fechar();
    evento = "retomou";
  }
  return { campos, evento };
}

// "Retorno chegou": marca o passo de outra pessoa como feito (se a espera veio
// de um passo) e encerra a espera; pode já entrar na espera do passo seguinte.
export function retornoChegou(demanda, agora = new Date()) {
  const espera = demanda.espera;
  if (!espera?.ativa) return { campos: {}, evento: null };
  if (espera.passoId) {
    const passos = (demanda.passos || []).map((p) => (p.id === espera.passoId ? { ...p, feito: true, feitoEm: agora } : p));
    const r = aplicarPassos(demanda, passos, agora);
    return { campos: r.campos, evento: r.evento === "parou" ? "parou" : "retomou" };
  }
  return {
    campos: { espera: null, esperaHistorico: [...(demanda.esperaHistorico || []), { de: espera.de, desde: espera.desde, ate: agora }] },
    evento: "retomou",
  };
}

// Parar manualmente (sem passo): "aguardando retorno de X".
export function pararManual(demanda, { de, retornoPrevisto = null }, agora = new Date()) {
  return {
    campos: { espera: { ativa: true, de: de || "outra pessoa", desde: agora, retornoPrevisto, cobrarEm: null, passoId: null } },
    evento: "parou",
  };
}

// Tempo total esperando (dias corridos), incluindo a espera atual.
export function diasEsperando(demanda, agora = new Date()) {
  const dia = 86400000;
  const para = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);
  let total = (demanda.esperaHistorico || []).reduce((s, h) => s + Math.max(0, para(h.ate) - para(h.desde)), 0);
  if (demanda.espera?.ativa) total += Math.max(0, agora - para(demanda.espera.desde));
  return Math.floor(total / dia);
}

export function diasDesde(valor, agora = new Date()) {
  const d = valor?.toDate ? valor.toDate() : valor ? new Date(valor) : null;
  return d ? Math.max(0, Math.floor((agora - d) / 86400000)) : 0;
}

// "Passo 2 de 4: validar os números" (para a espera vinda de um passo).
export function descreverPassoDaEspera(demanda) {
  const passos = demanda.passos || [];
  const i = passos.findIndex((p) => p.id === demanda.espera?.passoId);
  return i >= 0 ? `Passo ${i + 1} de ${passos.length}: ${passos[i].titulo}` : "";
}

// Entradas do "O que fazer" para cobrar retorno (demandas paradas da minha
// fila com "Me lembrar de cobrar em").
export function entradasDeCobranca(demandas = [], { donoId, fila } = {}) {
  return demandas
    .filter((d) => !d.concluida && d.espera?.ativa && d.espera.cobrarEm)
    .map((d) => {
      const data = d.espera.cobrarEm?.toDate ? d.espera.cobrarEm.toDate() : new Date(d.espera.cobrarEm);
      data.setHours(0, 0, 0, 0);
      return { chave: `cobranca:${d.id}`, tipo: "cobranca", demanda: d, donoId, fila, data };
    });
}
