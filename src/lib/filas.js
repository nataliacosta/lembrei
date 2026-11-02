import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

// Fila de demandas: um documento por pessoa em filas/{uid} (o id é o uid do
// dono), com a capacidade diária, a ordem da fila (array de ids) e quem tem
// acesso. As demandas ficam em filas/{uid}/demandas/{id}.

function filaRef(donoId) {
  return doc(db, "filas", donoId);
}

function demandasRef(donoId) {
  return collection(db, "filas", donoId, "demandas");
}

export async function garantirFila(user) {
  const ref = filaRef(user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    donoId: user.uid,
    donoNome: user.displayName || user.email,
    capacidadeHoras: 6,
    ordem: [],
    membros: { [user.uid]: "proprietario" },
    membrosUids: [user.uid],
    convitesPendentes: [],
    convitesPendentesEmails: [],
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
}

export function watchFila(donoId, callback, onError) {
  return onSnapshot(
    filaRef(donoId),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (erro) => {
      console.error("Erro ao observar fila:", erro);
      if (onError) onError(erro);
    }
  );
}

// Filas que outras pessoas compartilharam comigo.
export function watchFilasCompartilhadas(uid, callback) {
  const q = query(collection(db, "filas"), where("membrosUids", "array-contains", uid));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((f) => f.id !== uid)),
    (erro) => console.error("Erro ao observar filas compartilhadas:", erro)
  );
}

export function watchDemandas(donoId, callback, onError) {
  return onSnapshot(
    demandasRef(donoId),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (erro) => {
      console.error("Erro ao observar demandas:", erro);
      if (onError) onError(erro);
    }
  );
}

export async function salvarOrdem(donoId, ordem) {
  return updateDoc(filaRef(donoId), { ordem, atualizadoEm: serverTimestamp() });
}

export async function alterarCapacidade(donoId, capacidadeHoras) {
  return updateDoc(filaRef(donoId), { capacidadeHoras, atualizadoEm: serverTimestamp() });
}

// Demanda nova vai para "Aguardando priorização" (fora do array de ordem).
export async function criarDemanda(donoId, dados, uid) {
  return addDoc(demandasRef(donoId), {
    ...dados,
    horasFeitas: 0,
    concluida: false,
    concluidaEm: null,
    criadoPor: uid,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
}

// Coloca uma demanda que estava aguardando na posição pedida (0 = topo).
export async function priorizarDemanda(donoId, ordemAtual, demandaId, posicao) {
  const ordem = ordemAtual.filter((id) => id !== demandaId);
  ordem.splice(Math.max(0, Math.min(posicao, ordem.length)), 0, demandaId);
  await salvarOrdem(donoId, ordem);
}

// Tira da fila e devolve para "Aguardando priorização".
export async function despriorizarDemanda(donoId, ordemAtual, demandaId) {
  await salvarOrdem(
    donoId,
    ordemAtual.filter((id) => id !== demandaId)
  );
}

export async function atualizarDemanda(donoId, demandaId, dados) {
  return updateDoc(doc(db, "filas", donoId, "demandas", demandaId), { ...dados, atualizadoEm: serverTimestamp() });
}

export async function concluirDemanda(donoId, demandaId, ordemAtual) {
  await atualizarDemanda(donoId, demandaId, { concluida: true, concluidaEm: serverTimestamp() });
  await salvarOrdem(
    donoId,
    ordemAtual.filter((id) => id !== demandaId)
  );
}

export async function reabrirDemanda(donoId, demandaId, ordemAtual) {
  // Volta para "Aguardando priorização", para alguém decidir onde ela entra.
  await atualizarDemanda(donoId, demandaId, { concluida: false, concluidaEm: null });
  await salvarOrdem(
    donoId,
    ordemAtual.filter((id) => id !== demandaId)
  );
}

export async function excluirDemanda(donoId, demandaId, ordemAtual) {
  await deleteDoc(doc(db, "filas", donoId, "demandas", demandaId));
  await salvarOrdem(
    donoId,
    ordemAtual.filter((id) => id !== demandaId)
  );
}

// ---------- Compartilhamento (mesmo modelo de frentes e contratos) ----------

export async function convidarMembroFila(donoId, email, papel) {
  return updateDoc(filaRef(donoId), {
    convitesPendentes: arrayUnion({ email, papel }),
    convitesPendentesEmails: arrayUnion(email),
    atualizadoEm: serverTimestamp(),
  });
}

export async function cancelarConviteFila(donoId, convite) {
  return updateDoc(filaRef(donoId), {
    convitesPendentes: arrayRemove(convite),
    convitesPendentesEmails: arrayRemove(convite.email),
  });
}

export async function alterarPapelFila(donoId, membros, uidDoMembro, novoPapel) {
  return updateDoc(filaRef(donoId), { membros: { ...membros, [uidDoMembro]: novoPapel }, atualizadoEm: serverTimestamp() });
}

export async function removerMembroFila(donoId, membros, membrosUids, uidDoMembro) {
  const novoMembros = { ...membros };
  delete novoMembros[uidDoMembro];
  return updateDoc(filaRef(donoId), {
    membros: novoMembros,
    membrosUids: membrosUids.filter((uid) => uid !== uidDoMembro),
    atualizadoEm: serverTimestamp(),
  });
}

export async function resgatarConvitesPendentesFilas(uid, email) {
  if (!email) return;
  const q = query(collection(db, "filas"), where("convitesPendentesEmails", "array-contains", email));
  const snap = await getDocs(q);
  for (const filaDoc of snap.docs) {
    const fila = filaDoc.data();
    const convite = (fila.convitesPendentes || []).find((c) => c.email === email);
    if (!convite) continue;
    await updateDoc(filaDoc.ref, {
      membros: { ...fila.membros, [uid]: convite.papel },
      membrosUids: Array.from(new Set([...(fila.membrosUids || []), uid])),
      convitesPendentes: arrayRemove(convite),
      convitesPendentesEmails: arrayRemove(email),
    });
  }
}
