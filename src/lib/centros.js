import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { chaveCentro } from "./alocacoes";

// CCs e ODIs "fora do orçamento" de cada pessoa (as do orçamento vêm da última
// versão efetivada). Ficam em usuarios/{uid}/centros.
const ref = (uid) => collection(db, "usuarios", uid, "centros");

export function watchCentrosFora(uid, callback) {
  return onSnapshot(
    ref(uid),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)))),
    (e) => {
      console.error("Erro ao ler os CCs/ODIs:", e);
      callback([]);
    }
  );
}

// CC vale para todos os anos; ODI fora do orçamento vale só para um ano (o
// do orçamento a que o custo se refere, pelo mês de pagamento).
export function anoDoCentroFora(c) {
  if (!c || c.tipo === "CC") return null;
  if (c.ano) return Number(c.ano);
  const t = c.criadoEm?.toDate ? c.criadoEm.toDate() : c.criadoEm?.seconds ? new Date(c.criadoEm.seconds * 1000) : null;
  return (t || new Date()).getFullYear();
}

function valores(dados) {
  const ehCC = dados.tipo === "CC";
  return {
    tipo: ehCC ? "CC" : "ODI",
    ano: ehCC ? null : Number(dados.ano) || new Date().getFullYear(),
    codigo: String(dados.codigo || "").trim(),
    descricao: String(dados.descricao || "").trim(),
    responsavel: String(dados.responsavel || "").trim(),
    atualizadoEm: serverTimestamp(),
  };
}

export async function salvarCentroFora(uid, id, dados) {
  if (id) return updateDoc(doc(db, "usuarios", uid, "centros", id), valores(dados));
  return addDoc(ref(uid), { ...valores(dados), criadoEm: serverTimestamp() });
}

export function excluirCentroFora(uid, id) {
  return deleteDoc(doc(db, "usuarios", uid, "centros", id));
}

// Traz para a lista única os CCs/ODIs que estavam cadastrados dentro dos
// contratos (uma vez por código; os que já existem ficam como estão).
export async function importarCentrosDosContratos(uid, contratos, existentes) {
  const ja = new Set(existentes.map((c) => chaveCentro(c.tipo, c.codigo)));
  // (a importação só roda uma vez por pessoa, então não precisa olhar o ano)
  const novos = [];
  for (const c of contratos) {
    try {
      const snap = await getDocs(collection(db, "contratos", c.id, "centros"));
      for (const d of snap.docs) {
        const x = d.data();
        const k = chaveCentro(x.tipo, x.codigo);
        if (!x.codigo || ja.has(k)) continue;
        ja.add(k);
        novos.push(x);
      }
    } catch (e) {
      console.error("Não deu pra ler os CCs/ODIs do contrato", c.id, e);
    }
  }
  if (!novos.length) return 0;
  const batch = writeBatch(db);
  for (const x of novos.slice(0, 450)) batch.set(doc(ref(uid)), { ...valores({ ...x, ano: new Date().getFullYear() }), importadoDeContrato: true, criadoEm: serverTimestamp() });
  await batch.commit();
  return novos.length;
}
