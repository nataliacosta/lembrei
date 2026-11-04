import { deleteField, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { inicioDoDia, somarDias } from "./datas";
import { ehDiaUtil } from "./previsao";

// Medição mensal de contratos. Fica em contrato.medicao:
// { ativa, quem: "TI" | "Negócio", responsavelId, responsavelNome, lightPlus,
//   diaPrazo (1–31, padrão 10), diasAntes (padrão 5), feitas: { "2026-11": true } }

export const MEDICAO_PADRAO = { ativa: false, quem: "Negócio", responsavelId: null, responsavelNome: "", lightPlus: false, diaPrazo: 10, diasAntes: 5 };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function chaveDoMes(ano, mes) {
  return `${ano}-${String(mes + 1).padStart(2, "0")}`;
}

export function nomeDoMes(mes) {
  return MESES[mes];
}

// Prazo do mês: o dia escolhido (ou o último dia do mês, se ele for mais
// curto); caindo em fim de semana ou feriado, vai para o dia útil anterior.
export function prazoDoMes(ano, mes, diaPrazo = 10) {
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  let data = new Date(ano, mes, Math.min(Math.max(1, diaPrazo), ultimo));
  while (!ehDiaUtil(data)) data = somarDias(data, -1);
  return inicioDoDia(data);
}

// A medição pendente mais próxima: a do mês atual, ou a do mês seguinte se
// a deste mês já foi feita. Devolve null se o contrato não tem medição.
export function proximaMedicao(contrato, hoje = inicioDoDia()) {
  const m = contrato?.medicao;
  if (!m?.ativa || contrato.status === "cancelado") return null;
  const feitas = m.feitas || {};
  for (let i = 0; i < 2; i++) {
    const ano = hoje.getFullYear() + Math.floor((hoje.getMonth() + i) / 12);
    const mes = (hoje.getMonth() + i) % 12;
    const chave = chaveDoMes(ano, mes);
    if (feitas[chave]) continue;
    const prazo = prazoDoMes(ano, mes, Number(m.diaPrazo) || 10);
    const lembrarEm = somarDias(prazo, -(Number(m.diasAntes) || 0));
    return { chave, ano, mes, nomeMes: nomeDoMes(mes), prazo, lembrarEm };
  }
  return null;
}

// Entradas do "O que fazer": a medição aparece a partir do dia do lembrete,
// com prazo no dia da medição, para quem é responsável por ela.
export function entradasDeMedicao(contratos, { uid, soMeus = false } = {}) {
  const hoje = inicioDoDia();
  const entradas = [];
  for (const contrato of contratos) {
    const responsavelId = contrato.medicao?.responsavelId;
    if (!responsavelId || (soMeus && responsavelId !== uid)) continue;
    const proxima = proximaMedicao(contrato, hoje);
    if (!proxima || proxima.lembrarEm > hoje) continue;
    entradas.push({ chave: `medicao:${contrato.id}:${proxima.chave}`, tipo: "medicao", contrato, medicao: proxima, data: proxima.prazo });
  }
  return entradas;
}

export async function marcarMedicaoFeita(contratoId, chave, feita = true) {
  return updateDoc(doc(db, "contratos", contratoId), {
    [`medicao.feitas.${chave}`]: feita ? true : deleteField(),
    atualizadoEm: serverTimestamp(),
  });
}
