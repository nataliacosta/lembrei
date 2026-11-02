import { inicioDoDia, paraDate, somarDias } from "./datas";

// Reuniões recorrentes. O item de tipo "reuniao" guarda, no campo `reuniao`:
//   frequencia: "unica" | "semanal" | "quinzenal" | "mensal-dia" | "mensal-semana"
//   inicio:     data da primeira reunião (meia-noite local)
//   hora:       "HH:MM" (opcional)
//   ate:        última data possível (opcional)
//   link:       link da chamada (opcional)
//   preparos:   [{ id, titulo, diasAntes, responsavelId, responsavelNome }]
//   feitos:     { "AAAA-MM-DD": [ids dos preparos feitos para aquela data] }
//   puladas:    ["AAAA-MM-DD", ...] datas canceladas
// As próximas datas são calculadas aqui, sem nada rodando no servidor.

export const FREQUENCIAS = [
  { key: "unica", label: "Única" },
  { key: "semanal", label: "Toda semana" },
  { key: "quinzenal", label: "A cada 15 dias" },
  { key: "mensal", label: "Todo mês" },
];

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const DIAS_PLURAL = ["Domingos", "Segundas", "Terças", "Quartas", "Quintas", "Sextas", "Sábados"];
const ORDINAIS = ["1ª", "2ª", "3ª", "4ª", "última"];
const LIMITE = 400; // segurança contra laço infinito

export function chaveData(data) {
  const d = paraDate(data);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Qual ocorrência do dia da semana no mês (1ª..4ª, 5 = última).
export function ordinalNoMes(data) {
  return Math.min(Math.ceil(paraDate(data).getDate() / 7), 5);
}

function nEsimoDiaDaSemana(ano, mes, diaSemana, ordinal) {
  if (ordinal >= 5) {
    const d = new Date(ano, mes + 1, 0); // último dia do mês
    while (d.getDay() !== diaSemana) d.setDate(d.getDate() - 1);
    return d;
  }
  const d = new Date(ano, mes, 1);
  while (d.getDay() !== diaSemana) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + 7 * (ordinal - 1));
  return d;
}

function comHora(data, hora) {
  const d = new Date(data);
  if (hora) {
    const [h, m] = hora.split(":").map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
  }
  return d;
}

// Gera as datas da reunião a partir de `desde` (inclusive, por dia), até `quantas`.
export function ocorrencias(reuniao, { desde = inicioDoDia(), quantas = 5 } = {}) {
  if (!reuniao?.inicio) return [];
  const inicio = inicioDoDia(paraDate(reuniao.inicio));
  const ate = reuniao.ate ? inicioDoDia(paraDate(reuniao.ate)) : null;
  const puladas = new Set(reuniao.puladas || []);
  const limiteInferior = inicioDoDia(desde);
  const resultado = [];

  const aceitar = (d) => {
    if (ate && d > ate) return false;
    if (d >= limiteInferior && !puladas.has(chaveData(d))) resultado.push(comHora(d, reuniao.hora));
    return true;
  };

  const f = reuniao.frequencia || "unica";
  if (f === "unica") {
    aceitar(inicio);
    return resultado;
  }
  for (let i = 0; i < LIMITE && resultado.length < quantas; i++) {
    let d;
    if (f === "semanal") d = somarDias(inicio, 7 * i);
    else if (f === "quinzenal") d = somarDias(inicio, 14 * i);
    else if (f === "mensal-dia") {
      const alvo = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
      const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
      d = new Date(alvo.getFullYear(), alvo.getMonth(), Math.min(inicio.getDate(), ultimoDia));
    } else if (f === "mensal-semana") {
      const alvo = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
      d = nEsimoDiaDaSemana(alvo.getFullYear(), alvo.getMonth(), inicio.getDay(), reuniao.ordinal || ordinalNoMes(inicio));
    } else break;
    if (!aceitar(d)) break;
  }
  return resultado;
}

export function proximaOcorrencia(reuniao) {
  return ocorrencias(reuniao, { quantas: 1 })[0] || null;
}

// Última reunião que já passou (para mostrar os preparos dela).
export function ultimaOcorrencia(reuniao) {
  if (!reuniao?.inicio) return null;
  const hoje = inicioDoDia();
  const todas = ocorrencias(reuniao, { desde: paraDate(reuniao.inicio), quantas: LIMITE });
  const passadas = todas.filter((d) => inicioDoDia(d) < hoje);
  return passadas[passadas.length - 1] || null;
}

export function descreverRecorrencia(reuniao) {
  if (!reuniao?.inicio) return "";
  const inicio = paraDate(reuniao.inicio);
  const hora = reuniao.hora ? `, ${reuniao.hora}` : "";
  const dia = inicio.getDay();
  switch (reuniao.frequencia) {
    case "semanal":
      return `${DIAS_PLURAL[dia]}, toda semana${hora}`;
    case "quinzenal":
      return `${DIAS_PLURAL[dia]}, a cada 15 dias${hora}`;
    case "mensal-dia":
      return `Todo dia ${inicio.getDate()} do mês${hora}`;
    case "mensal-semana": {
      const ordinal = reuniao.ordinal || ordinalNoMes(inicio);
      return `Toda ${ORDINAIS[ordinal - 1]} ${DIAS[dia]} do mês${hora}`;
    }
    default:
      return `Reunião única${hora}`;
  }
}

export function frequenciaCurta(reuniao) {
  return (
    { semanal: "toda semana", quinzenal: "a cada 15 dias", "mensal-dia": "todo mês", "mensal-semana": "todo mês" }[
      reuniao?.frequencia
    ] || "única"
  );
}

export function rotuloMensalPorSemana(inicio) {
  const d = paraDate(inicio);
  return `Toda ${ORDINAIS[ordinalNoMes(d) - 1]} ${DIAS[d.getDay()]}`;
}

// Preparos de uma data: com a data em que começam a aparecer e se já foram feitos.
export function preparosDaOcorrencia(reuniao, ocorrencia) {
  if (!ocorrencia) return [];
  const chave = chaveData(ocorrencia);
  const feitos = new Set(reuniao?.feitos?.[chave] || []);
  return (reuniao?.preparos || []).map((p) => ({
    ...p,
    chave,
    feito: feitos.has(p.id),
    comecaEm: somarDias(inicioDoDia(ocorrencia), -(Number(p.diasAntes) || 0)),
  }));
}
