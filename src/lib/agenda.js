import { TIPO_POR_KEY } from "./constants";
import { alertaVencimento, diasAte, paraDate } from "./datas";

// Monta a visão "O que fazer": cada item aberto vira uma ou duas entradas na
// agenda — uma pelo prazo (tipos que têm prazo) e outra pelo lembrete ativo —
// e as entradas são agrupadas pela urgência da data.

export const GRUPOS = [
  { key: "atrasados", label: "Atrasados", alerta: true },
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Próximos 7 dias" },
  { key: "proximos", label: "Mais adiante" },
];

export function grupoDaData(valor) {
  const dias = diasAte(valor);
  if (dias === null) return null;
  if (dias < 0) return "atrasados";
  if (dias === 0) return "hoje";
  if (dias <= 7) return "semana";
  return "proximos";
}

// "Meus": o que está comigo — sou a responsável, ou o item não tem
// responsável e fui eu que criei.
export function ehMeu(item, uid) {
  if (item.responsavelId) return item.responsavelId === uid;
  if (item.responsavelNome) return false;
  return item.criadoPor === uid;
}

function temPrazo(item) {
  return Boolean(item.prazo) && TIPO_POR_KEY[item.tipo]?.temStatusPrazo !== false;
}

function temLembreteAtivo(item) {
  return Boolean(item.lembrete?.ativo && item.lembrete.proximaVerificacao);
}

export function entradasDaAgenda(itens) {
  const entradas = [];
  for (const item of itens) {
    if (item.concluido) continue;
    if (temPrazo(item)) {
      entradas.push({ chave: `${item.id}:prazo`, tipo: "prazo", item, data: paraDate(item.prazo) });
    }
    if (temLembreteAtivo(item)) {
      entradas.push({
        chave: `${item.id}:lembrete`,
        tipo: "lembrete",
        item,
        data: paraDate(item.lembrete.proximaVerificacao),
      });
    }
  }
  return entradas.sort((a, b) => a.data - b.data);
}

export function agruparAgenda(itens) {
  const grupos = Object.fromEntries(GRUPOS.map((g) => [g.key, []]));
  for (const entrada of entradasDaAgenda(itens)) {
    grupos[grupoDaData(entrada.data)].push(entrada);
  }
  const semData = itens.filter((i) => !i.concluido && !temPrazo(i) && !temLembreteAtivo(i));
  return { grupos, semData };
}

// Um item está "atrasado" se o prazo ou o lembrete já passou.
export function itemAtrasado(item) {
  if (item.concluido) return false;
  if (temPrazo(item) && diasAte(item.prazo) < 0) return true;
  if (temLembreteAtivo(item) && diasAte(item.lembrete.proximaVerificacao) < 0) return true;
  return false;
}

// Agrupa os itens de uma frente: atrasados, com data (pelo que vem primeiro)
// e sem data.
export function agruparItensDaFrente(itens) {
  const atrasados = [];
  const comData = [];
  const semData = [];
  for (const item of itens) {
    if (itemAtrasado(item)) atrasados.push(item);
    else if (temPrazo(item) || temLembreteAtivo(item)) comData.push(item);
    else semData.push(item);
  }
  const proximaData = (i) =>
    Math.min(
      temPrazo(i) ? paraDate(i.prazo).getTime() : Infinity,
      temLembreteAtivo(i) ? paraDate(i.lembrete.proximaVerificacao).getTime() : Infinity
    );
  atrasados.sort((a, b) => proximaData(a) - proximaData(b));
  comData.sort((a, b) => proximaData(a) - proximaData(b));
  return { atrasados, comData, semData };
}

// ---------- Contratos ----------

export function situacaoDoContrato(contrato) {
  if (contrato.status === "cancelado") return "encerrado";
  const alerta = alertaVencimento(contrato.vencimento, contrato.status === "aditivo");
  return alerta ? "atencao" : "em-dia";
}

export function contratosPedindoAtencao(contratos) {
  return contratos
    .filter((c) => situacaoDoContrato(c) === "atencao")
    .sort((a, b) => (paraDate(a.vencimento)?.getTime() || 0) - (paraDate(b.vencimento)?.getTime() || 0));
}
