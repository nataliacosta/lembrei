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

function valores(dados) {
  return {
    tipo: dados.tipo === "CC" ? "CC" : "ODI",
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
  for (const x of novos.slice(0, 450)) batch.set(doc(ref(uid)), { ...valores(x), importadoDeContrato: true, criadoEm: serverTimestamp() });
  await batch.commit();
  return novos.length;
}
