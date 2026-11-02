import { TIPO_POR_KEY } from "./constants";
import { alertaVencimento, diasAte, inicioDoDia, paraDate } from "./datas";
import { preparosDaOcorrencia, proximaOcorrencia } from "./reunioes";

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

function ehReuniao(item) {
  return item.tipo === "reuniao" && Boolean(item.reuniao);
}

function temLembreteAtivo(item) {
  return Boolean(item.lembrete?.ativo && item.lembrete.proximaVerificacao);
}

// No filtro "Meus", o preparo conta para quem foi escolhido para ele; o resto,
// para quem é responsável pelo item. Uma reunião vira uma entrada no dia dela e
// uma por preparo pendente, a partir dos dias de antecedência de cada um.
export function entradasDaAgenda(itens, { uid, soMeus = false } = {}) {
  const entradas = [];
  const doItem = (item) => !soMeus || ehMeu(item, uid);
  for (const item of itens) {
    if (item.concluido) continue;
    if (ehReuniao(item)) {
      const ocorrencia = proximaOcorrencia(item.reuniao);
      if (!ocorrencia) continue;
      const preparos = preparosDaOcorrencia(item.reuniao, ocorrencia);
      if (doItem(item)) {
        entradas.push({ chave: `${item.id}:reuniao`, tipo: "reuniao", item, data: ocorrencia, preparos });
      }
      const hoje = inicioDoDia();
      for (const preparo of preparos) {
        if (preparo.feito || preparo.comecaEm > hoje) continue;
        const meu = preparo.responsavelId ? preparo.responsavelId === uid : ehMeu(item, uid);
        if (soMeus && !meu) continue;
        // Data do preparo = dia da reunião (meia-noite), para vir antes dela na lista.
        entradas.push({ chave: `${item.id}:preparo:${preparo.id}`, tipo: "preparo", item, preparo, data: inicioDoDia(ocorrencia), ocorrencia });
      }
      continue;
    }
    if (!doItem(item)) continue;
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

export function agruparAgenda(itens, opcoes = {}) {
  const grupos = Object.fromEntries(GRUPOS.map((g) => [g.key, []]));
  for (const entrada of entradasDaAgenda(itens, opcoes)) {
    grupos[grupoDaData(entrada.data)].push(entrada);
  }
  const semData = itens.filter(
    (i) =>
      !i.concluido &&
      (!opcoes.soMeus || ehMeu(i, opcoes.uid)) &&
      (ehReuniao(i) ? !proximaOcorrencia(i.reuniao) : !temPrazo(i) && !temLembreteAtivo(i))
  );
  return { grupos, semData };
}

// Um item está "atrasado" se o prazo ou o lembrete já passou.
export function itemAtrasado(item) {
  if (item.concluido || ehReuniao(item)) return false;
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
    else if (ehReuniao(item) ? proximaOcorrencia(item.reuniao) : temPrazo(item) || temLembreteAtivo(item)) comData.push(item);
    else semData.push(item);
  }
  const proximaData = (i) =>
    ehReuniao(i)
      ? (proximaOcorrencia(i.reuniao)?.getTime() ?? Infinity)
      : Math.min(
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
