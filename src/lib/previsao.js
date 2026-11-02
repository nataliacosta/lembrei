import { inicioDoDia, paraDate, somarDias } from "./datas";

// Previsão da fila de demandas: percorre a fila em ordem, gastando a
// capacidade de cada dia útil (seg a sex, fora feriados nacionais) com as
// horas que faltam de cada demanda. Uma demanda por vez.

function pascoa(ano) {
  // Algoritmo de Meeus/Jones/Butcher.
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

const cacheFeriados = {};

// Feriados nacionais (lei federal), incluindo a Sexta-feira Santa.
// Carnaval e Corpus Christi são ponto facultativo e não entram.
export function feriadosNacionais(ano) {
  if (cacheFeriados[ano]) return cacheFeriados[ano];
  const fixos = [
    [1, 1, "Confraternização Universal"],
    [4, 21, "Tiradentes"],
    [5, 1, "Dia do Trabalho"],
    [9, 7, "Independência"],
    [10, 12, "Nossa Senhora Aparecida"],
    [11, 2, "Finados"],
    [11, 15, "Proclamação da República"],
    [11, 20, "Consciência Negra"],
    [12, 25, "Natal"],
  ];
  const mapa = new Map(fixos.map(([m, d, nome]) => [`${m}-${d}`, nome]));
  const sexta = somarDias(pascoa(ano), -2);
  mapa.set(`${sexta.getMonth() + 1}-${sexta.getDate()}`, "Sexta-feira Santa");
  cacheFeriados[ano] = mapa;
  return mapa;
}

export function nomeDoFeriado(data) {
  return feriadosNacionais(data.getFullYear()).get(`${data.getMonth() + 1}-${data.getDate()}`) || null;
}

export function ehDiaUtil(data) {
  const dia = data.getDay();
  return dia !== 0 && dia !== 6 && !nomeDoFeriado(data);
}

// Os próximos `n` dias úteis a partir de hoje (inclusive).
export function proximosDiasUteis(n, desde = inicioDoDia()) {
  const dias = [];
  let d = inicioDoDia(desde);
  while (dias.length < n) {
    if (ehDiaUtil(d)) dias.push(d);
    d = somarDias(d, 1);
  }
  return dias;
}

export function horasRestantes(demanda) {
  return Math.max(0, (Number(demanda.estimativaHoras) || 0) - (Number(demanda.horasFeitas) || 0));
}

// Recebe as demandas já na ordem da fila. Devolve, para cada uma, o dia útil
// em que começa e o em que termina (índices e datas), e o total de dias úteis.
export function calcularPrevisao(demandas, capacidadeHoras, desde = inicioDoDia()) {
  const capacidade = Math.max(0.5, Number(capacidadeHoras) || 6);
  const dias = [];
  const diaUtil = (i) => {
    while (dias.length <= i) dias.push(proximosDiasUteis(1, dias.length ? somarDias(dias[dias.length - 1], 1) : desde)[0]);
    return dias[i];
  };
  let indiceDia = 0;
  let livreNoDia = capacidade;
  const resultado = demandas.map((demanda) => {
    let restante = horasRestantes(demanda);
    if (restante <= 0) {
      return { demanda, inicio: diaUtil(indiceDia), fim: diaUtil(indiceDia), iDiaInicio: indiceDia, iDiaFim: indiceDia };
    }
    if (livreNoDia <= 0) {
      indiceDia++;
      livreNoDia = capacidade;
    }
    const iDiaInicio = indiceDia;
    while (restante > 0) {
      const usado = Math.min(restante, livreNoDia);
      restante -= usado;
      livreNoDia -= usado;
      if (restante > 0) {
        indiceDia++;
        livreNoDia = capacidade;
      }
    }
    return { demanda, inicio: diaUtil(iDiaInicio), fim: diaUtil(indiceDia), iDiaInicio, iDiaFim: indiceDia };
  });
  return { itens: resultado, diasUteisTotais: resultado.length ? resultado[resultado.length - 1].iDiaFim + 1 : 0 };
}

// Diferença, em dias úteis, entre a previsão de uma ordem e a de outra.
export function compararPrevisoes(antes, depois) {
  const fimAntes = Object.fromEntries(antes.itens.map((r) => [r.demanda.id, r.iDiaFim]));
  return depois.itens
    .map((r) => ({ ...r, diferenca: fimAntes[r.demanda.id] === undefined ? null : r.iDiaFim - fimAntes[r.demanda.id] }))
    .filter((r) => r.diferenca);
}

// Converte o que a pessoa digitou (2 dias / 6 horas) em horas.
export function paraHoras(valor, unidade, capacidadeHoras) {
  const n = Number(String(valor).replace(",", ".")) || 0;
  return unidade === "d" ? n * (Number(capacidadeHoras) || 6) : n;
}

export function formatarEstimativa(demanda) {
  const v = demanda.estimativaValor;
  if (demanda.estimativaUnidade === "d") return `${v} ${Number(v) === 1 ? "dia" : "dias"}`;
  return `${v}h`;
}

export function formatarHoras(h) {
  const n = Math.round(h * 10) / 10;
  return `${String(n).replace(".", ",")}h`;
}

// Demandas abertas na ordem da fila (as priorizadas). Quem não está no array
// de ordem ainda está aguardando priorização.
export function ordenarFila(ordem = [], demandas = []) {
  const porId = Object.fromEntries(demandas.filter((d) => !d.concluida).map((d) => [d.id, d]));
  return ordem.map((id) => porId[id]).filter(Boolean);
}

export function demandasAguardando(ordem = [], demandas = []) {
  const naFila = new Set(ordem);
  return demandas
    .filter((d) => !d.concluida && !naFila.has(d.id))
    .sort((a, b) => (a.criadoEm?.seconds || 0) - (b.criadoEm?.seconds || 0));
}

export function temEstimativa(demanda) {
  return Number(demanda.estimativaHoras) > 0;
}

// Previsão de uma demanda em cada posição da fila, e a posição mais baixa que
// ainda cumpre o prazo pedido (null se nenhuma cumpre ou se não há prazo).
export function opcoesDePosicao(fila, demanda, capacidadeHoras) {
  const simular = (i) => {
    const lista = [...fila];
    lista.splice(i, 0, demanda);
    return calcularPrevisao(lista, capacidadeHoras).itens[i].fim;
  };
  const prazo = demanda.prazoPedido ? inicioDoDia(paraDate(demanda.prazoPedido)) : null;
  const fimNoFim = simular(fila.length);
  let posicaoPrazo = null;
  if (prazo && fimNoFim > prazo) {
    for (let i = fila.length; i >= 0; i--) {
      if (simular(i) <= prazo) {
        posicaoPrazo = i;
        break;
      }
    }
  }
  return { simular, prazo, fimNoFim, posicaoPrazo };
}

// Quantos dias úteis há depois de `de` até `ate` (inclusive). 0 se ate <= de.
export function diasUteisEntre(de, ate) {
  let n = 0;
  let d = somarDias(inicioDoDia(de), 1);
  const fim = inicioDoDia(ate);
  while (d <= fim) {
    if (ehDiaUtil(d)) n++;
    d = somarDias(d, 1);
  }
  return n;
}
