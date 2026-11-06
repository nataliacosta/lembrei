import { agruparAgenda } from "../../src/lib/agenda.js";
import { entradasDeMedicao } from "../../src/lib/medicao.js";

export function hojeChave(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function hhmm(d) {
  return d.toTimeString().slice(0, 5);
}

export function plural(n, um, varios) {
  return `${n} ${n === 1 ? um : varios}`;
}

export async function itensAbertos(db, uid) {
  const snap = await db
    .collectionGroup("itens")
    .where("membrosUids", "array-contains", uid)
    .where("concluido", "==", false)
    .orderBy("prazo", "asc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function textoDoResumo(itens, contratos, uid) {
  const { grupos } = agruparAgenda(itens, { uid, soMeus: true, extras: entradasDeMedicao(contratos, { uid, soMeus: true }) });
  const atrasados = grupos.atrasados.length;
  const hoje = grupos.hoje.filter((e) => e.tipo !== "reuniao");
  const reunioes = grupos.hoje.filter((e) => e.tipo === "reuniao");
  const partes = [];
  if (atrasados) partes.push(plural(atrasados, "atrasado", "atrasados"));
  if (hoje.length) partes.push(`${hoje.length} para hoje`);
  if (reunioes.length) {
    const r = reunioes[0];
    partes.push(`reunião ${hhmm(r.data)} (${r.item.titulo})` + (reunioes.length > 1 ? ` + ${plural(reunioes.length - 1, "reunião", "reuniões")}` : ""));
  }
  return partes.length ? partes.join(" · ") : "Nada atrasado nem vencendo hoje. 🎉";
}

